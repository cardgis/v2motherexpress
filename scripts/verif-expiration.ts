/**
 * Contrôle du cron d'expiration, sur des données TEMPORAIRES.
 *
 *   npm run verif:expiration
 *
 * Le cron a beau tourner sans erreur, cela ne prouve pas qu'il agit : sur une
 * base saine il n'a rien à faire, et son silence ressemble au succès. Ce script
 * fabrique donc le cas — une réservation dont le délai est dépassé, une moto
 * bloquée — puis vérifie que la moto revient au stock.
 *
 * Tout est supprimé à la fin, y compris en cas d'échec (`finally`).
 */

// `.env.local` UNIQUEMENT : ce script écrit en base.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { expirerReservations } from "../src/lib/expiration";

let ok = 0;
let ko = 0;

function verifie(libelle: string, obtenu: unknown, attendu: unknown) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (!bon) console.log(`       attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

const jours = (n: number) => new Date(Date.now() + n * 24 * 3_600_000);

async function main() {
  const boutique = await prisma.boutique.findFirst({ select: { id: true } });
  const produit = await prisma.produit.findFirst({ select: { id: true } });
  const modele = await prisma.contractTemplate.findFirst({ select: { id: true } });

  if (!boutique || !produit || !modele) {
    console.error("\nBase incomplète : lancez `npm run seed` puis `npm run seed:v2`.\n");
    process.exit(1);
  }

  const marque = `EXP-${Date.now()}`;
  const user = await prisma.user.create({
    // La base impose un téléphone OU un e-mail (contrainte
    // « User_telephone_ou_email »). `.invalid` est un domaine réservé : cette
    // adresse ne peut désigner personne.
    data: { nomAffichage: marque, email: `${marque}@test.invalid` },
    select: { id: true },
  });
  const customer = await prisma.customer.create({
    data: { userId: user.id, nom: "TEST", prenom: marque },
    select: { id: true },
  });
  const moto = await prisma.vehicule.create({
    data: {
      boutiqueId: boutique.id,
      produitId: produit.id,
      numeroChassis: marque,
      statut: "RESERVE",
    },
    select: { id: true },
  });

  const commun = {
    customerId: customer.id,
    boutiqueId: boutique.id,
    produitId: produit.id,
    formule: "LOCATION_ACCESSION" as const,
    montantTotal: 780_000,
    statut: "EN_ATTENTE_RETRAIT" as const,
  };

  // Délai DÉPASSÉ : la moto doit revenir au stock.
  const depassee = await prisma.reservation.create({
    data: { ...commun, reference: `${marque}-DEPASSEE`, expireLe: jours(-3), vehiculeId: moto.id },
    select: { id: true },
  });
  const contrat = await prisma.contract.create({
    data: {
      reference: `${marque}-C`,
      reservationId: depassee.id,
      templateId: modele.id,
      donnees: {},
      statut: "EN_ATTENTE_RETRAIT",
    },
    select: { id: true },
  });

  // Délai NON dépassé : rien ne doit lui arriver.
  const dansLesTemps = await prisma.reservation.create({
    data: { ...commun, reference: `${marque}-ATTENTE`, expireLe: jours(3) },
    select: { id: true },
  });

  try {
    console.log("\n=== Aperçu : il ne doit RIEN écrire ===\n");
    const vus = await expirerReservations({ apercu: true });
    verifie("l'aperçu voit la réservation dépassée", vus.some((e) => e.reference === `${marque}-DEPASSEE`), true);
    verifie(
      "l'aperçu n'a rien changé",
      (await prisma.reservation.findUnique({ where: { id: depassee.id }, select: { statut: true } }))?.statut,
      "EN_ATTENTE_RETRAIT",
    );

    console.log("\n=== Expiration réelle ===\n");
    const faites = await expirerReservations();
    verifie("la réservation dépassée est traitée", faites.some((e) => e.reference === `${marque}-DEPASSEE`), true);
    verifie(
      "la moto libérée est nommée dans le compte rendu",
      faites.find((e) => e.reference === `${marque}-DEPASSEE`)?.vehiculeLibere,
      marque,
    );

    verifie(
      "la réservation passe en CADUQUE",
      (await prisma.reservation.findUnique({ where: { id: depassee.id }, select: { statut: true } }))?.statut,
      "CADUQUE",
    );
    verifie(
      "le contrat passe en CADUC",
      (await prisma.contract.findUnique({ where: { id: contrat.id }, select: { statut: true } }))?.statut,
      "CADUC",
    );
    verifie(
      "LA MOTO EST RENDUE AU STOCK",
      (await prisma.vehicule.findUnique({ where: { id: moto.id }, select: { statut: true } }))?.statut,
      "DISPONIBLE",
    );
    verifie(
      "un événement EXPIRE est inscrit dans la piste d'audit",
      await prisma.contractEvent.count({ where: { contractId: contrat.id, type: "EXPIRE" } }),
      1,
    );

    verifie(
      "la réservation DANS LES TEMPS n'est pas touchée",
      (await prisma.reservation.findUnique({ where: { id: dansLesTemps.id }, select: { statut: true } }))?.statut,
      "EN_ATTENTE_RETRAIT",
    );

    // Deuxième passage : rien ne doit plus être éligible.
    const encore = await expirerReservations();
    verifie(
      "un second passage ne retraite pas la même réservation",
      encore.some((e) => e.reference === `${marque}-DEPASSEE`),
      false,
    );
  } finally {
    // Par MOTIF et non par identifiant : le nettoyage tient même si la
    // fabrication des fixtures s'est interrompue en chemin.
    await prisma.contract.deleteMany({ where: { reference: { startsWith: marque } } });
    await prisma.reservation.deleteMany({ where: { reference: { startsWith: marque } } });
    await prisma.vehicule.deleteMany({ where: { numeroChassis: marque } });
    await prisma.customer.deleteMany({ where: { prenom: marque } });
    await prisma.user.deleteMany({ where: { email: `${marque}@test.invalid` } });
    verifie(
      "toutes les données de test sont supprimées",
      await prisma.reservation.count({ where: { reference: { startsWith: marque } } }),
      0,
    );
  }

  console.log(`\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "ÉCHECS DÉTECTÉS"} — ${ok} OK, ${ko} KO\n`);
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

main().catch(async (erreur) => {
  console.error(erreur);
  await prisma.$disconnect();
  process.exit(1);
});
