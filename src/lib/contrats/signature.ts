/**
 * Signature électronique des actes.
 *
 * ── Ce qui donne sa valeur à la signature ──────────────────────────────────
 * Ce n'est pas le tracé, c'est le FAISCEAU DE PREUVES qui l'entoure : code à
 * usage unique vérifié, adresse IP, agent utilisateur, horodatage de Dakar,
 * empreinte SHA-256 du document avant et après apposition, et un journal
 * d'événements complet. C'est ce faisceau qui répond à l'exigence de « procédé
 * fiable d'identification » de l'article 41 de la loi sénégalaise n° 2008-08.
 *
 * ── Garde-fous ─────────────────────────────────────────────────────────────
 *   — ordre imposé : le client signe, le gérant contresigne ensuite ;
 *   — la signature du client est refusée si l'OTP n'a pas été vérifié ;
 *   — le lien de signature est opaque, à usage unique, valable 72 heures, et
 *     seul son condensat est conservé en base ;
 *   — une seule signature par rôle et par contrat (contrainte d'unicité) ;
 *   — la formule avec engagement exige la mention « Lu et approuvé » saisie
 *     par le client, faute de quoi l'article du différentiel serait mal opposable.
 */

import { randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "@/lib/prisma";
import { ecrireBlob, lireBlob, sha256 } from "@/lib/storage";
import { horodatageFr } from "@/lib/formatters";
import { creerEcheancier, debutDuSuiviPour } from "@/lib/versements";
import { securiser } from "./mise-en-page";
import type { EmplacementSignature } from "./mise-en-page";
import type { SnapshotContrat } from "./snapshot";
import type { CanalOtp, RoleSignataire } from "@/generated/prisma";

const DUREE_JETON_HEURES = 72;

/** Mention imposée par la formule avec engagement, avant la signature. */
export const MENTION_ENGAGEMENT =
  "Lu et approuvé, je reconnais avoir pris connaissance de l'article 5";

export class ErreurSignature extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurSignature";
  }
}

// ---------------------------------------------------------------------------
// Jeton de signature
// ---------------------------------------------------------------------------

/**
 * Produit un lien de signature opaque, à envoyer par WhatsApp ou SMS.
 * La valeur en clair n'est retournée qu'ICI, une seule fois : la base ne
 * conserve que son condensat, si bien qu'une fuite de la base ne permet pas
 * de signer à la place du client.
 */
export async function creerJetonSignature(contractId: string): Promise<string> {
  const contrat = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { statut: true },
  });

  // Un lien est délivré à chaque signataire DISTANT, à son tour : le client
  // d'abord, le témoin ensuite. Le gérant, lui, signe depuis sa session.
  if (contrat.statut !== "A_SIGNER_CLIENT" && contrat.statut !== "A_SIGNER_TEMOIN") {
    throw new ErreurSignature(
      `Aucun lien de signature n'est possible pour un contrat en statut ${contrat.statut}.`,
    );
  }

  const jeton = randomBytes(32).toString("base64url");

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      signTokenHash: sha256(Buffer.from(jeton)),
      signTokenExp: new Date(Date.now() + DUREE_JETON_HEURES * 3_600_000),
    },
  });

  return jeton;
}

/** Retrouve le contrat visé par un lien de signature, ou explique le refus. */
export async function contratParJeton(jeton: string) {
  if (!jeton) throw new ErreurSignature("Lien de signature invalide.");

  const contrat = await prisma.contract.findFirst({
    where: { signTokenHash: sha256(Buffer.from(jeton)) },
    include: {
      reservation: {
        include: {
          customer: {
            select: {
              id: true,
              userId: true,
              user: { select: { telephone: true, email: true, nomAffichage: true } },
            },
          },
          boutique: { select: { id: true, representantNom: true } },
        },
      },
      signatures: { select: { role: true } },
    },
  });

  if (!contrat) throw new ErreurSignature("Ce lien de signature n'est pas valide.");

  if (!contrat.signTokenExp || contrat.signTokenExp <= new Date()) {
    throw new ErreurSignature(
      "Ce lien de signature a expiré. Demandez-en un nouveau à votre boutique.",
    );
  }

  if (contrat.statut !== "A_SIGNER_CLIENT") {
    throw new ErreurSignature("Ce contrat a déjà été signé.");
  }

  return contrat;
}

// ---------------------------------------------------------------------------
// Apposition d'une signature
// ---------------------------------------------------------------------------

export interface ContexteSignature {
  contractId: string;
  role: RoleSignataire;
  signataireUserId: string;
  /** Figé au moment de signer : le nom peut changer, la preuve non. */
  signataireNom: string;
  /** Tracé issu du canevas, en PNG. */
  signaturePng: Buffer;
  ip: string;
  userAgent: string;
  otpVerifie: boolean;
  otpCanal?: CanalOtp;
  /** Identifiant qui a reçu le code : l'un OU l'autre. */
  telephone?: string;
  email?: string;
  /** Mention manuscrite saisie, exigée par la formule avec engagement. */
  mention?: string;
}

export async function apposerSignature(ctx: ContexteSignature) {
  const contrat = await prisma.contract.findUniqueOrThrow({
    where: { id: ctx.contractId },
    include: { signatures: { select: { role: true } } },
  });

  // ── Ordre et prérequis ───────────────────────────────────────────────────
  // Le client signe, puis le témoin reconnaît avoir pris connaissance de
  // l'acte, puis la boutique contresigne. L'ordre n'est pas décoratif : le
  // témoin ne peut attester d'un contrat que le client n'a pas encore accepté.
  const ETAT_ATTENDU = {
    CLIENT: "A_SIGNER_CLIENT",
    TEMOIN: "A_SIGNER_TEMOIN",
    GERANT: "A_SIGNER_GERANT",
  } as const;

  const attendu = ETAT_ATTENDU[ctx.role];
  if (contrat.statut !== attendu) {
    throw new ErreurSignature(
      `Signature ${ctx.role.toLowerCase()} refusée : le contrat est en statut ${contrat.statut}.`,
    );
  }

  if (contrat.signatures.some((s) => s.role === ctx.role)) {
    throw new ErreurSignature("Ce contrat porte déjà votre signature.");
  }

  // L'OTP est le maillon qui relie le tracé à une personne. Exigé du client ET
  // du témoin, tous deux signataires à distance : sans lui, leur tracé serait
  // un dessin à côté d'un nom. Le gérant, lui, signe depuis une session
  // authentifiée sur son propre poste.
  if (ctx.role !== "GERANT" && !ctx.otpVerifie) {
    throw new ErreurSignature("Code de vérification non validé — signature refusée.");
  }

  const snapshot = contrat.donnees as unknown as SnapshotContrat;
  // Qui doit signer après le client : le témoin s'il en existe un, la boutique
  // sinon. Un acte produit avant l'introduction du témoin — ou généré sans en
  // désigner — ne doit pas rester bloqué à attendre une signature que personne
  // ne peut apposer.
  const apresClient = snapshot.temoinNom ? ("A_SIGNER_TEMOIN" as const) : ("A_SIGNER_GERANT" as const);


  if (ctx.role === "CLIENT" && snapshot.avecEngagement) {
    const saisie = (ctx.mention ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    if (saisie !== MENTION_ENGAGEMENT.toLowerCase()) {
      throw new ErreurSignature(
        `Recopiez exactement la mention : « ${MENTION_ENGAGEMENT} »`,
      );
    }
  }

  // ── Incrustation dans le PDF ─────────────────────────────────────────────
  const source = contrat.pdfSignedPath ?? contrat.pdfDraftPath;
  if (!source) throw new ErreurSignature("Le contrat n'a pas encore été établi.");

  const emplacements = contrat.emplacementsSignature as unknown as {
    client: EmplacementSignature;
    gerant: EmplacementSignature;
  } | null;

  if (!emplacements) {
    throw new ErreurSignature("Emplacements de signature introuvables — régénérez le contrat.");
  }

  const cible = ctx.role === "CLIENT" ? emplacements.client : emplacements.gerant;

  const pdf = await PDFDocument.load((await lireBlob(source)).octets);
  const page = pdf.getPages()[cible.page];
  if (!page) throw new ErreurSignature("Page de signature introuvable dans le document.");

  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const image = await pdf.embedPng(ctx.signaturePng);
  const signeLe = new Date();

  // Le tracé est mis à l'échelle sans déformation, et centré dans son cadre.
  const dimensions = image.scaleToFit(cible.largeur, cible.hauteur);
  page.drawImage(image, {
    x: cible.x + (cible.largeur - dimensions.width) / 2,
    y: cible.y,
    width: dimensions.width,
    height: dimensions.height,
  });

  // ── Bloc de traçabilité ──────────────────────────────────────────────────
  // C'est lui qui rend la preuve lisible sur le papier, sans avoir à
  // consulter la base : quiconque tient le PDF voit qui a signé, quand, par
  // quel canal l'identité a été vérifiée, et sur quelle version du document.
  const lignes = [
    `Signé électroniquement par ${ctx.signataireNom}`,
    `le ${horodatageFr(signeLe)} (heure de Dakar)`,
    ctx.otpVerifie
      ? `Identité vérifiée par code à usage unique${ctx.otpCanal ? ` (${ctx.otpCanal})` : ""}`
      : "",
    `Réf. ${contrat.reference} — empreinte SHA-256 du document présenté :`,
    contrat.hashDraft ?? "",
  ].filter(Boolean);

  let y = cible.y - 9;
  for (const ligne of lignes) {
    page.drawText(securiser(ligne), {
      x: cible.x,
      y,
      size: 5.5,
      font: police,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 7;
  }

  const octets = await pdf.save();
  const empreinte = sha256(octets);

  const cheminPdf = `contrats/${contrat.reference}/signe-${ctx.role.toLowerCase()}-${empreinte.slice(0, 12)}.pdf`;
  await ecrireBlob(cheminPdf, octets, "application/pdf");

  const cheminTrace = `signatures/${contrat.reference}/${ctx.role.toLowerCase()}-${Date.now()}.png`;
  const { sha256: empreinteTrace } = await ecrireBlob(
    cheminTrace,
    new Uint8Array(ctx.signaturePng),
    "image/png",
  );

  // ── Enregistrement ───────────────────────────────────────────────────────
  await prisma.$transaction([
    prisma.signature.create({
      data: {
        contractId: contrat.id,
        role: ctx.role,
        signataireUserId: ctx.signataireUserId,
        signataireNom: ctx.signataireNom,
        imagePath: cheminTrace,
        imageSha256: empreinteTrace,
        signedAt: signeLe,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        otpVerifie: ctx.otpVerifie,
        otpCanal: ctx.otpCanal,
        telephone: ctx.telephone,
        email: ctx.email,
      },
    }),
    prisma.contract.update({
      where: { id: contrat.id },
      data: {
        pdfSignedPath: cheminPdf,
        hashSigned: empreinte,
        // Qui doit signer ensuite. Le client passe la main au témoin, le
        // témoin à la boutique, et la contre-signature du gérant scelle.
        statut: ctx.role === "CLIENT" ? apresClient : ctx.role === "TEMOIN" ? "A_SIGNER_GERANT" : "SIGNE",
        // Le lien est CONSOMMÉ dès qu'il a servi, pour les deux signataires
        // distants. Celui du témoin est créé séparément, par le flux qui le
        // lui envoie : aucun lien ne survit à la signature qu'il a permise.
        ...(ctx.role === "GERANT" ? {} : { signTokenHash: null, signTokenExp: null }),
      },
    }),
    prisma.contractEvent.create({
      data: {
        contractId: contrat.id,
        type: `SIGNE_${ctx.role}`,
        acteurUserId: ctx.signataireUserId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: {
          empreinte,
          otpVerifie: ctx.otpVerifie,
          otpCanal: ctx.otpCanal ?? null,
          mentionSaisie: ctx.role === "CLIENT" && snapshot.avecEngagement ? true : undefined,
        },
      },
    }),
  ]);

  // La contre-signature du gérant clôt la séquence : on scelle dans la foulée.
  if (ctx.role === "GERANT") return scellerContrat(contrat.id, ctx.signataireUserId);

  return {
    statut: ctx.role === "CLIENT" ? apresClient : ("A_SIGNER_GERANT" as const),
    empreinte,
    chemin: cheminPdf,
  };
}

// ---------------------------------------------------------------------------
// Scellement
// ---------------------------------------------------------------------------

/**
 * Verrouille l'acte une fois les deux signatures réunies, et bascule la
 * réservation en attente de retrait.
 *
 * Le scellement actuel repose sur l'aplatissement, les métadonnées et
 * l'empreinte finale conservée en base. Pour rendre toute retouche détectable
 * par n'importe quel lecteur PDF, l'étape suivante serait une signature PAdES
 * (`@signpdf/signpdf` avec un certificat P12 serveur) — non requise ici, la
 * charge probatoire reposant sur la vérification physique de la pièce au retrait.
 */
export async function scellerContrat(contractId: string, acteurUserId?: string) {
  const contrat = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { signatures: true },
  });

  if (contrat.signatures.length !== 2) {
    throw new ErreurSignature(
      "Scellement impossible : les deux signatures ne sont pas réunies.",
    );
  }

  const pdf = await PDFDocument.load((await lireBlob(contrat.pdfSignedPath!)).octets);

  // Aucun champ de formulaire n'est produit par notre composition, mais on
  // aplatit par principe : un document rescellé plus tard pourrait en porter.
  try {
    pdf.getForm().flatten();
  } catch {
    // Pas de formulaire dans ce document — rien à aplatir.
  }

  pdf.setTitle(`Contrat ${contrat.reference} — La Mother Express`);
  pdf.setProducer("La Mother Express");
  pdf.setSubject(`Contrat signé électroniquement — réf. ${contrat.reference}`);
  pdf.setKeywords([contrat.reference, "signé électroniquement", "La Mother Express"]);
  pdf.setModificationDate(new Date());

  const octets = await pdf.save();
  const empreinte = sha256(octets);
  const chemin = `contrats/${contrat.reference}/final-${empreinte.slice(0, 12)}.pdf`;
  await ecrireBlob(chemin, octets, "application/pdf");

  const expireLe = new Date(Date.now() + 7 * 24 * 3_600_000);

  const scelleLe = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: { pdfSignedPath: chemin, hashSigned: empreinte, statut: "EN_ATTENTE_RETRAIT" },
    });

    const reservation = await tx.reservation.update({
      where: { id: contrat.reservationId },
      data: {
        statut: "EN_ATTENTE_RETRAIT",
        // Passé ce délai sans retrait, un cron libérera la moto (lot 7).
        expireLe,
        // Le suivi des versements part d'ici, jamais avant la mise en service
        // du suivi : on ne réclame pas un arriéré qu'on n'a pas enregistré.
        suiviDepuis: debutDuSuiviPour(scelleLe),
      },
      select: { id: true, formule: true, montantTotal: true },
    });

    await tx.contractEvent.create({
      data: {
        contractId,
        type: "SCELLE",
        acteurUserId,
        metadata: { empreinte, expireLe: expireLe.toISOString() },
      },
    });

    // L'échéancier est figé dans la MÊME transaction que le scellement : un
    // acte scellé sans échéancier laisserait un dossier impossible à encaisser.
    await creerEcheancier(tx, {
      reservationId: reservation.id,
      formule: reservation.formule,
      montantTotal: reservation.montantTotal,
      scelleLe,
    });
  });

  return { statut: "EN_ATTENTE_RETRAIT" as const, empreinte, chemin };
}

// ---------------------------------------------------------------------------
// Piste d'audit
// ---------------------------------------------------------------------------

/** Journalise une consultation ou une lecture intégrale de l'acte. */
export async function journaliser(
  contractId: string,
  type: "OUVERT" | "LU_INTEGRALEMENT" | "OTP_ENVOYE" | "OTP_VALIDE",
  contexte: { acteurUserId?: string; ip?: string; userAgent?: string } = {},
) {
  await prisma.contractEvent.create({
    data: {
      contractId,
      type,
      acteurUserId: contexte.acteurUserId,
      ip: contexte.ip,
      userAgent: contexte.userAgent,
    },
  });
}
