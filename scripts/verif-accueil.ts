/**
 * Contrôle de la page d'accueil — chaque chiffre affiché contre sa source.
 *
 *   npm run dev            (dans un autre terminal)
 *   npm run verif:accueil
 *
 * ── Pourquoi ce script existe ──────────────────────────────────────────────
 * La refonte de l'accueil (2026-11-14) a posé des règles qui ne se voient pas
 * en relisant le code, et qu'une retouche innocente peut casser sans bruit :
 *
 *   — aucune DISPONIBILITÉ annoncée, nulle part. `home-data.ts` l'interdit
 *     depuis le 2026-11-06, les lignes d'`Inventory` ayant été inventées par
 *     le script d'amorçage ;
 *   — aucun MONTANT TOTAL de scooter dans la prose : les totaux vivent dans
 *     la fiche produit, pas dans les sections qui doivent donner envie ;
 *   — un PRIX CONDITIONNÉ ne s'annonce jamais sans sa condition. L'A10 a deux
 *     offres, 3 000 F sans engagement et 2 500 F sur douze mois fermes :
 *     afficher la seconde en vitrine, sans la nommer, serait un piège ;
 *   — les chiffres viennent du CATALOGUE, pas du composant. Ils y étaient
 *     écrits en dur et se trouvaient justes par chance.
 *
 * ── Deux pièges de MESURE, rencontrés en l'écrivant ────────────────────────
 * Next.js réémet tout le contenu dans sa charge RSC en fin de document :
 * compter sur le document entier double chaque occurrence. Et React insère
 * des marqueurs `<!-- -->` entre deux textes voisins, qui deviennent des
 * espaces si on les remplace naïvement et font croire à des fautes de frappe.
 * Les deux sont neutralisés avant toute comparaison — sans quoi ce script
 * signalerait des écarts qui n'existent pas.
 *
 * LECTURE SEULE : aucune écriture, ni en base ni ailleurs.
 */

// `.env.local` UNIQUEMENT : ce script ne doit jamais viser la production.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { OFFRES_ACCESSION, offreAAnnoncer } from "../src/lib/offres";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

let ok = 0;
let ko = 0;

function resultat(bon: boolean, libelle: string, attendu?: string) {
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (!bon && attendu) console.log(`         attendu : ${attendu}`);
}

/** 410000 → « 410 000 », comme `fcfa()` l'écrit dans la page. */
const fr = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ");

async function main() {
  let brut: string;
  try {
    const reponse = await fetch(`${BASE}/`);
    if (reponse.status !== 200) {
      console.error(`L'accueil a répondu ${reponse.status} — le serveur de dev tourne-t-il ?`);
      process.exit(1);
    }
    brut = await reponse.text();
  } catch (erreur) {
    console.error(
      `${BASE} injoignable : ${erreur instanceof Error ? erreur.message : erreur}\n` +
        "Lancez `npm run dev` dans un autre terminal.",
    );
    process.exit(1);
  }

  // Les deux neutralisations décrites en tête de fichier.
  const page = brut.split(/<script>self\.__next_f/)[0]!.replace(/<!--[^>]*-->/g, "");

  const [catalogue, best] = await Promise.all([
    prisma.produit.aggregate({
      where: { estActif: true },
      _count: true,
      _max: { autonomieKm: true },
    }),
    prisma.produit.findMany({
      where: { slug: { in: ["revoo-e52", "revoo-b12", "revoo-a10"] } },
      include: { tarification: true },
    }),
  ]);
  const tarifs = await prisma.tarification.aggregate({
    where: { produit: { estActif: true } },
    _min: { tarifMatinFcfa: true, tarifJourneeFcfa: true, tarif24hFcfa: true },
  });

  const modeles = catalogue._count;
  const autonomieMax = catalogue._max.autonomieKm ?? 0;
  const entree = offreAAnnoncer();

  console.log(`\nAccueil servi par ${BASE}\n`);

  console.log("=== Le bandeau lit le catalogue, il n'écrit plus en dur ===");
  resultat(page.includes(`<dt>${autonomieMax} km</dt>`), `autonomie maximale : ${autonomieMax} km`);
  resultat(page.includes(`<dt>${modeles} modèles</dt>`), `nombre de modèles : ${modeles}`);
  resultat(
    new RegExp(`Voir les\\D*${modeles}\\D*modèles`).test(page.replace(/\s+/g, " ")),
    "le bouton annonce le même nombre",
  );
  resultat(entree !== null, "une offre d'accession est annonçable");
  if (entree) {
    resultat(
      page.includes(`${fr(entree.redevanceJournaliere)} FCFA`),
      `tarif d'entrée : ${fr(entree.redevanceJournaliere)} F`,
    );
    resultat(
      new RegExp(`sans engagement — modèle\\s*${entree.modele}`).test(page.replace(/\s+/g, " ")),
      "la condition « sans engagement » est nommée",
    );
    resultat(!entree.avecEngagement, "le tarif annoncé n'exige AUCUN engagement");
  }
  resultat((page.match(/Dem rek/g) ?? []).length === 1, "« Dem rek » paraît une seule fois");

  console.log("\n=== Best-sellers : données de BASE, pas les tarifs d'accession ===");
  const noms = [...page.matchAll(/lme-bs__nom">([^<]*)/g)].map((m) => m[1]);
  resultat(
    noms.join("|") === "Revoo E52|Revoo B12|Revoo A10",
    "l'ordre de BEST_SELLER_SLUGS est respecté",
    "Revoo E52 | Revoo B12 | Revoo A10",
  );
  for (const slug of ["revoo-e52", "revoo-b12", "revoo-a10"]) {
    const p = best.find((x) => x.slug === slug);
    if (!p) {
      resultat(false, `${slug} absent du catalogue`);
      continue;
    }
    resultat(page.includes(`${p.vitesseMaxKmh} km/h`), `${p.nom} — vitesse`);
    resultat(page.includes(`${p.autonomieKm} km`), `${p.nom} — autonomie`);
    if (p.tarification) {
      resultat(
        page.includes(`<strong>${fr(p.tarification.tarif24hFcfa)} FCFA</strong>`),
        `${p.nom} — les 24 h en titre`,
      );
      resultat(
        page.includes(`Journée : ${fr(p.tarification.tarifJourneeFcfa)} FCFA`),
        `${p.nom} — la journée en seconde ligne`,
      );
    }
  }
  resultat(
    !page.split("lme-formules")[0]!.includes("en accession"),
    "aucun tarif d'accession sur les cartes",
    "ils vivent dans la section accession, qui porte l'image",
  );

  console.log("\n=== Trois façons de rouler : les bornes du catalogue ===");
  const { tarifMatinFcfa, tarifJourneeFcfa, tarif24hFcfa } = tarifs._min;
  if (tarifMatinFcfa) resultat(page.includes(`<strong>${fr(tarifMatinFcfa)} FCFA</strong>`), `demi-journée : ${fr(tarifMatinFcfa)} F`);
  if (tarifJourneeFcfa && tarif24hFcfa) {
    resultat(
      page.includes(`${fr(tarifJourneeFcfa)} FCFA / ${fr(tarif24hFcfa)} FCFA`),
      `journée / 24 h : ${fr(tarifJourneeFcfa)} / ${fr(tarif24hFcfa)} F`,
    );
  }
  resultat(page.includes("Sans engagement"), "la colonne accession nomme l'absence d'engagement");
  resultat(page.includes("Selon le modèle"), "la colonne achat n'annonce aucun montant");

  console.log("\n=== Accession : la remise, mais AVEC sa condition ===");
  const avecEngagement = Object.values(OFFRES_ACCESSION)
    .flat()
    .find((o) => o.avecEngagement && o.differentielSiRupture > 0);
  if (avecEngagement) {
    resultat(
      page.includes(`${fr(avecEngagement.redevanceJournaliere)} FCFA`),
      `la remise ${fr(avecEngagement.redevanceJournaliere)} F est affichée`,
    );
    resultat(
      new RegExp(`${avecEngagement.dureeMois}\\s*mois fermes`).test(page.replace(/\s+/g, " ")),
      "sa durée ferme est nommée au même endroit",
    );
    // Le complément de rupture a QUITTÉ la vitrine le 2026-11-14 : posé sous
    // l'offre qu'il devait porter, il la retenait. Il reste nommé là où on le
    // cherche — la question « Et si j'arrête avant la fin ? » — et in extenso
    // dans le contrat. Les deux contrôles tiennent ensemble : il ne doit pas
    // revenir avant les questions, et il ne doit pas en disparaître.
    // On coupe sur l'ANCRE de la section, qui ne paraît qu'une fois : la
    // classe `lme-questions` est un préfixe partagé par six autres classes,
    // et découper dessus ne donnait qu'un fragment de quelques octets.
    const debutQuestions = page.indexOf('id="questions"');
    const avantQuestions = debutQuestions < 0 ? page : page.slice(0, debutQuestions);
    const apresQuestions = debutQuestions < 0 ? "" : page.slice(debutQuestions);
    // « 500 FCFA » est un MORCEAU de « 2 500 FCFA », la remise affichée juste
    // au-dessus : chercher la sous-chaîne signalait un écart qui n'existait
    // pas. Le chiffre ne compte que s'il n'est pas précédé de ses milliers.
    const rupture = new RegExp(`(?<!\\d\\s)${fr(avecEngagement.differentielSiRupture)} FCFA`);
    resultat(
      !rupture.test(avantQuestions),
      "aucune réserve de rupture dans la vitrine",
      "retirée le 2026-11-14 : elle vit dans les questions et dans le contrat",
    );
    resultat(
      apresQuestions.includes(`${fr(avecEngagement.differentielSiRupture)} FCFA`),
      `le complément de rupture ${fr(avecEngagement.differentielSiRupture)} F est nommé dans les questions`,
    );
  }

  console.log("\n=== Les sections sont là, et complètes ===");
  resultat((page.match(/lme-parcours__etape"/g) ?? []).length === 4, "quatre étapes de réservation");
  resultat((page.match(/class="lme-question"/g) ?? []).length === 5, "cinq questions fréquentes");
  resultat((page.match(/lme-agence__plan/g) ?? []).length === 2, "deux agences, deux plans");
  resultat(
    ["70 367 75 75", "77 232 02 35", "70 001 91 93", "76 372 83 40"].every((n) => page.includes(n)),
    "les quatre numéros, dont les trois de Thiès",
  );
  resultat(
    (page.match(/lme-video__declencheur/g) ?? []).length === 3 && !page.includes("<video"),
    "trois vidéos, et AUCUNE chargée avant le clic",
  );
  resultat(page.includes(`${modeles} modèles Revoo`), "l'appel final compte les modèles du catalogue");
  resultat(page.includes('class="lme-flottant__numero">77 232 02 35'), "le numéro est lisible sans cliquer");
  resultat(page.includes("wa.me/+221772320235"), "WhatsApp est joignable");

  console.log("\n=== Ce qui ne doit JAMAIS y revenir ===");
  resultat(!/en stock|Disponible en agence/i.test(page), "aucune disponibilité annoncée");
  resultat(
    !/970 000|860 000|650 000|520 000|410 000/.test(page),
    "aucun total de scooter dans la prose",
    "les totaux vivent dans la fiche produit",
  );
  resultat(
    !/hero-slider|slideshow-item|promo__|cta-catalogue|videos-carousel|contact-branch|page-footer__top|lme-explorer/.test(page),
    "aucune classe de l'ancien thème",
  );
  resultat(!/À RENSEIGNER|À FOURNIR/i.test(page), "aucun emplacement laissé vide");

  console.log(
    `\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "DES ÉCARTS"} — ${ok} OK, ${ko} KO\n`,
  );
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

void main();
