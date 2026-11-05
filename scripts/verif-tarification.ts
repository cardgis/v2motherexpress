/**
 * Contrôle de non-régression des calculs de montants.
 *
 * Les erreurs d'arrondi sur un échéancier ne se voient pas à la lecture du
 * code : elles se voient quand un client conteste une échéance. Ce script
 * confronte le module de tarification aux chiffres de la grille officielle.
 *
 *   npm run verif:tarif
 */

import {
  joursFactures,
  joursFacturesEntre,
  echeancierVenteEchelonnee,
  calculerAccession,
  differentielRuptureAnticipee,
} from "../src/lib/tarification";
import { offresAccessionPour, OFFRES_ACCESSION } from "../src/lib/offres";

let ok = 0;
let ko = 0;
const f = (n: number) => n.toLocaleString("fr-FR").replace(/[  ]/g, " ");

function verifie(libelle: string, obtenu: unknown, attendu: unknown) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else ko++;
  console.log(`${bon ? "  OK  " : "  KO  "} ${libelle}`);
  if (!bon) {
    console.log(`         attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
  }
}

console.log("\n=== Règle des 6 jours sur 7 ===");
verifie("24 mois → 624 jours facturés", joursFactures(24), 624);
verifie("12 mois → 312 jours facturés", joursFactures(12), 312);
verifie(
  "1 semaine calendaire → 6 jours",
  joursFacturesEntre(new Date("2026-03-02"), new Date("2026-03-08")),
  6,
);
verifie(
  "2 semaines → 12 jours",
  joursFacturesEntre(new Date("2026-03-02"), new Date("2026-03-15")),
  12,
);
verifie(
  "3 jours → 3 jours",
  joursFacturesEntre(new Date("2026-03-02"), new Date("2026-03-04")),
  3,
);
verifie(
  "1 seul jour → 1 jour",
  joursFacturesEntre(new Date("2026-03-02"), new Date("2026-03-02")),
  1,
);
verifie(
  "30 jours calendaires → 26 jours facturés (jamais 30)",
  joursFacturesEntre(new Date("2026-03-02"), new Date("2026-03-31")),
  26,
);

console.log("\n=== Grille tarifaire de la spec ===");
const b12 = calculerAccession({
  redevanceJournaliere: 5000,
  dureeMois: 24,
  avecEngagement: false,
  differentielSiRupture: 0,
});
console.log(`         B12 : ${b12.joursFactures} j × 5 000 F = ${f(b12.montantTotal)} FCFA`);
verifie("B12 24 mois = 3 120 000 FCFA (chiffre de la spec)", b12.montantTotal, 3_120_000);

const a10sans = calculerAccession({
  redevanceJournaliere: 3000,
  dureeMois: 14,
  avecEngagement: false,
  differentielSiRupture: 0,
});
console.log(
  `         A10 sans engagement : ${a10sans.joursFactures} j × 3 000 F = ${f(a10sans.montantTotal)} FCFA`,
);

const offreA10 = {
  redevanceJournaliere: 2500,
  dureeMois: 12,
  avecEngagement: true,
  differentielSiRupture: 500,
};
const a10avec = calculerAccession(offreA10);
console.log(
  `         A10 avec engagement : ${a10avec.joursFactures} j × 2 500 F = ${f(a10avec.montantTotal)} FCFA`,
);

console.log("\n=== Clause de rupture anticipée A10 ===");
verifie(
  "100 jours loués → 50 000 F de différentiel",
  differentielRuptureAnticipee(offreA10, 100),
  50_000,
);
verifie(
  "différentiel dû sur TOUS les jours loués, pas les jours restants",
  differentielRuptureAnticipee(offreA10, a10avec.joursFactures),
  312 * 500,
);
verifie(
  "offre sans engagement → aucun différentiel",
  differentielRuptureAnticipee(
    { redevanceJournaliere: 3000, dureeMois: 14, avecEngagement: false, differentielSiRupture: 0 },
    100,
  ),
  0,
);

console.log("\n=== Vente échelonnée : 60 % + 4 × 10 % ===");
// Le dernier prix est volontairement indivisible par 10 : c'est le cas qui
// révèle les erreurs d'arrondi.
for (const prix of [410_000, 520_000, 650_000, 860_000, 970_000, 333_333]) {
  const e = echeancierVenteEchelonnee(prix);
  const somme = e.reduce((s: number, x) => s + x.montant, 0);
  const entiers = e.every((x) => Number.isInteger(x.montant));
  console.log(`         ${f(prix).padStart(9)} → ${e.map((x) => f(x.montant)).join(" + ")}`);
  verifie(`  somme des échéances = total (${f(prix)})`, somme, prix);
  verifie("  toutes les échéances sont entières", entiers, true);
}

const ech = echeancierVenteEchelonnee(410_000);
verifie(
  "échéancier étalé sur 120 jours",
  ech.map((x) => x.jourDepuisSignature),
  [0, 30, 60, 90, 120],
);
verifie("acompte = 60 % du prix", ech[0]!.montant, 246_000);
console.log("\n=== Offres d'accession du catalogue ===");
const a10 = offresAccessionPour("A10");
verifie("A10 propose 2 formules (sans / avec engagement)", a10.length, 2);
verifie(
  "A10 sans engagement = 1 098 000 FCFA",
  a10.find((o) => o.cle === "A10_SANS_ENGAGEMENT")!.montantTotal,
  1_098_000,
);
verifie(
  "A10 avec engagement = 780 000 FCFA",
  a10.find((o) => o.cle === "A10_AVEC_ENGAGEMENT")!.montantTotal,
  780_000,
);
verifie(
  "A10 avec engagement porte un differentiel de 500 F/j",
  a10.find((o) => o.cle === "A10_AVEC_ENGAGEMENT")!.differentielSiRupture,
  500,
);
verifie(
  "B12 = 3 120 000 FCFA (chiffre de la spec)",
  offresAccessionPour("B12")[0]!.montantTotal,
  3_120_000,
);
verifie(
  "les tarifs issus de la spec ne sont PAS marques provisoires",
  [...OFFRES_ACCESSION.A10!, ...OFFRES_ACCESSION.B12!].every((o) => !o.provisoire),
  true,
);

const provisoires = Object.entries(OFFRES_ACCESSION).flatMap(([modele, offres]) =>
  offres
    .filter((o) => o.provisoire)
    .map((o) => {
      const total = offresAccessionPour(modele).find((x) => x.cle === o.cle)!.montantTotal;
      return `${modele} : ${f(o.redevanceJournaliere)} F/j sur ${o.dureeMois} mois = ${f(total)} FCFA`;
    }),
);
if (provisoires.length > 0) {
  console.log("\n  /!\  Tarifs PROVISOIRES, a faire valider commercialement :");
  provisoires.forEach((p) => console.log(`       ${p}`));
}

console.log(
  `\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "ÉCHECS DÉTECTÉS"} — ${ok} OK, ${ko} KO\n`,
);
process.exit(ko === 0 ? 0 : 1);
