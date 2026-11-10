/**
 * Ce que le panneau d'administration compte comme une vente ou une location.
 *
 *   npm run verif:statistiques
 *
 * Éprouve la règle demandée par Alexandre le 2026-11-10 : **une réservation ne
 * suffit pas**. Seul un contrat SCELLÉ — signé par le client puis contresigné,
 * l'acte final établi — entre dans les chiffres.
 *
 * La location courte durée échappait à cette règle : elle était comptée depuis
 * les réservations, au motif qu'aucun acte n'existait pour cette formule. L'acte
 * journalier a été écrit depuis, et le calcul n'avait pas suivi.
 *
 * Le contrôle fabrique deux réservations journalières dans la même boutique,
 * identiques sauf sur un point : l'une a son contrat scellé, l'autre non. Il
 * exige que la première soit comptée et la seconde ignorée — dans le total,
 * par boutique, par modèle, et dans le graphique des douze mois.
 *
 * Tout est supprimé à la fin, y compris en cas d'échec (`finally`).
 */

// `.env.local` UNIQUEMENT : ce script écrit en base.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { chargerTableauDeBord } from "../src/lib/admin/statistiques";
import { resoudrePeriode } from "../src/lib/admin/filtres";

let ok = 0;
let ko = 0;

function verifie(libelle: string, obtenu: unknown, attendu: unknown) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (!bon) console.log(`       attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

const MONTANT_SCELLE = 37_000;
const MONTANT_NON_SCELLE = 91_000;

async function main() {
  const boutique = await prisma.boutique.findFirst({ select: { id: true } });
  const produit = await prisma.produit.findFirst({ select: { id: true } });
  const modele = await prisma.contractTemplate.findFirst({ select: { id: true } });

  if (!boutique || !produit || !modele) {
    console.error("\nBase incomplète : lancez `npm run seed` puis `npm run seed:v2`.\n");
    process.exit(1);
  }

  const marque = `STA-${Date.now()}`;
  const periode = resoudrePeriode("mois");

  // Mesure AVANT, pour raisonner en écarts : la base contient des dossiers
  // réels, et un contrôle qui exigerait des valeurs absolues casserait dès
  // qu'on ajoute une ligne.
  const avant = await chargerTableauDeBord({ periode, boutiqueId: null });

  const user = await prisma.user.create({
    data: { nomAffichage: marque, email: `${marque}@test.invalid` },
    select: { id: true },
  });
  const customer = await prisma.customer.create({
    data: { userId: user.id, nom: "TEST", prenom: marque, statutKyc: "VALIDE" },
    select: { id: true },
  });

  /** Réservation journalière, avec contrat scellé ou non selon `scelle`. */
  async function dossier(montant: number, scelle: boolean) {
    const reservation = await prisma.reservation.create({
      data: {
        reference: `${marque}-${scelle ? "S" : "N"}`,
        customerId: customer.id,
        boutiqueId: boutique!.id,
        produitId: produit!.id,
        formule: "LOCATION_JOURNALIERE",
        montantTotal: montant,
        statut: scelle ? "ACTIVE" : "EN_ATTENTE_SIGNATURE",
      },
      select: { id: true },
    });

    const contrat = await prisma.contract.create({
      data: {
        reference: `${marque}-${scelle ? "S" : "N"}`,
        reservationId: reservation.id,
        templateId: modele!.id,
        // L'instantané figé : le panneau ne le lit pas, mais le champ est
        // obligatoire et un objet vide dirait faussement « contrat sans
        // données » à qui inspecterait la base.
        donnees: { test: marque, formule: "LOCATION_JOURNALIERE", montantTotal: montant },
        statut: scelle ? "SIGNE" : "A_SIGNER_CLIENT",
      },
      select: { id: true },
    });

    // C'est l'ÉVÉNEMENT qui fait foi, pas le statut : `SCELLES` ne regarde que
    // le premier `ContractEvent` de type SCELLE.
    if (scelle) {
      await prisma.contractEvent.create({
        data: { contractId: contrat.id, type: "SCELLE", metadata: { test: marque } },
      });
    }

    return { reservationId: reservation.id, contratId: contrat.id };
  }

  const aScelle = await dossier(MONTANT_SCELLE, true);
  const aNonScelle = await dossier(MONTANT_NON_SCELLE, false);

  try {
    const apres = await chargerTableauDeBord({ periode, boutiqueId: null });

    console.log("\nCourte durée : seul un contrat scellé compte\n");

    verifie(
      "le total gagne UNE location, pas deux",
      apres.indicateurs.courtes.nombre - avant.indicateurs.courtes.nombre,
      1,
    );
    verifie(
      "le montant est celui du contrat scellé seul",
      apres.indicateurs.courtes.montant - avant.indicateurs.courtes.montant,
      MONTANT_SCELLE,
    );

    const boutiqueAvant = avant.parBoutique.find((b) => b.id === boutique.id);
    const boutiqueApres = apres.parBoutique.find((b) => b.id === boutique.id);
    verifie(
      "la boutique gagne UNE location",
      (boutiqueApres?.courtes.nombre ?? 0) - (boutiqueAvant?.courtes.nombre ?? 0),
      1,
    );

    const modeleAvant = avant.parModele.find((m) => m.id === produit.id);
    const modeleApres = apres.parModele.find((m) => m.id === produit.id);
    verifie(
      "le modèle gagne UNE location",
      (modeleApres?.courtes ?? 0) - (modeleAvant?.courtes ?? 0),
      1,
    );

    // Le double comptage corrigé au passage : le graphique additionnait la même
    // journalière deux fois, une fois comme contrat scellé et une fois comme
    // réservation.
    const cle = new Date().toISOString().slice(0, 7);
    const moisAvant = avant.douzeMois.find((m) => m.cle === cle);
    const moisApres = apres.douzeMois.find((m) => m.cle === cle);
    verifie(
      "le graphique du mois gagne UNE location, pas deux",
      (moisApres?.courtes ?? 0) - (moisAvant?.courtes ?? 0),
      1,
    );

    // Les deux autres formules ne doivent pas bouger : la fixture est journalière.
    verifie(
      "les ventes ne bougent pas",
      apres.indicateurs.ventes.nombre - avant.indicateurs.ventes.nombre,
      0,
    );
    verifie(
      "les locations longue durée ne bougent pas",
      apres.indicateurs.longues.nombre - avant.indicateurs.longues.nombre,
      0,
    );

    // La réservation non scellée reste visible AILLEURS : elle existe, elle
    // n'est simplement pas une location aboutie.
    verifie(
      "les réservations reçues en comptent bien DEUX",
      apres.indicateurs.reservationsRecues - avant.indicateurs.reservationsRecues,
      2,
    );
  } finally {
    await prisma.contractEvent.deleteMany({
      where: { contractId: { in: [aScelle.contratId, aNonScelle.contratId] } },
    });
    await prisma.contract.deleteMany({ where: { id: { in: [aScelle.contratId, aNonScelle.contratId] } } });
    await prisma.reservation.deleteMany({
      where: { id: { in: [aScelle.reservationId, aNonScelle.reservationId] } },
    });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.user.delete({ where: { id: user.id } });
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
