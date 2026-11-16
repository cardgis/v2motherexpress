/**
 * LE PARCOURS COMPLET — d'un numéro inconnu à une moto livrée.
 *
 *   SMS_DRIVER=console npm run dev        (dans un autre terminal)
 *   npm run e2e:parcours
 *
 * ── Pourquoi ce script existe ──────────────────────────────────────────────
 * Seize contrôles éprouvent chaque brique séparément — la tarification, les
 * actes, l'annulation, la concurrence, les versements, la purge. `e2e.ts`
 * vérifie que chaque écran se rend. Mais AUCUN ne joue la chaîne : un client
 * qui arrive sans compte, dépose ses pièces, attend la validation du gérant,
 * signe par code, et repart avec la moto. Or c'est dans les jointures que les
 * parcours cassent — un statut qui ne bascule pas, un contrat qui refuse de
 * se transmettre, une pièce qu'on ne retrouve plus au retrait.
 *
 * Ici, rien n'est simulé : chaque étape passe par la MÊME route HTTP que le
 * navigateur, avec un vrai cookie de session, dans l'ordre réel.
 *
 * ── LE SERVEUR DOIT TOURNER AVEC `SMS_DRIVER=console` ──────────────────────
 * Le code OTP est haché en base (HMAC) : un script ne peut pas le relire. Avec
 * le pilote `console`, l'API le renvoie dans sa réponse — c'est prévu pour le
 * développement, et c'est ce qui permet de jouer la connexion et la signature
 * POUR DE VRAI au lieu de les contourner. Sans ce pilote, chaque étape
 * enverrait un SMS facturé à un numéro fictif : le script s'arrête donc à la
 * première réponse sans code, avant d'en envoyer un second.
 *
 * Seule la session du GÉRANT est forgée, par `creerJeton` — la fonction
 * qu'emploie la connexion réelle. Le back-office n'est pas le sujet du test.
 *
 * ── Données TEMPORAIRES, supprimées à la fin MÊME EN CAS D'ÉCHEC ───────────
 * Le numéro utilisé est hors des plages attribuées au Sénégal, et tout ce qui
 * est créé — compte, dossier, pièces, réservation, contrat, constat, blobs —
 * est effacé dans le `finally`. Un échec au milieu ne laisse donc pas de
 * dossier fantôme derrière lui.
 */

// `.env.local` UNIQUEMENT : ce script écrit en base.
import "./env-local";

import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { creerJeton, SESSION_COOKIE } from "../src/lib/auth";
import { supprimerBlob } from "../src/lib/storage";
import { OFFRES_ACCESSION } from "../src/lib/offres";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Un numéro NEUF à chaque exécution, dans une plage hors de celles réellement
 * attribuées : aucun abonné ne le porte.
 *
 * Pourquoi neuf, et pas constant : le quota anti-abus autorise 3 codes par
 * destinataire et par quart d’heure (`lib/otp.ts`), et un parcours en
 * consomme 2 — un pour la connexion, un pour la signature. Avec un numéro
 * fixe, la deuxième exécution d’affilée se heurtait à un 429 parfaitement
 * justifié. La protection n’est pas contournée : elle est simplement jouée
 * par un client différent, comme dans la réalité.
 */
const TELEPHONE = `+2217000${String(Date.now() % 100000).padStart(5, "0")}`;

/** Tous les numéros que ce script a pu créer, pour le ménage de fin. */
const PLAGE_TEST = "+2217000";

let ok = 0;
let ko = 0;

function etape(bon: boolean, libelle: string, detail?: string) {
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  // Le détail n'explique qu'un ÉCHEC : l'afficher sous les lignes qui passent
  // noierait les deux qui ne passent pas.
  if (!bon && detail) console.log(`         ${detail}`);
  return bon;
}

class Arret extends Error {}

/** Un appel HTTP qui porte sa session, comme le ferait un navigateur. */
async function appel(
  cookie: string | null,
  chemin: string,
  options: { methode?: string; corps?: unknown; formulaire?: FormData } = {},
) {
  const entetes: Record<string, string> = {};
  if (cookie) entetes.cookie = cookie;
  if (options.corps !== undefined) entetes["content-type"] = "application/json";

  const reponse = await fetch(`${BASE}${chemin}`, {
    method: options.methode ?? (options.corps !== undefined || options.formulaire ? "POST" : "GET"),
    headers: entetes,
    body: options.formulaire ?? (options.corps !== undefined ? JSON.stringify(options.corps) : undefined),
    redirect: "manual",
  });

  const texte = await reponse.text();
  let donnees: Record<string, unknown> = {};
  try {
    donnees = JSON.parse(texte) as Record<string, unknown>;
  } catch {
    /* une page HTML, un PDF : le statut suffit */
  }
  return { statut: reponse.status, donnees, texte, reponse };
}

/** L'erreur renvoyée par l'API, pour que le KO dise POURQUOI. */
const pourquoi = (r: { statut: number; donnees: Record<string, unknown> }) =>
  `HTTP ${r.statut} — ${String(r.donnees.error ?? "").slice(0, 120) || "sans message"}`;

/** Une image de pièce, et une trace de signature : de vrais octets. */
async function imageJpeg(texte: string) {
  return sharp({
    create: { width: 900, height: 600, channels: 3, background: { r: 240, g: 240, b: 235 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
    .then((b) => new File([new Uint8Array(b)], `${texte}.jpg`, { type: "image/jpeg" }));
}

async function tracePng() {
  const png = await sharp({
    create: { width: 400, height: 150, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="400" height="150"><path d="M20 110 C 90 20, 150 130, 220 60 S 330 40, 380 90" stroke="#111" stroke-width="4" fill="none"/></svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function main() {
  console.log(`\nParcours complet sur ${BASE}\n`);

  let userId: string | null = null;
  let reservationId: string | null = null;
  // La moto passe EN_LOCATION pendant le parcours. Sans cette mémoire, chaque
  // exécution en retirerait une du parc local DÉFINITIVEMENT : supprimer la
  // réservation ne rend pas le véhicule. Trois motos sur six y étaient déjà
  // passées avant que le contrôle « une moto disponible existe » ne tombe.
  let vehiculeRendu: { id: string; statut: "DISPONIBLE" } | null = null;
  const blobs: string[] = [];

  try {
    // ══ 1. Le client arrive, et n'a pas de compte ══════════════════════════
    console.log("=== 1. Connexion d'un numéro inconnu ===");

    const demande = await appel(null, "/api/auth/otp/demander", {
      corps: { identifiant: TELEPHONE },
    });
    if (!etape(demande.statut === 200, "le code est demandé", pourquoi(demande))) {
      throw new Arret("connexion impossible");
    }

    const code = demande.donnees.codeDeDeveloppement as string | undefined;
    if (!code) {
      etape(false, "le code est lisible par le script", "");
      console.error(
        "\n  Le serveur n'a pas renvoyé de code : il tourne avec un pilote RÉEL.\n" +
          "  Un SMS vient donc de partir, et les étapes suivantes en enverraient d'autres.\n" +
          "  Relancez-le ainsi :  SMS_DRIVER=console npm run dev\n",
      );
      throw new Arret("pilote SMS réel");
    }
    etape(true, `le code est renvoyé par le pilote de développement (${code.length} chiffres)`);

    const verif = await appel(null, "/api/auth/otp/verifier", {
      corps: { identifiant: TELEPHONE, code },
    });
    if (!etape(verif.statut === 200, "le code ouvre une session", pourquoi(verif))) {
      throw new Arret("OTP refusé");
    }

    const brut = verif.reponse.headers.get("set-cookie") ?? "";
    const valeur = brut.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
    if (!valeur) throw new Arret("aucun cookie de session dans la réponse");
    const client = `${SESSION_COOKIE}=${valeur}`;

    etape(verif.donnees.role === "CLIENT", `le compte créé est un CLIENT (${verif.donnees.role})`);
    etape(
      verif.donnees.destination === "/compte",
      `il atterrit dans son espace (${verif.donnees.destination})`,
    );

    const compte = await prisma.user.findUnique({
      where: { telephone: TELEPHONE },
      select: { id: true, telVerifie: true },
    });
    userId = compte?.id ?? null;
    etape(!!compte?.telVerifie, "son téléphone est marqué vérifié en base");

    // ══ 2. Il remplit son dossier ══════════════════════════════════════════
    console.log("\n=== 2. Le dossier ===");

    const dansUnAn = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    const identite = await appel(client, "/api/dossier", {
      methode: "PATCH",
      corps: {
        prenom: "Aminata",
        nom: "Parcours-Test",
        dateNaissance: "1995-04-12",
        lieuNaissance: "Thiès",
        typePiece: "CNI",
        numeroPiece: "1950400123456",
        pieceDateExpiration: dansUnAn,
        adresse: "Cité Malick Sy, villa 12",
        quartier: "Médina",
        ville: "Thiès",
        profession: "Commerçante",
      },
    });
    etape(identite.statut === 200, "l'identité est enregistrée", pourquoi(identite));

    for (const type of ["PIECE_RECTO", "PIECE_VERSO", "JUSTIFICATIF_DOMICILE"]) {
      const formulaire = new FormData();
      formulaire.append("type", type);
      formulaire.append("fichier", await imageJpeg(type));
      const depot = await appel(client, "/api/documents", { formulaire });
      etape(depot.statut === 200 || depot.statut === 201, `la pièce ${type} est déposée`, pourquoi(depot));
    }

    // La compression de la réception doit avoir fait son œuvre.
    const pieces = await prisma.customerDocument.findMany({
      where: { customer: { userId: userId ?? "" } },
      select: { mimeType: true, tailleOctets: true, blobPath: true },
    });
    blobs.push(...pieces.map((p) => p.blobPath));
    etape(
      pieces.length === 3 && pieces.every((p) => p.mimeType === "image/webp"),
      `les 3 pièces sont stockées en WebP (${pieces.map((p) => Math.round(p.tailleOctets / 1024) + " ko").join(", ")})`,
    );

    const soumission = await appel(client, "/api/dossier/soumettre", {
      corps: { consentement: true },
    });
    etape(soumission.statut === 200, "le dossier est soumis à la boutique", pourquoi(soumission));

    // ══ 3. Il réserve ══════════════════════════════════════════════════════
    console.log("\n=== 3. La réservation ===");

    const produit = await prisma.produit.findFirst({
      where: { slug: "revoo-a10", estActif: true },
      select: { id: true, nom: true },
    });
    const boutique = await prisma.boutique.findFirst({
      where: { actif: true },
      select: { id: true, code: true },
    });
    if (!produit || !boutique) throw new Arret("catalogue ou boutique absents de la base locale");

    const offre = Object.entries(OFFRES_ACCESSION)
      .flatMap(([modele, offres]) => offres.map((o) => ({ ...o, modele })))
      .find((o) => !o.avecEngagement);
    if (!offre) throw new Arret("aucune offre d'accession sans engagement");

    const reservation = await appel(client, "/api/reservations", {
      corps: {
        produitId: produit.id,
        boutiqueId: boutique.id,
        formule: "LOCATION_ACCESSION",
        offreCle: offre.cle,
      },
    });
    if (!etape(reservation.statut === 201, `${produit.nom} réservé chez ${boutique.code}`, pourquoi(reservation))) {
      throw new Arret("réservation refusée");
    }
    reservationId = String(reservation.donnees.id ?? "");
    etape(!!reservationId, `la réservation porte une référence (${reservation.donnees.reference ?? "?"})`);

    // ══ 4. Le gérant valide le dossier et affecte une moto ═════════════════
    console.log("\n=== 4. Le gérant ===");

    const gerantUser = await prisma.user.findFirst({
      where: { role: "GERANT", actif: true, boutiqueId: boutique.id },
      select: { id: true, role: true, versionSession: true, nomAffichage: true },
    });
    if (!gerantUser) throw new Arret(`aucun gérant actif pour la boutique ${boutique.code}`);
    const gerant = `${SESSION_COOKIE}=${creerJeton(gerantUser)}`;

    const vehicule = await prisma.vehicule.findFirst({
      where: { boutiqueId: boutique.id, produitId: produit.id, statut: "DISPONIBLE" },
      select: { id: true, immatriculation: true },
    });
    if (!etape(!!vehicule, `une moto disponible existe (${vehicule?.immatriculation ?? "AUCUNE"})`)) {
      throw new Arret("aucune moto disponible dans le parc local — le parcours ne peut pas aller au retrait");
    }
    vehiculeRendu = { id: vehicule!.id, statut: "DISPONIBLE" };

    const customer = await prisma.customer.findFirst({
      where: { userId: userId ?? "" },
      select: { id: true },
    });
    const validation = await appel(gerant, `/api/gerant/dossiers/${customer?.id}`, {
      corps: {
        action: "valider",
        affectations: vehicule ? [{ reservationId, vehiculeId: vehicule.id }] : [],
      },
    });
    etape(validation.statut === 200, "le dossier est validé et la moto affectée", pourquoi(validation));

    // ══ 5. Le contrat ══════════════════════════════════════════════════════
    console.log("\n=== 5. Le contrat ===");

    const brouillon = await appel(gerant, "/api/contrats", { corps: { reservationId } });
    if (!etape(brouillon.statut === 200 || brouillon.statut === 201, "le brouillon est généré", pourquoi(brouillon))) {
      throw new Arret("contrat impossible");
    }
    const contratId = String(brouillon.donnees.id ?? brouillon.donnees.contratId ?? "");
    etape(!!contratId, "le contrat porte un identifiant");

    const transmission = await appel(gerant, `/api/contrats/${contratId}`, {
      corps: { action: "transmettre" },
    });
    if (!etape(transmission.statut === 200, "le contrat est transmis au client", pourquoi(transmission))) {
      throw new Arret("transmission impossible");
    }
    const lien = String(transmission.donnees.lien ?? "");
    const jeton = lien.split("/").pop() ?? "";
    etape(!!jeton, "un lien de signature est émis");

    // ══ 6. Le client signe par code ════════════════════════════════════════
    console.log("\n=== 6. La signature ===");

    const demandeSignature = await appel(null, "/api/signature", {
      corps: { jeton, action: "demander-code" },
    });
    const codeSignature = demandeSignature.donnees.codeDeDeveloppement as string | undefined;
    etape(demandeSignature.statut === 200 && !!codeSignature, "un code de signature est envoyé", pourquoi(demandeSignature));
    if (!codeSignature) throw new Arret("code de signature illisible");

    const trace = await tracePng();
    const signature = await appel(null, "/api/signature", {
      corps: { jeton, action: "signer", code: codeSignature, trace },
    });
    etape(signature.statut === 200, "le client signe", pourquoi(signature));

    const contresignature = await appel(gerant, `/api/contrats/${contratId}`, {
      corps: { action: "contresigner", trace },
    });
    etape(contresignature.statut === 200, "le gérant contresigne", pourquoi(contresignature));

    const contratScelle = await prisma.contract.findUnique({
      where: { id: contratId },
      select: { statut: true, pdfSignedPath: true, signatures: { select: { role: true } } },
    });
    if (contratScelle?.pdfSignedPath) blobs.push(contratScelle.pdfSignedPath);
    etape(
      contratScelle?.signatures.length === 2,
      `le contrat porte les deux signatures (${contratScelle?.signatures.map((s) => s.role).join(" + ")})`,
    );
    etape(!!contratScelle?.pdfSignedPath, `un PDF final est scellé (${contratScelle?.statut})`);

    // ══ 7. Le retrait ══════════════════════════════════════════════════════
    console.log("\n=== 7. Le retrait ===");

    const piece = await appel(gerant, `/api/gerant/retrait/${reservationId}`, {
      corps: { action: "verifier-piece", conforme: true },
    });
    etape(piece.statut === 200, "le gérant confronte la pièce à l'original", pourquoi(piece));

    for (const angle of ["AVANT", "ARRIERE", "GAUCHE", "DROITE"]) {
      const formulaire = new FormData();
      formulaire.append("angle", angle);
      formulaire.append("photo", await imageJpeg(angle));
      const photo = await appel(gerant, `/api/gerant/retrait/${reservationId}/photo`, { formulaire });
      etape(photo.statut === 200 || photo.statut === 201, `photo ${angle}`, pourquoi(photo));
    }

    const constat = await appel(gerant, `/api/gerant/retrait/${reservationId}`, {
      corps: {
        action: "completer",
        heureRemise: "14h30",
        compteurKm: 12,
        niveauBatterie: 95,
        carrosserie: "NEUF",
        freinsPneus: "NEUF",
        batterieChargeur: "NEUF",
        accessoires: "COMPLETS",
        casqueRemis: true,
        chargeurRemis: true,
      },
    });
    etape(constat.statut === 200, "le constat de remise est enregistré", pourquoi(constat));

    // ══ 8. Ce que la base dit, une fois la moto partie ═════════════════════
    console.log("\n=== 8. L'état final ===");

    const finale = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        statut: true,
        vehiculeId: true,
        handover: { select: { completedAt: true, pieceConforme: true, pvPdfPath: true } },
        echeances: { select: { id: true } },
      },
    });
    if (finale?.handover?.pvPdfPath) blobs.push(finale.handover.pvPdfPath);

    etape(finale?.statut === "ACTIVE", `la réservation est ACTIVE (${finale?.statut})`);
    etape(!!finale?.vehiculeId, "une moto lui est bien attachée");
    etape(!!finale?.handover?.completedAt, "la livraison porte une date");
    etape(finale?.handover?.pieceConforme === true, "la pièce est marquée conforme");
    // ZÉRO échéance, et c'est la bonne réponse : en location-accession l'acte prévoit une
    // redevance JOURNALIÈRE, pas des mensualités — le dû se calcule jour par
    // jour (`duADate`). Une vente échelonnée, elle, en poserait cinq. Ce
    // contrôle attendait d'abord un échéancier : c'est lui qui avait tort.
    etape(
      finale?.echeances.length === 0,
      `aucune échéance figée, comme l'accession l'exige (${finale?.echeances.length})`,
      "une vente échelonnée en poserait cinq ; ici le dû court au jour le jour",
    );

    const vehiculeApres = vehicule
      ? await prisma.vehicule.findUnique({ where: { id: vehicule.id }, select: { statut: true } })
      : null;
    etape(
      vehiculeApres?.statut !== "DISPONIBLE",
      `la moto n'est plus proposée à un autre client (${vehiculeApres?.statut})`,
    );

    // Le client voit son contrat, et le gérant aussi.
    const espace = await appel(client, "/compte");
    etape(espace.statut === 200, "le client retrouve son espace");
    const pdf = await appel(client, `/api/contrats/${contratId}/pdf`);
    etape(pdf.statut === 200, "il peut relire son contrat signé");
  } catch (erreur) {
    if (erreur instanceof Arret) console.log(`\n  ARRÊT — ${erreur.message}\n`);
    else throw erreur;
  } finally {
    // ══ Nettoyage — même en cas d'échec ══════════════════════════════════
    console.log("\n=== Nettoyage ===");
    let efface = 0;

    for (const chemin of blobs) {
      await supprimerBlob(chemin)
        .then(() => efface++)
        .catch(() => undefined);
    }

    try {
      // L'ORDRE EST IMPOSÉ PAR LES CLÉS ÉTRANGÈRES, et deux d'entre elles ne
      // sont pas en cascade : `Handover_reservationId_fkey` et
      // `Contract_reservationId_fkey` retiennent la réservation tant qu'on ne
      // les a pas retirées. Les photos du constat et les échéances partent
      // toutes seules, comme le dossier et les pièces quand le compte s'en va.
      if (reservationId) {
        await prisma.handover.deleteMany({ where: { reservationId } });
        await prisma.contract.deleteMany({ where: { reservationId } });
        await prisma.reservation.delete({ where: { id: reservationId } });
      }
      if (userId) await prisma.user.delete({ where: { id: userId } });
      // Et la moto retourne au parc : la réservation effacée ne la libère pas.
      if (vehiculeRendu) {
        await prisma.vehicule.update({
          where: { id: vehiculeRendu.id },
          data: { statut: vehiculeRendu.statut },
        });
      }
      await prisma.otpCode.deleteMany({ where: { destinataire: { startsWith: PLAGE_TEST } } });

      // Balayage de sécurité : si une exécution précédente s’est interrompue
      // avant son nettoyage, son compte traîne encore. On ne laisse pas la
      // base locale se remplir de clients fantômes.
      // Les réservations pendent au CUSTOMER, pas au `User` : c’est par lui
      // qu’il faut passer pour les retrouver.
      const restes = await prisma.user.findMany({
        where: { telephone: { startsWith: PLAGE_TEST } },
        select: { id: true, customer: { select: { reservations: { select: { id: true } } } } },
      });
      for (const reste of restes) {
        for (const r of reste.customer?.reservations ?? []) {
          await prisma.handover.deleteMany({ where: { reservationId: r.id } });
          await prisma.contract.deleteMany({ where: { reservationId: r.id } });
          await prisma.reservation.delete({ where: { id: r.id } });
        }
        await prisma.user.delete({ where: { id: reste.id } });
      }
      if (restes.length > 0) console.log(`         (${restes.length} compte(s) d’une exécution interrompue, balayés)`);
      etape(true, `tout est effacé — compte, dossier, réservation, contrat, ${efface} blob(s)`);
    } catch (erreur) {
      etape(false, "le nettoyage a échoué", erreur instanceof Error ? erreur.message : String(erreur));
      console.error(`\n  À supprimer à la main : user ${userId}, réservation ${reservationId}\n`);
    }
  }

  console.log(`\n${ko === 0 ? "LE PARCOURS COMPLET PASSE" : "DES ÉCARTS"} — ${ok} OK, ${ko} KO\n`);
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

void main();
