/**
 * Purge des pièces d'identité — ce qu'elle efface, et surtout ce qu'elle ÉPARGNE.
 *
 *   npm run verif:purge
 *
 * Éprouve la règle arrêtée par Alexandre le 2026-11-10 : 48 heures après la
 * clôture du dossier, l'image de la pièce est effacée. Sur des données
 * TEMPORAIRES, supprimées à la fin même en cas d'échec.
 *
 * Trois clients synthétiques, pour les trois cas qui comptent :
 *
 *   A — dossier clos depuis LONGTEMPS      la pièce doit être effacée
 *   B — dossier clos à L'INSTANT           programmée, pas encore effacée
 *   C — dossier clos ET un autre EN COURS  épargnée, et c'est le cas crucial
 *
 * Le cas C est la raison d'être de ce fichier. Les pièces appartiennent au
 * CLIENT et non à la réservation : purger à la clôture d'un dossier
 * supprimerait la pièce qu'un autre, encore actif, exige au retrait.
 */

// `.env.local` UNIQUEMENT : ce script écrit et supprime en base.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { purgerPieces } from "../src/lib/purge";
import { ecrireBlob, blobExiste, supprimerBlob } from "../src/lib/storage";

let ok = 0;
let ko = 0;

function verifie(libelle: string, obtenu: unknown, attendu: unknown) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (!bon) console.log(`       attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

const JOUR = 86_400_000;
const marque = `PRG-${Date.now()}`;
const creees: { userId: string; customerId: string; chemin: string }[] = [];

async function champ<T>(id: string, colonne: "purgeAt" | "purgeApres" | "sha256"): Promise<T> {
  const d = await prisma.customerDocument.findUnique({ where: { id }, select: { [colonne]: true } });
  return (d as Record<string, T>)[colonne];
}

/** Un client, sa pièce réellement déposée dans le stockage, et ses dossiers. */
async function client(
  suffixe: string,
  statuts: ("TERMINEE" | "ACTIVE")[],
  clotureIlYa: number,
  boutiqueId: string,
  produitId: string,
) {
  const user = await prisma.user.create({
    data: { nomAffichage: `${marque}-${suffixe}`, email: `${marque}-${suffixe}@test.invalid` },
    select: { id: true },
  });
  const customer = await prisma.customer.create({
    data: { userId: user.id, nom: "TEST", prenom: `${marque}-${suffixe}`, statutKyc: "VALIDE" },
    select: { id: true },
  });

  // Une vraie pièce dans le vrai stockage : la purge doit effacer un blob qui
  // existe, pas un chemin imaginaire.
  const chemin = `pieces/${marque}-${suffixe}/recto.bin`;
  await ecrireBlob(chemin, new Uint8Array([1, 2, 3, 4]), "image/jpeg");

  const document = await prisma.customerDocument.create({
    data: {
      customerId: customer.id,
      type: "PIECE_RECTO",
      blobPath: chemin,
      mimeType: "image/jpeg",
      tailleOctets: 4,
      sha256: `${marque}-${suffixe}`,
    },
    select: { id: true },
  });

  const cloture = new Date(Date.now() - clotureIlYa);
  for (const [i, statut] of statuts.entries()) {
    const r = await prisma.reservation.create({
      data: {
        reference: `${marque}-${suffixe}-${i}`,
        customerId: customer.id,
        boutiqueId,
        produitId,
        formule: "LOCATION_JOURNALIERE",
        montantTotal: 10_000,
        statut,
      },
      select: { id: true },
    });
    // `updatedAt` est géré par Prisma : on le force en SQL pour simuler une
    // clôture ancienne, ce qu'aucune API applicative ne permet.
    await prisma.$executeRaw`UPDATE "Reservation" SET "updatedAt" = ${cloture} WHERE id = ${r.id}`;
  }

  creees.push({ userId: user.id, customerId: customer.id, chemin });
  return { documentId: document.id, chemin };
}

async function main() {
  const boutique = await prisma.boutique.findFirst({ select: { id: true } });
  const produit = await prisma.produit.findFirst({ select: { id: true } });

  if (!boutique || !produit) {
    console.error("\nBase incomplète : lancez `npm run seed` puis `npm run seed:v2`.\n");
    process.exit(1);
  }

  const A = await client("A", ["TERMINEE"], 10 * JOUR, boutique.id, produit.id);
  const B = await client("B", ["TERMINEE"], 0, boutique.id, produit.id);
  const C = await client("C", ["TERMINEE", "ACTIVE"], 10 * JOUR, boutique.id, produit.id);

  try {
    console.log("\nPurge des pièces — 48 h après la clôture du DERNIER dossier\n");

    // L'aperçu ne doit RIEN toucher : c'est ce qui permet de regarder avant d'agir.
    const vu = await purgerPieces({ apercu: true });
    verifie("l'aperçu voit la pièce ancienne comme mûre", vu.some((p) => p.documentId === A.documentId && p.effacee), true);
    verifie("l'aperçu n'efface rien", await blobExiste(A.chemin), true);
    verifie("l'aperçu ignore le client qui a un dossier en cours", vu.some((p) => p.documentId === C.documentId), false);

    const faites = await purgerPieces();

    console.log("");
    verifie("A — clos depuis 10 jours : blob effacé", await blobExiste(A.chemin), false);
    verifie("A — la ligne est marquée purgée", (await champ<Date | null>(A.documentId, "purgeAt")) !== null, true);
    verifie("A — l'empreinte SHA-256 SURVIT", await champ<string>(A.documentId, "sha256"), `${marque}-A`);

    console.log("");
    verifie("B — clos à l'instant : blob conservé", await blobExiste(B.chemin), true);
    verifie("B — mais sa date d'effacement est posée", (await champ<Date | null>(B.documentId, "purgeApres")) !== null, true);
    verifie("B — et sa ligne n'est PAS marquée purgée", await champ<Date | null>(B.documentId, "purgeAt"), null);

    console.log("");
    verifie("C — un dossier ACTIVE subsiste : blob épargné", await blobExiste(C.chemin), true);
    verifie("C — aucune date d'effacement n'est posée", await champ<Date | null>(C.documentId, "purgeApres"), null);
    verifie("C — la purge ne l'a pas regardé", faites.some((p) => p.documentId === C.documentId), false);

    console.log("");
    // Le cron tourne chaque jour : une seconde exécution ne doit rien retoucher.
    const relance = await purgerPieces();
    verifie("une seconde exécution laisse A tranquille", relance.some((p) => p.documentId === A.documentId), false);
  } finally {
    for (const c of creees) {
      await prisma.customerDocument.deleteMany({ where: { customerId: c.customerId } });
      await prisma.reservation.deleteMany({ where: { customerId: c.customerId } });
      await prisma.customer.delete({ where: { id: c.customerId } });
      await prisma.user.delete({ where: { id: c.userId } });
      await supprimerBlob(c.chemin).catch(() => {});
    }
  }

  console.log(
    ko === 0
      ? `\nTOUS LES CONTRÔLES PASSENT — ${ok} OK, 0 KO\n`
      : `\nÉCHECS DÉTECTÉS — ${ok} OK, ${ko} KO\n`,
  );
  if (ko > 0) process.exitCode = 1;
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
