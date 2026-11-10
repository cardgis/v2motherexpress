/**
 * Purge des pièces d'identité — ce qu'elle efface, et surtout ce qu'elle ÉPARGNE.
 *
 *   npm run verif:purge
 *
 * Éprouve la règle arrêtée par Alexandre : 48 heures après le RETRAIT COMPLET
 * — contrat signé des deux côtés, état des lieux fait, moto livrée —, l'image
 * de la pièce est effacée. Le gérant a alors eu le temps de la vérifier.
 *
 * Trois clients synthétiques, pour les trois cas qui comptent :
 *
 *   A — retrait complété il y a 10 jours    la pièce doit être effacée
 *   B — retrait complété à l'instant        programmée, pas encore effacée
 *   C — un dossier livré, un autre EN       épargnée, et c'est le cas crucial
 *       ATTENTE DE RETRAIT
 *
 * Le cas C est la raison d'être de ce fichier. Les pièces appartiennent au
 * CLIENT et non à la réservation : purger après la livraison d'un dossier
 * supprimerait la pièce que le gérant doit encore examiner pour un autre.
 *
 * Données TEMPORAIRES, supprimées à la fin même en cas d'échec.
 */

// `.env.local` UNIQUEMENT : ce script écrit et supprime en base.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { purgerPieces } from "../src/lib/purge";
import { ecrireBlob, blobExiste, supprimerBlob } from "../src/lib/storage";
import type { StatutReservation } from "../src/generated/prisma";

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

/** Un dossier : son statut, et sa livraison si elle a eu lieu. */
type Dossier = { statut: StatutReservation; livreIlYa?: number };

/** Un client, sa pièce réellement déposée dans le stockage, et ses dossiers. */
async function client(suffixe: string, dossiers: Dossier[], boutiqueId: string, produitId: string) {
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

  for (const [i, d] of dossiers.entries()) {
    const reservation = await prisma.reservation.create({
      data: {
        reference: `${marque}-${suffixe}-${i}`,
        customerId: customer.id,
        boutiqueId,
        produitId,
        formule: "LOCATION_JOURNALIERE",
        montantTotal: 10_000,
        statut: d.statut,
      },
      select: { id: true },
    });

    if (d.livreIlYa !== undefined) {
      // Le retrait COMPLET : c'est `completedAt` qui déclenche le compte à rebours.
      await prisma.handover.create({
        data: {
          reservationId: reservation.id,
          gerantUserId: `${marque}-gerant`,
          gerantNom: "Test purge",
          statut: "COMPLETE",
          pieceVerifiee: true,
          pieceConforme: true,
          completedAt: new Date(Date.now() - d.livreIlYa),
        },
      });
    }

    // `updatedAt` est géré par Prisma : forcé en SQL pour qu'un dossier sans
    // livraison ne paraisse pas modifié à l'instant.
    await prisma.$executeRaw`UPDATE "Reservation" SET "updatedAt" = ${new Date(Date.now() - 30 * JOUR)} WHERE id = ${reservation.id}`;
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

  const A = await client("A", [{ statut: "ACTIVE", livreIlYa: 10 * JOUR }], boutique.id, produit.id);
  const B = await client("B", [{ statut: "ACTIVE", livreIlYa: 0 }], boutique.id, produit.id);
  const C = await client(
    "C",
    [{ statut: "ACTIVE", livreIlYa: 10 * JOUR }, { statut: "EN_ATTENTE_RETRAIT" }],
    boutique.id,
    produit.id,
  );

  try {
    console.log("\nPurge des pièces — 48 h après le RETRAIT COMPLET\n");

    // L'aperçu ne doit RIEN toucher : c'est ce qui permet de regarder avant d'agir.
    const vu = await purgerPieces({ apercu: true });
    verifie("l'aperçu voit la pièce livrée il y a 10 jours comme mûre", vu.some((p) => p.documentId === A.documentId && p.effacee), true);
    verifie("l'aperçu n'efface rien", await blobExiste(A.chemin), true);
    verifie("l'aperçu ignore le client dont un dossier attend le retrait", vu.some((p) => p.documentId === C.documentId), false);

    const faites = await purgerPieces();

    console.log("");
    verifie("A — livré il y a 10 jours : blob effacé", await blobExiste(A.chemin), false);
    verifie("A — la ligne est marquée purgée", (await champ<Date | null>(A.documentId, "purgeAt")) !== null, true);
    verifie("A — l'empreinte SHA-256 SURVIT", await champ<string>(A.documentId, "sha256"), `${marque}-A`);

    console.log("");
    verifie("B — livré à l'instant : blob conservé", await blobExiste(B.chemin), true);
    verifie("B — mais sa date d'effacement est posée", (await champ<Date | null>(B.documentId, "purgeApres")) !== null, true);
    verifie("B — et sa ligne n'est PAS marquée purgée", await champ<Date | null>(B.documentId, "purgeAt"), null);

    console.log("");
    verifie("C — un dossier attend le retrait : blob épargné", await blobExiste(C.chemin), true);
    verifie("C — aucune date d'effacement n'est posée", await champ<Date | null>(C.documentId, "purgeApres"), null);
    verifie("C — la purge ne l'a pas regardé", faites.some((p) => p.documentId === C.documentId), false);

    console.log("");
    // Le cron tourne chaque jour : une seconde exécution ne doit rien retoucher.
    const relance = await purgerPieces();
    verifie("une seconde exécution laisse A tranquille", relance.some((p) => p.documentId === A.documentId), false);
  } finally {
    for (const c of creees) {
      const ids = await prisma.reservation.findMany({ where: { customerId: c.customerId }, select: { id: true } });
      await prisma.handover.deleteMany({ where: { reservationId: { in: ids.map((r) => r.id) } } });
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
