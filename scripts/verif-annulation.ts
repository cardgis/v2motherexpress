/**
 * Annulation par la boutique, et rejet du KYC sur pièce non conforme.
 *
 *   npm run verif:annulation
 *
 * Deux manques comblés le 2026-09-29, éprouvés ici sur des données TEMPORAIRES :
 *
 *   1. `ANNULEE` / `ANNULE` étaient des statuts morts — aucune ligne de code ne
 *      les écrivait. Un client qui se désistait laissait sa moto bloquée.
 *   2. La caducité pour pièce non conforme laissait le KYC en VALIDE : le client
 *      pouvait reprendre une réservation aussitôt, en sautant la vérification.
 *
 * Tout est supprimé à la fin, y compris en cas d'échec (`finally`).
 */

// `.env.local` UNIQUEMENT : ce script écrit en base.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { annulerDossier, ErreurAnnulation, estAnnulable } from "../src/lib/annulation";
import { verifierPiece } from "../src/lib/retrait";
import type { Utilisateur } from "../src/lib/auth";

let ok = 0;
let ko = 0;

function verifie(libelle: string, obtenu: unknown, attendu: unknown) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (!bon) console.log(`       attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

/** Vérifie qu'un appel est REFUSÉ, et que son refus dit pourquoi. */
async function refuse(libelle: string, appel: () => Promise<unknown>, extrait: string) {
  try {
    await appel();
    ko++;
    console.log(`  KO   ${libelle}`);
    console.log("       l'appel a réussi alors qu'il devait être refusé");
    return;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    if (message.includes(extrait)) {
      ok++;
      console.log(`  OK   ${libelle}`);
    } else {
      ko++;
      console.log(`  KO   ${libelle}`);
      console.log(`       refus attendu sur « ${extrait} », obtenu « ${message} »`);
    }
    if (!(erreur instanceof ErreurAnnulation) && !message.includes(extrait)) {
      console.log("       (ce n'est même pas une ErreurAnnulation)");
    }
  }
}

async function main() {
  const boutique = await prisma.boutique.findFirst({ select: { id: true } });
  const produit = await prisma.produit.findFirst({ select: { id: true } });
  const modele = await prisma.contractTemplate.findFirst({ select: { id: true } });

  if (!boutique || !produit || !modele) {
    console.error("\nBase incomplète : lancez `npm run seed` puis `npm run seed:v2`.\n");
    process.exit(1);
  }

  const marque = `ANN-${Date.now()}`;

  // Acteur synthétique : `annuleParUserId` et `kycVerifiePar` n'ont pas de clé
  // étrangère, aucun vrai compte n'est donc impliqué dans le test.
  const membre: Utilisateur = {
    id: `${marque}-acteur`,
    telephone: null,
    email: null,
    role: "ADMIN",
    nomAffichage: "Test annulation",
    boutiqueId: null,
    customerId: null,
    statutKyc: null,
  };

  const user = await prisma.user.create({
    data: { nomAffichage: marque, email: `${marque}@test.invalid` },
    select: { id: true },
  });
  const customer = await prisma.customer.create({
    data: { userId: user.id, nom: "TEST", prenom: marque, statutKyc: "VALIDE" },
    select: { id: true },
  });
  const moto = await prisma.vehicule.create({
    data: { boutiqueId: boutique.id, produitId: produit.id, numeroChassis: marque, statut: "RESERVE" },
    select: { id: true },
  });

  const commun = {
    customerId: customer.id,
    boutiqueId: boutique.id,
    produitId: produit.id,
    formule: "LOCATION_ACCESSION" as const,
    montantTotal: 780_000,
  };

  try {
    console.log("\n=== Qui est annulable (fonction pure) ===\n");
    verifie("en attente de signature, contrat en brouillon", estAnnulable("EN_ATTENTE_SIGNATURE", "BROUILLON"), true);
    verifie("signé par le client, pas encore contresigné", estAnnulable("EN_ATTENTE_SIGNATURE", "A_SIGNER_GERANT"), true);
    verifie("CONTRAT SCELLÉ : plus annulable", estAnnulable("EN_ATTENTE_RETRAIT", "SIGNE"), false);
    verifie("véhicule sorti : plus annulable", estAnnulable("ACTIVE", "RETIRE"), false);
    verifie("sans contrat du tout : annulable", estAnnulable("EN_ATTENTE_DOSSIER", null), true);

    console.log("\n=== Annulation : le client s'est désisté ===\n");
    const aAnnuler = await prisma.reservation.create({
      data: { ...commun, reference: `${marque}-A`, statut: "EN_ATTENTE_SIGNATURE", vehiculeId: moto.id },
      select: { id: true },
    });
    const contratA = await prisma.contract.create({
      data: {
        reference: `${marque}-CA`,
        reservationId: aAnnuler.id,
        templateId: modele.id,
        donnees: {},
        statut: "BROUILLON",
      },
      select: { id: true },
    });

    await refuse(
      "un motif trop court est refusé",
      () => annulerDossier({ membre, reservationId: aAnnuler.id, motif: "non", ip: "::1" }),
      "conservé comme trace",
    );

    const fait = await annulerDossier({
      membre,
      reservationId: aAnnuler.id,
      motif: "Le client s'est désisté, il a trouvé un autre financement.",
      ip: "::1",
    });
    verifie("le compte rendu signale la moto libérée", fait.vehiculeLibere, true);

    const apres = await prisma.reservation.findUnique({
      where: { id: aAnnuler.id },
      select: { statut: true, annuleMotif: true, annuleParUserId: true, annuleLe: true, expireLe: true },
    });
    verifie("la réservation passe en ANNULEE", apres?.statut, "ANNULEE");
    verifie("le motif est conservé", apres?.annuleMotif?.startsWith("Le client s'est désisté"), true);
    verifie("l'auteur est conservé", apres?.annuleParUserId, membre.id);
    verifie("la date est conservée", apres?.annuleLe !== null, true);
    verifie("le délai de retrait est effacé", apres?.expireLe, null);
    verifie(
      "le contrat passe en ANNULE",
      (await prisma.contract.findUnique({ where: { id: contratA.id }, select: { statut: true } }))?.statut,
      "ANNULE",
    );
    verifie(
      "LA MOTO EST RENDUE AU STOCK",
      (await prisma.vehicule.findUnique({ where: { id: moto.id }, select: { statut: true } }))?.statut,
      "DISPONIBLE",
    );
    verifie(
      "un événement ANNULE est inscrit dans la piste d'audit",
      await prisma.contractEvent.count({ where: { contractId: contratA.id, type: "ANNULE" } }),
      1,
    );
    await refuse(
      "un dossier déjà annulé ne se réannule pas",
      () =>
        annulerDossier({ membre, reservationId: aAnnuler.id, motif: "Deuxième tentative d'annulation.", ip: "::1" }),
      "déjà annulé",
    );

    console.log("\n=== Refus : au-delà, ce n'est plus une annulation ===\n");
    const scellee = await prisma.reservation.create({
      data: { ...commun, reference: `${marque}-B`, statut: "EN_ATTENTE_RETRAIT", expireLe: new Date() },
      select: { id: true },
    });
    const contratB = await prisma.contract.create({
      data: {
        reference: `${marque}-CB`,
        reservationId: scellee.id,
        templateId: modele.id,
        donnees: {},
        statut: "EN_ATTENTE_RETRAIT",
      },
      select: { id: true },
    });
    await refuse(
      "un contrat scellé ne s'annule pas : il se résilie",
      () => annulerDossier({ membre, reservationId: scellee.id, motif: "Tentative sur un contrat scellé.", ip: "::1" }),
      "se résilie",
    );

    const sortie = await prisma.reservation.create({
      data: { ...commun, reference: `${marque}-C`, statut: "ACTIVE" },
      select: { id: true },
    });
    await refuse(
      "véhicule sorti : le message renvoie au constat de restitution",
      () => annulerDossier({ membre, reservationId: sortie.id, motif: "Tentative sur un contrat actif.", ip: "::1" }),
      "constat de restitution",
    );

    console.log("\n=== Pièce non conforme : le doute frappe la personne ===\n");
    const enAttente = await prisma.reservation.create({
      data: { ...commun, reference: `${marque}-D`, statut: "EN_ATTENTE_VALIDATION" },
      select: { id: true },
    });

    await verifierPiece({
      gerant: membre,
      reservationId: scellee.id,
      conforme: false,
      motifRefus: "Le nom de l'original ne correspond pas à la copie transmise.",
      ip: "::1",
    });

    verifie(
      "la réservation devient CADUQUE",
      (await prisma.reservation.findUnique({ where: { id: scellee.id }, select: { statut: true } }))?.statut,
      "CADUQUE",
    );
    verifie(
      "le contrat devient CADUC",
      (await prisma.contract.findUnique({ where: { id: contratB.id }, select: { statut: true } }))?.statut,
      "CADUC",
    );

    const dossier = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { statutKyc: true, kycMotifRejet: true },
    });
    verifie("LE KYC PASSE EN REJETE", dossier?.statutKyc, "REJETE");
    verifie(
      "le client lit une raison compréhensible",
      dossier?.kycMotifRejet?.startsWith("Pièce d'identité non conforme"),
      true,
    );
    verifie(
      "ses autres dossiers repartent en attente de pièces",
      (await prisma.reservation.findUnique({ where: { id: enAttente.id }, select: { statut: true } }))?.statut,
      "EN_ATTENTE_DOSSIER",
    );
  } finally {
    // Par MOTIF : le nettoyage tient même si le test s'est arrêté en chemin.
    await prisma.contract.deleteMany({ where: { reference: { startsWith: marque } } });
    await prisma.handover.deleteMany({ where: { reservation: { reference: { startsWith: marque } } } });
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
