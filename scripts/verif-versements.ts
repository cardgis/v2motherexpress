/**
 * Contrôle de non-régression du suivi des versements.
 *
 * Un solde faux ne casse aucun test de compilation : il se voit le jour où on
 * réclame à un client de l'argent qu'il a déjà versé, ou l'inverse. Ce script
 * met à l'épreuve les deux fonctions pures du module : l'échéancier figé au
 * scellement, et le calcul du dû à date formule par formule.
 *
 *   npm run verif:versements
 */

import { calculerSolde, echeancesDe } from "../src/lib/versements";
import type { Formule } from "../src/generated/prisma";

let ok = 0;
let ko = 0;
const f = (n: number) => n.toLocaleString("fr-FR").replace(/[  ]/g, " ");

function verifie(libelle: string, obtenu: unknown, attendu: unknown) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else ko++;
  console.log(`${bon ? "  OK  " : "  KO  "} ${libelle}`);
  if (!bon) console.log(`         attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

const LE_4_JUILLET = new Date("2026-07-04T10:00:00Z");
const jours = (depuis: Date, n: number) => new Date(depuis.getTime() + n * 24 * 3_600_000);

/** Raccourci de lecture : un dossier sans versement, scellé le 4 juillet. */
function dossier(formule: Formule, montantTotal: number, redevance: number | null = null) {
  return {
    formule,
    montantTotal,
    redevanceJournaliere: redevance,
    scelleLe: LE_4_JUILLET,
    suiviDepuis: LE_4_JUILLET,
    echeances: echeancesDe(formule, montantTotal, LE_4_JUILLET).map((e) => ({
      montantDu: e.montantDu,
      echeanceLe: e.echeanceLe,
    })),
    encaissements: [] as { montant: number; annuleLe: Date | null }[],
  };
}

// ---------------------------------------------------------------------------
console.log("\n=== Échéancier figé au scellement ===");

const venteEcheances = echeancesDe("VENTE_ECHELONNEE", 860_000, LE_4_JUILLET);
console.log(`         ${venteEcheances.map((e) => f(e.montantDu)).join(" + ")}`);
verifie("vente : 5 échéances", venteEcheances.length, 5);
verifie("vente : acompte de 60 %", venteEcheances[0]!.montantDu, 516_000);
verifie(
  "vente : somme des échéances = prix total",
  venteEcheances.reduce((s, e) => s + e.montantDu, 0),
  860_000,
);
verifie(
  "vente : acompte dû le jour du scellement",
  venteEcheances[0]!.echeanceLe.toISOString(),
  LE_4_JUILLET.toISOString(),
);
verifie(
  "vente : dernière échéance à 120 jours",
  venteEcheances[4]!.echeanceLe.toISOString(),
  jours(LE_4_JUILLET, 120).toISOString(),
);

verifie(
  "courte durée : une échéance unique, due au retrait",
  echeancesDe("LOCATION_JOURNALIERE", 27_000, LE_4_JUILLET).length,
  1,
);
verifie(
  "ACCESSION : aucune échéance — l'acte n'en prévoit pas",
  echeancesDe("LOCATION_ACCESSION", 780_000, LE_4_JUILLET).length,
  0,
);

// ---------------------------------------------------------------------------
console.log("\n=== Vente échelonnée : ce qui est exigible ===");

const vente = dossier("VENTE_ECHELONNEE", 860_000);

verifie(
  "au scellement : seul l'acompte est exigible",
  calculerSolde(vente, LE_4_JUILLET).duADate,
  516_000,
);
verifie(
  "à 45 jours : acompte + 1 échéance",
  calculerSolde(vente, jours(LE_4_JUILLET, 45)).duADate,
  516_000 + 86_000,
);
verifie(
  "à 130 jours : tout est exigible",
  calculerSolde(vente, jours(LE_4_JUILLET, 130)).duADate,
  860_000,
);

const acompteVerse = {
  ...vente,
  encaissements: [{ montant: 516_000, annuleLe: null }],
};
const apresAcompte = calculerSolde(acompteVerse, LE_4_JUILLET);
verifie("acompte versé : aucun retard", apresAcompte.retard, 0);
verifie("acompte versé : reste 344 000 F jusqu'au terme", apresAcompte.restant, 344_000);
verifie("acompte versé : contrat non soldé", apresAcompte.solde, false);

const enRetard = calculerSolde(acompteVerse, jours(LE_4_JUILLET, 65));
verifie("à 65 jours sans autre versement : 2 échéances en retard", enRetard.retard, 172_000);

const annule = calculerSolde(
  { ...vente, encaissements: [{ montant: 516_000, annuleLe: new Date("2026-07-05T09:00:00Z") }] },
  LE_4_JUILLET,
);
verifie("UN VERSEMENT ANNULÉ ne compte pas", annule.encaisse, 0);
verifie("versement annulé : le retard réapparaît", annule.retard, 516_000);

const tropPercu = calculerSolde(
  { ...vente, encaissements: [{ montant: 900_000, annuleLe: null }] },
  LE_4_JUILLET,
);
verifie("trop-perçu : solde atteint", tropPercu.solde, true);
verifie("trop-perçu : restant jamais négatif", tropPercu.restant, 0);
verifie("trop-perçu : aucun retard", tropPercu.retard, 0);

// ---------------------------------------------------------------------------
console.log("\n=== Location-accession : redevance due 6 jours sur 7 ===");

// A10 avec engagement : 2 500 F/j, 12 mois, 312 jours facturés = 780 000 F.
const accession = dossier("LOCATION_ACCESSION", 780_000, 2_500);

verifie("le jour du scellement : un jour dû", calculerSolde(accession, LE_4_JUILLET).duADate, 2_500);
verifie(
  "après une semaine : 6 jours facturés, jamais 7",
  calculerSolde(accession, jours(LE_4_JUILLET, 6)).duADate,
  6 * 2_500,
);
verifie(
  "après 30 jours calendaires : 26 jours facturés",
  calculerSolde(accession, jours(LE_4_JUILLET, 29)).duADate,
  26 * 2_500,
);
verifie(
  "AU TERME : le dû ne dépasse jamais le total du contrat",
  calculerSolde(accession, jours(LE_4_JUILLET, 900)).duADate,
  780_000,
);

const accessionPartielle = calculerSolde(
  { ...accession, encaissements: [{ montant: 180_000, annuleLe: null }] },
  jours(LE_4_JUILLET, 111), // 96 jours facturés × 2 500 = 240 000 F
);
verifie("96 jours dus, 180 000 F versés : 60 000 F de retard", accessionPartielle.retard, 60_000);
verifie("RETARD EXPRIMÉ EN JOURS de redevance", accessionPartielle.joursDeRetard, 24);
verifie("vente : pas de retard en jours", calculerSolde(vente, LE_4_JUILLET).joursDeRetard, null);

// ---------------------------------------------------------------------------
console.log("\n=== Mise en service du suivi ===");

// Contrat scellé six mois avant la mise en ligne : on ne réclame que ce qui
// court depuis la mise en service, jamais l'arriéré.
const LANCEMENT = new Date("2027-01-04T00:00:00Z");
const ancien = {
  ...dossier("LOCATION_ACCESSION", 780_000, 2_500),
  suiviDepuis: LANCEMENT,
};

const depuisLancement = calculerSolde(ancien, jours(LANCEMENT, 6));
verifie(
  "contrat ancien : le dû part de la mise en service, pas du scellement",
  depuisLancement.duADate,
  6 * 2_500,
);
verifie("contrat ancien : le suivi est signalé comme partiel", depuisLancement.suiviPartiel, true);
verifie(
  "contrat récent : suivi complet",
  calculerSolde(accession, jours(LE_4_JUILLET, 6)).suiviPartiel,
  false,
);

// ---------------------------------------------------------------------------
console.log("\n=== Cas limites ===");

verifie(
  "contrat non scellé : rien n'est exigible",
  calculerSolde({ ...vente, scelleLe: null, suiviDepuis: null }, LE_4_JUILLET).duADate,
  0,
);
verifie(
  "accession sans redevance saisie : aucun dû inventé",
  calculerSolde({ ...accession, redevanceJournaliere: null }, jours(LE_4_JUILLET, 30)).duADate,
  0,
);
verifie(
  "date antérieure au départ du suivi : rien n'est exigible",
  calculerSolde(accession, new Date("2026-06-01T00:00:00Z")).duADate,
  0,
);


// ---------------------------------------------------------------------------
console.log("\n=== Contrat ARRÊTÉ : le compteur se gèle ===");

// Rupture au 100e jour. Le dû retenu est celui de ce jour-là, jamais celui
// d'aujourd'hui : sans ce gel, l'accession continuerait d'accumuler sa
// redevance quotidienne sur un engagement qui n'existe plus.
const ARRET = jours(LE_4_JUILLET, 100);
const DU_A_L_ARRET = calculerSolde(accession, ARRET).duADate;
const BIEN_PLUS_TARD = jours(LE_4_JUILLET, 400);
const arretee = { ...accession, arreteLe: ARRET };

verifie("le dû est gelé à la date d'arrêt", calculerSolde(arretee, BIEN_PLUS_TARD).duADate, DU_A_L_ARRET);
verifie(
  "SANS gel, le dû aurait continué de courir",
  calculerSolde(accession, BIEN_PLUS_TARD).duADate > DU_A_L_ARRET,
  true,
);
verifie("contrat NON arrêté : son total reste celui du contrat", calculerSolde(accession, BIEN_PLUS_TARD).duTotal, 780_000);
verifie("arrêtée : le total n'est plus les 12 mois", calculerSolde(arretee, BIEN_PLUS_TARD).duTotal, DU_A_L_ARRET);

// Ce que le constat met à la charge du client : différentiel de l'article 5 et
// frais de remise en état, exigibles dès la date de l'arrêt.
const avecDus = {
  ...arretee,
  echeances: [
    { montantDu: 43_000, echeanceLe: ARRET },
    { montantDu: 30_000, echeanceLe: ARRET },
  ],
};

verifie("RÉPARATIONS et DIFFÉRENTIEL entrent dans le dû", calculerSolde(avecDus, BIEN_PLUS_TARD).duADate, DU_A_L_ARRET + 73_000);
verifie("et dans le total à recouvrer", calculerSolde(avecDus, BIEN_PLUS_TARD).duTotal, DU_A_L_ARRET + 73_000);
verifie(
  "les versements déjà perçus se déduisent du reste à recouvrer",
  calculerSolde({ ...avecDus, encaissements: [{ montant: 150_000, annuleLe: null }] }, BIEN_PLUS_TARD).restant,
  DU_A_L_ARRET + 73_000 - 150_000,
);

// Courte durée : le prix de la location était déjà dû, la remise en état s'ajoute.
const journaliere = dossier("LOCATION_JOURNALIERE", 27_000);
verifie(
  "courte durée arrêtée : la remise en état s'ajoute au prix de la location",
  calculerSolde(
    { ...journaliere, arreteLe: ARRET, echeances: [...journaliere.echeances, { montantDu: 15_000, echeanceLe: ARRET }] },
    BIEN_PLUS_TARD,
  ).duADate,
  27_000 + 15_000,
);

console.log(`\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "ÉCHECS DÉTECTÉS"} — ${ok} OK, ${ko} KO\n`);
process.exit(ko === 0 ? 0 : 1);
