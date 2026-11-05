/**
 * Retrait du véhicule en boutique.
 *
 * ── L'étape qui lève la condition suspensive ───────────────────────────────
 * La signature en ligne ne vaut PAS vérification d'identité : c'est ici, en
 * boutique, que le gérant confronte l'original de la pièce à la copie
 * transmise. Tant que ce contrôle n'a pas eu lieu, le véhicule ne sort pas.
 * Si la pièce ne correspond pas, le contrat devient caduc et la moto retourne
 * au stock.
 *
 * ── Le constat de remise ───────────────────────────────────────────────────
 * C'est lui qui protège réellement en cas de litige sur l'état du véhicule,
 * bien plus que le contrat. Il n'est donc pas accessoire : sans photos, pas
 * de remise.
 */

import { prisma } from "@/lib/prisma";
import { ecrireBlob, lireBlob, sha256 } from "@/lib/storage";
import { dateCourte, horodatageFr } from "@/lib/formatters";
import { composerConstatRemise, VERSION_CONSTAT } from "@/lib/contrats/pv-remise";
import type { SnapshotContrat } from "@/lib/contrats/snapshot";
import type { Utilisateur } from "@/lib/auth";
import type {
  AngleHandover,
  EtatAccessoires,
  EtatElement,
} from "@/generated/prisma";

/** Sans photos, le constat ne vaut rien en cas de litige. */
const PHOTOS_MINIMUM = 4;

export class ErreurRetrait extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurRetrait";
  }
}

/** Restreint la recherche à la boutique du gérant. */
function perimetre(gerant: Utilisateur) {
  return gerant.role === "ADMIN" ? {} : { boutiqueId: gerant.boutiqueId ?? "__aucune__" };
}

// ---------------------------------------------------------------------------
// Chargement de l'écran de retrait
// ---------------------------------------------------------------------------

export async function chargerRetrait(gerant: Utilisateur, reservationId: string) {
  const r = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(gerant) },
    include: {
      customer: {
        include: {
          user: { select: { telephone: true } },
          documents: {
            where: { purgeAt: null, type: { in: ["PIECE_RECTO", "PIECE_VERSO"] } },
            select: { id: true, type: true, mimeType: true },
          },
        },
      },
      produit: { select: { nom: true, modele: true } },
      vehicule: { select: { id: true, numeroChassis: true, immatriculation: true } },
      contract: {
        select: {
          id: true,
          reference: true,
          statut: true,
          // Tracés déjà apposés sur l'acte : ils servent de référence au gérant
          // au moment où le client signe le constat sur son téléphone.
          signatures: { select: { role: true, signataireNom: true, signedAt: true } },
        },
      },
      handover: { include: { photos: { select: { id: true, angle: true } } } },
      boutique: { select: { code: true, store: { select: { name: true } } } },
    },
  });

  if (!r) return null;

  return {
    id: r.id,
    reference: r.reference,
    statut: r.statut,
    formule: r.formule,
    dureeMois: r.dureeMois,
    boutique: r.boutique.store.name,

    client: {
      nomComplet:
        r.customer.nom && r.customer.prenom
          ? `${r.customer.nom.toUpperCase()} ${r.customer.prenom}`
          : "Dossier sans nom",
      numeroPiece: r.customer.numeroPiece,
      typePiece: r.customer.typePiece,
      telephone: r.customer.user.telephone ?? r.customer.telephoneContact,
      documents: r.customer.documents,
    },

    produit: r.produit.nom,
    vehicule: r.vehicule,
    contrat: r.contract,
    handover: r.handover,
  };
}

export type DetailRetrait = NonNullable<Awaited<ReturnType<typeof chargerRetrait>>>;

// ---------------------------------------------------------------------------
// Vérification de la pièce d'identité
// ---------------------------------------------------------------------------

/**
 * Confrontation de l'original avec la copie enregistrée.
 *
 * C'est l'acte qui engage nominativement le gérant : la décision est
 * horodatée et lui est attribuée. En cas de non-conformité, la mécanique de
 * caducité se déclenche entièrement, sans intervention supplémentaire.
 */
export async function verifierPiece(params: {
  gerant: Utilisateur;
  reservationId: string;
  conforme: boolean;
  motifRefus?: string;
  ip: string;
}) {
  const { gerant, reservationId, conforme, ip } = params;
  const motifRefus = params.motifRefus?.trim() ?? "";

  if (!conforme && motifRefus.length < 10) {
    throw new ErreurRetrait(
      "Indiquez en quoi la pièce ne correspond pas : ce motif est conservé comme preuve.",
    );
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(gerant) },
    include: { contract: { select: { id: true } } },
  });

  if (!reservation) throw new ErreurRetrait("Réservation introuvable.");

  if (reservation.statut !== "EN_ATTENTE_RETRAIT") {
    throw new ErreurRetrait(
      `Retrait impossible : la réservation est en statut ${reservation.statut}.`,
    );
  }

  const verifieeAt = new Date();

  const handover = await prisma.handover.upsert({
    where: { reservationId },
    create: {
      reservationId,
      gerantUserId: gerant.id,
      gerantNom: gerant.nomAffichage ?? "Gérant",
      pieceVerifiee: true,
      pieceConforme: conforme,
      pieceMotifRefus: conforme ? null : motifRefus,
      pieceVerifieeAt: verifieeAt,
      statut: conforme ? "EN_ATTENTE" : "PIECE_REFUSEE",
    },
    update: {
      gerantUserId: gerant.id,
      gerantNom: gerant.nomAffichage ?? "Gérant",
      pieceVerifiee: true,
      pieceConforme: conforme,
      pieceMotifRefus: conforme ? null : motifRefus,
      pieceVerifieeAt: verifieeAt,
      statut: conforme ? "EN_ATTENTE" : "PIECE_REFUSEE",
    },
  });

  // Pièce non conforme : le contrat tombe, la moto repart au stock, et le
  // DOSSIER DU CLIENT est rejeté.
  //
  // Ce dernier point est une décision d'Alexandre (2026-09-29) : sans lui, le
  // KYC restait VALIDE et le client pouvait reprendre une réservation aussitôt
  // — laquelle partait directement en « contrat à établir », sautant la
  // vérification. Le doute porte sur la personne, pas sur un contrat.
  if (!conforme) {
    const motifClient =
      `Pièce d'identité non conforme lors de la présentation en boutique : ${motifRefus}`;

    await prisma.$transaction([
      prisma.reservation.update({ where: { id: reservationId }, data: { statut: "CADUQUE" } }),

      prisma.customer.update({
        where: { id: reservation.customerId },
        data: {
          statutKyc: "REJETE",
          kycMotifRejet: motifClient,
          kycVerifiePar: gerant.id,
          kycVerifieAt: verifieeAt,
        },
      }),

      // Ses autres dossiers en attente de validation repartent en attente de
      // pièces, comme après un rejet ordinaire : ils ne peuvent pas être
      // validés sur une identité mise en doute.
      prisma.reservation.updateMany({
        where: { customerId: reservation.customerId, statut: "EN_ATTENTE_VALIDATION" },
        data: { statut: "EN_ATTENTE_DOSSIER" },
      }),
      ...(reservation.contract
        ? [
            prisma.contract.update({
              where: { id: reservation.contract.id },
              data: { statut: "CADUC" },
            }),
          ]
        : []),
      ...(reservation.vehiculeId
        ? [
            prisma.vehicule.update({
              where: { id: reservation.vehiculeId },
              data: { statut: "DISPONIBLE" },
            }),
          ]
        : []),
    ]);
  }

  if (reservation.contract) {
    await prisma.contractEvent.create({
      data: {
        contractId: reservation.contract.id,
        type: "PIECE_VERIFIEE",
        acteurUserId: gerant.id,
        ip,
        metadata: {
          conforme,
          motif: conforme ? null : motifRefus,
          gerant: gerant.nomAffichage ?? gerant.id,
        },
      },
    });
  }

  return handover;
}

// ---------------------------------------------------------------------------
// Photos de l'état des lieux
// ---------------------------------------------------------------------------

export async function ajouterPhoto(params: {
  gerant: Utilisateur;
  reservationId: string;
  angle: AngleHandover;
  octets: Uint8Array;
  mimeType: string;
}) {
  const { gerant, reservationId, angle, octets, mimeType } = params;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(gerant) },
    select: { id: true, reference: true, handover: { select: { id: true, statut: true } } },
  });

  if (!reservation?.handover) {
    throw new ErreurRetrait("Vérifiez d'abord la pièce d'identité du client.");
  }
  if (reservation.handover.statut === "COMPLETE") {
    throw new ErreurRetrait("Le constat est déjà établi — il ne peut plus être modifié.");
  }

  const chemin = `retraits/${reservation.reference}/${angle.toLowerCase()}-${Date.now()}.jpg`;
  const { sha256: empreinte } = await ecrireBlob(chemin, octets, mimeType);

  // Un angle ne peut être photographié qu'une fois : reprendre une photo
  // remplace la précédente plutôt que d'empiler des doublons.
  const existante = await prisma.handoverPhoto.findFirst({
    where: { handoverId: reservation.handover.id, angle },
    select: { id: true },
  });

  if (existante) {
    await prisma.handoverPhoto.update({
      where: { id: existante.id },
      data: { blobPath: chemin, sha256: empreinte, prisAt: new Date() },
    });
  } else {
    await prisma.handoverPhoto.create({
      data: { handoverId: reservation.handover.id, angle, blobPath: chemin, sha256: empreinte },
    });
  }

  return { angle, chemin };
}

// ---------------------------------------------------------------------------
// Constat de remise et sortie du véhicule
// ---------------------------------------------------------------------------

export interface SaisieConstat {
  compteurKm: number | null;
  heureRemise: string;
  niveauBatterie: number | null;
  carrosserie: EtatElement;
  freinsPneus: EtatElement;
  batterieChargeur: EtatElement;
  accessoires: EtatAccessoires;
  accessoiresPrecision?: string;
  casqueRemis: boolean;
  chargeurRemis: boolean;
  observations?: string;
}

export async function enregistrerConstat(params: {
  gerant: Utilisateur;
  reservationId: string;
  saisie: SaisieConstat;
  ip: string;
}) {
  const { gerant, reservationId, saisie, ip } = params;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(gerant) },
    include: {
      customer: { include: { user: { select: { telephone: true } } } },
      produit: { select: { marque: true, modele: true } },
      vehicule: { select: { id: true, numeroChassis: true } },
      contract: {
        select: {
          id: true,
          reference: true,
          donnees: true,
          // Les tracés du contrat sont repris sur le constat : le client ne
          // resigne pas devant la moto, il a signé l'acte.
          signatures: { select: { role: true, imagePath: true, signedAt: true } },
        },
      },
      handover: { include: { photos: true } },
    },
  });

  if (!reservation) throw new ErreurRetrait("Réservation introuvable.");
  if (reservation.statut !== "EN_ATTENTE_RETRAIT") {
    throw new ErreurRetrait(`Retrait impossible : réservation en statut ${reservation.statut}.`);
  }

  const handover = reservation.handover;
  if (!handover?.pieceVerifiee) {
    throw new ErreurRetrait("Vérifiez d'abord l'original de la pièce d'identité.");
  }
  if (handover.pieceConforme !== true) {
    throw new ErreurRetrait("La pièce a été déclarée non conforme : le contrat est caduc.");
  }
  if (handover.statut === "COMPLETE") {
    throw new ErreurRetrait("Ce retrait a déjà été enregistré.");
  }
  if (handover.photos.length < PHOTOS_MINIMUM) {
    throw new ErreurRetrait(
      `Prenez au moins ${PHOTOS_MINIMUM} photos du véhicule — c'est ce qui vous protège en cas de litige.`,
    );
  }

  // Les signatures sont contrôlées EN DERNIER : si le contrat est caduc ou le
  // retrait déjà fait, le gérant doit lire cette raison-là, pas un reproche
  // sur une signature introuvable.
  const tracés = {
    gerant: reservation.contract?.signatures.find((s) => s.role === "GERANT"),
    client: reservation.contract?.signatures.find((s) => s.role === "CLIENT"),
  };

  if (!tracés.gerant || !tracés.client) {
    throw new ErreurRetrait(
      "Les signatures du contrat sont introuvables : le constat les reprend, il ne peut pas s'en passer.",
    );
  }

  // Les photos sont relues depuis le stockage pour être incrustées au constat.
  const photos = await Promise.all(
    handover.photos
      .sort((a, b) => a.angle.localeCompare(b.angle))
      .map(async (p) => {
        const blob = await lireBlob(p.blobPath);
        return { octets: blob.octets, mimeType: blob.mimeType, legende: libelleAngle(p.angle) };
      }),
  );

  const snapshot = reservation.contract?.donnees as unknown as SnapshotContrat | undefined;
  const maintenant = new Date();

  // Le constat identifie le véhicule et le client EXACTEMENT comme le contrat
  // signé : un numéro de série différent d'un document à l'autre suffirait à
  // contester que la moto remise est celle du contrat. Les données vivantes
  // ne servent qu'en l'absence de contrat.
  const constat = await composerConstatRemise({
    reference: reservation.reference,
    formule: reservation.formule,
    dureeMois: reservation.dureeMois,
    vehiculeMarqueModele:
      snapshot?.vehiculeMarqueModele ??
      `${reservation.produit.marque} / ${reservation.produit.modele}`,
    vehiculeNumeroSerie:
      snapshot?.vehiculeNumeroSerie ?? reservation.vehicule?.numeroChassis ?? "Néant",
    clientNomComplet:
      snapshot?.clientNomComplet ??
      `${reservation.customer.nom?.toUpperCase() ?? ""} ${reservation.customer.prenom ?? ""}`.trim(),
    clientNumeroPiece: snapshot?.clientNumeroPiece ?? reservation.customer.numeroPiece ?? "-",
    clientTelephone:
      snapshot?.clientTelephone ??
      reservation.customer.user.telephone ??
      reservation.customer.telephoneContact ??
      "Néant",
    // Le gérant connecté est celui qui remet la moto et signe pour le Bailleur ;
    // `gerantNom` est celui qui a contrôlé la pièce — le plus souvent le même,
    // pas nécessairement.
    bailleurSignataire: gerant.nomAffichage ?? handover.gerantNom,
    pieceVerifieePar: handover.gerantNom,
    pieceVerifieeLe: handover.pieceVerifieeAt ? horodatageFr(handover.pieceVerifieeAt) : null,
    signaturesReprisesDu: reservation.contract
      ? `Signatures reprises du contrat ${reservation.contract.reference}, signé le ${dateCourte(tracés.client.signedAt)}.`
      : null,

    dateRemise: dateCourte(maintenant),
    heureRemise: saisie.heureRemise,
    compteurKm: saisie.compteurKm,
    carrosserie: saisie.carrosserie,
    freinsPneus: saisie.freinsPneus,
    batterieChargeur: saisie.batterieChargeur,
    accessoires: saisie.accessoires,
    accessoiresPrecision: saisie.accessoiresPrecision ?? null,
    observations: saisie.observations ?? null,
    photos,
  });

  // Les deux tracés viennent du contrat, relus depuis le stockage chiffré.
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(constat.octets);

  for (const [trace, cible] of [
    [tracés.gerant, constat.emplacements.bailleur],
    [tracés.client, constat.emplacements.locataire],
  ] as const) {
    const page = pdf.getPages()[cible.page];
    if (!page) continue;

    const image = await pdf.embedPng((await lireBlob(trace.imagePath)).octets);
    const dims = image.scaleToFit(cible.largeur, cible.hauteur);
    page.drawImage(image, {
      x: cible.x + (cible.largeur - dims.width) / 2,
      y: cible.y,
      width: dims.width,
      height: dims.height,
    });
  }

  const octets = await pdf.save();
  const empreinte = sha256(octets);
  const cheminPv = `retraits/${reservation.reference}/constat-remise-${empreinte.slice(0, 12)}.pdf`;
  await ecrireBlob(cheminPv, octets, "application/pdf");

  // Aucun fichier de signature n'est recopié : le constat pointe vers les
  // tracés du contrat, qui sont l'original.
  const cheminSigGerant = tracés.gerant.imagePath;
  const cheminSigClient = tracés.client.imagePath;

  await prisma.$transaction([
    prisma.handover.update({
      where: { id: handover.id },
      data: {
        compteurKm: saisie.compteurKm,
        heureRemise: saisie.heureRemise,
        niveauBatterie: saisie.niveauBatterie,
        carrosserie: saisie.carrosserie,
        freinsPneus: saisie.freinsPneus,
        batterieChargeur: saisie.batterieChargeur,
        accessoires: saisie.accessoires,
        accessoiresPrecision: saisie.accessoiresPrecision,
        casqueRemis: saisie.casqueRemis,
        chargeurRemis: saisie.chargeurRemis,
        observations: saisie.observations,
        pvPdfPath: cheminPv,
        pvHashSigned: empreinte,
        signatureGerantPath: cheminSigGerant,
        signatureClientPath: cheminSigClient,
        statut: "COMPLETE",
        completedAt: maintenant,
      },
    }),

    // Le véhicule est sorti : la location commence.
    prisma.reservation.update({
      where: { id: reservationId },
      data: { statut: "ACTIVE", expireLe: null },
    }),

    ...(reservation.vehiculeId
      ? [
          prisma.vehicule.update({
            where: { id: reservation.vehiculeId },
            data: { statut: "EN_LOCATION" },
          }),
        ]
      : []),

    ...(reservation.contract
      ? [
          prisma.contract.update({
            where: { id: reservation.contract.id },
            data: { statut: "RETIRE" },
          }),
          prisma.contractEvent.create({
            data: {
              contractId: reservation.contract.id,
              type: "RETIRE",
              acteurUserId: gerant.id,
              ip,
              metadata: {
                empreintePv: empreinte,
                // Rédaction du constat effectivement signée par les deux parties.
                versionConstat: VERSION_CONSTAT,
                photos: handover.photos.length,
                compteurKm: saisie.compteurKm,
              },
            },
          }),
        ]
      : []),
  ]);

  return { cheminPv, empreinte, pages: constat.pages };
}

const LIBELLES_ANGLE: Record<AngleHandover, string> = {
  AVANT: "Avant",
  ARRIERE: "Arrière",
  GAUCHE: "Côté gauche",
  DROITE: "Côté droit",
  COMPTEUR: "Compteur",
  CHASSIS: "Numéro de châssis",
};

export function libelleAngle(angle: AngleHandover): string {
  return LIBELLES_ANGLE[angle];
}

export const ANGLES_ATTENDUS: AngleHandover[] = [
  "AVANT",
  "ARRIERE",
  "GAUCHE",
  "DROITE",
  "COMPTEUR",
  "CHASSIS",
];
