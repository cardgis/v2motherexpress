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
  // « Dem rek » a d'abord été un filigrane répété sur chaque diapositive, puis
  // une signature unique en sur-titre. La pastille qui la portait — avec
  // « Partenaire officiel Revoo · Thiès & Mbour », son fond et sa bordure — a
  // été retirée le 2026-11-19 : trois informations de second rang que le
  // regard devait franchir avant d'arriver à ce qu'on vend. Le contrôle est
  // retourné pour qu'elle ne revienne pas par habitude.
  resultat(!/Dem rek/.test(page), "aucune pastille « Dem rek » au-dessus du titre");
  // Borné AU BANDEAU : « Partenaire officiel Revoo » vit aussi dans le pied de
  // page, où il a toute sa place. C'est la pastille du bandeau qui est partie,
  // pas la mention partout.
  const bandeau = page.slice(0, page.indexOf('id="best"') + 1 || page.length);
  resultat(
    !/Partenaire officiel Revoo/.test(bandeau),
    "ni sa mention « Partenaire officiel Revoo » dans le bandeau",
    "elle reste dans le pied de page, et c'est voulu",
  );

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
      // La seconde ligne « Journée : … » a été retirée le 2026-11-19 : la
      // location se compte en 24 heures, et afficher deux durées obligeait le
      // visiteur à choisir entre l'une qu'on propose et l'autre qu'on ne
      // propose pas. On garde le contrôle, retourné.
      resultat(
        !page.includes(`Journée : ${fr(p.tarification.tarifJourneeFcfa)} FCFA`),
        `${p.nom} — aucune seconde ligne « Journée »`,
        "la location se compte en 24 heures",
      );
    }
  }
  resultat(
    !page.split("lme-formules")[0]!.includes("en accession"),
    "aucun tarif d'accession sur les cartes",
    "ils vivent dans la section accession, qui porte l'image",
  );

  // ══ La grille de location ═══════════════════════════════════════════════
  //
  // Elle est arrivée le 2026-11-20 avec la grille officielle, et elle affiche
  // QUATRE créneaux par modèle — ce qu'on avait retiré la veille des cartes,
  // et qui revient ici, à un seul endroit, où l'on vient les consulter.
  //
  // Chaque montant est confronté à `Tarification`. C'est le contrôle le plus
  // utile de ce fichier : une grille est exactement le genre de tableau qu'on
  // recopie à la main « vite fait » le jour d'un changement de prix, et qui
  // se met alors à mentir au client qui l'a lue avant de venir.
  console.log("\n=== La grille de location : chaque case contre la base ===");

  const grilleBase = await prisma.produit.findMany({
    where: { estActif: true, tarification: { isNot: null } },
    select: { nom: true, tarification: true },
  });

  const grilleHtml = (() => {
    const i = page.indexOf('class="lme-grille__table"');
    return i < 0 ? "" : page.slice(i, page.indexOf("</table>", i));
  })();
  resultat(grilleHtml.length > 0, "la section des tarifs est rendue");

  for (const p of grilleBase) {
    const t = p.tarification!;
    const nom = p.nom.replace(/^Revoo\s+/i, "");
    const attendus: [string, number][] = [
      ["8h-13h", t.tarifMatinFcfa],
      ["14h-19h", t.tarifApresMidiFcfa],
      ["8h-19h", t.tarifJourneeFcfa],
      ["24 h", t.tarif24hFcfa],
    ];
    const manquants = attendus.filter(([, v]) => !grilleHtml.includes(`${fr(v)} FCFA`));
    resultat(
      manquants.length === 0,
      `${nom} — ses quatre créneaux sont au tableau (${attendus.map(([, v]) => fr(v)).join(" / ")})`,
      manquants.length > 0 ? `absents : ${manquants.map(([c]) => c).join(", ")}` : undefined,
    );
    resultat(grilleHtml.includes(`${t.kmInclus} km`), `${nom} — ${t.kmInclus} km inclus`);
  }

  // Le C32 lithium n'est PAS au grilleBase : il viendra. Il figure au tableau,
  // signalé comme tel, et nulle part ailleurs — surtout pas dans le nombre de
  // modèles annoncé par l'appel final.
  resultat(grilleHtml.includes("C32 lithium"), "le C32 lithium figure au tableau");
  resultat(
    /C32 lithium[\s\S]{0,200}bientôt/.test(grilleHtml),
    "et il est signalé « bientôt », pas comme un modèle disponible",
  );
  resultat(
    !(await prisma.produit.findFirst({ where: { nom: { contains: "lithium", mode: "insensitive" } } })),
    "il n'est pas entré au catalogue par mégarde",
    "lui créer une fiche le rendrait réservable alors qu'il n'existe pas en boutique",
  );

  // Le forfait kilométrique est sorti du tableau parce qu'il valait la même
  // chose partout. La phrase doit donc dire la valeur RÉELLE, pas une
  // constante qu'on aurait figée.
  const forfaits = new Set(grilleBase.map((p) => p.tarification!.tarifKmSupplementaire));
  if (forfaits.size === 1) {
    const forfait = [...forfaits][0]!;
    resultat(
      page.includes(`${fr(forfait)} FCFA par tranche de 10 km`),
      `le forfait kilométrique annoncé est celui du catalogue (${fr(forfait)} F / 10 km)`,
    );
  }

  resultat(
    !/casque/i.test(grilleHtml),
    "aucun tarif de casque dans le tableau",
    "écarté par Alexandre : un accessoire à 500 F n'aide pas à choisir un scooter",
  );
  resultat(
    !/70 001 91 93/.test(grilleHtml),
    "ni le numéro de téléphone du tableau papier",
    "l'accueil le donne déjà dans les agences, la capsule et le pied",
  );

  console.log("\n=== Trois façons de rouler : les bornes du catalogue ===");
  const { tarifMatinFcfa, tarifJourneeFcfa, tarif24hFcfa } = tarifs._min;

  // UNE SEULE DURÉE, LES 24 HEURES (Alexandre, 2026-11-19) : « on ne fait pas
  // pour 4 heures, 2 heures ». La colonne annonçait auparavant la
  // demi-journée en titre puis « Journée / 24 h » en dessous — trois durées
  // pour une formule, dont deux qui ne sont pas proposées.
  if (tarif24hFcfa) {
    resultat(
      page.includes(`<strong>${fr(tarif24hFcfa)} FCFA</strong>`),
      `les 24 heures : ${fr(tarif24hFcfa)} F`,
    );
  }
  if (tarifMatinFcfa) {
    resultat(
      !page.includes(`<strong>${fr(tarifMatinFcfa)} FCFA</strong>`),
      "aucune demi-journée annoncée",
      `${fr(tarifMatinFcfa)} F est le tarif matin : il existe au catalogue, il ne s'affiche plus ici`,
    );
  }
  if (tarifJourneeFcfa && tarif24hFcfa) {
    resultat(
      !page.includes(`${fr(tarifJourneeFcfa)} FCFA / ${fr(tarif24hFcfa)} FCFA`),
      "aucune ligne « Journée / 24 h »",
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
    // Le complément de rupture a QUITTÉ L'ACCUEIL ENTIÈREMENT le 2026-11-14,
    // en deux temps : d'abord la note sous l'offre d'accession, puis la
    // question « Et si j'arrête avant la fin ? ». Une réserve n'a pas sa
    // place sur une page qui doit donner envie ; le contrat la porte in
    // extenso, et c'est là qu'elle engage.
    //
    // « 500 FCFA » est un MORCEAU de « 2 500 FCFA », la remise affichée plus
    // haut : chercher la sous-chaîne signalait un écart qui n'existait pas.
    // Le chiffre ne compte que s'il n'est pas précédé de ses milliers.
    const rupture = new RegExp(`(?<!\\d\\s)${fr(avecEngagement.differentielSiRupture)} FCFA`);
    resultat(
      !rupture.test(page),
      "aucune réserve de rupture, nulle part",
      "retirée le 2026-11-14 ; elle vit dans le contrat, pas dans la vitrine",
    );
  }

  console.log("\n=== Les sections sont là, et complètes ===");
  resultat((page.match(/lme-parcours__etape"/g) ?? []).length === 4, "quatre étapes de réservation");
  // Quatre, et non cinq : « Et si j'arrête avant la fin ? » est partie le
  // 2026-11-14, comme « Qui paie l'entretien ? » l'avait fait la veille.
  resultat((page.match(/class="lme-question"/g) ?? []).length === 4, "quatre questions fréquentes");
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
    !/970 000|860 000|650 000|520 000|360 000/.test(page),
    "aucun total de scooter dans la prose",
    "les totaux vivent dans la fiche produit",
  );
  resultat(
    !/hero-slider|slideshow-item|promo__|cta-catalogue|videos-carousel|contact-branch|page-footer__top|lme-explorer/.test(page),
    "aucune classe de l'ancien thème",
  );
  resultat(!/À RENSEIGNER|À FOURNIR/i.test(page), "aucun emplacement laissé vide");
  // Le thème V1 a été entièrement décroché le 2026-11-14 — ses quatre
  // derniers fichiers pesaient 655 Ko sur chaque page. Ce contrôle empêche
  // qu'une balise revienne par mégarde, et avec elle le `a:hover` rouge.
  resultat(
    !/assets\/(css|js)\/(main|uikit)[.-]|class="[^"]*\buk-/.test(page),
    "aucun fichier ni aucune classe d'UIkit",
    "l'en-tête est dessiné par `styles/entete.css`, seul",
  );
  // Oswald dessine TOUS les titres du site, et sa déclaration `@font-face`
  // vivait dans `main.css` : la supprimer sans la reprendre laissait une page
  // parfaitement valide, qui changeait de visage sans rien signaler. On
  // vérifie donc les deux bouts — la déclaration, et le fichier.
  const feuilles = [...page.matchAll(/href="(\/_next\/[^"]+\.css)[^"]*"/g)].map((m) => m[1]!);
  const declarations = await Promise.all(
    feuilles.map(async (f) => (await fetch(`${BASE}${f}`)).text()),
  );
  resultat(
    declarations.some((c) => c.includes("Oswald-Regular.woff2")),
    "Oswald est déclarée dans le CSS servi",
    "sa déclaration vivait dans `main.css` ; elle est désormais dans le socle de `globals.css`",
  );
  const police = await fetch(`${BASE}/assets/fonts/Oswald-Regular.woff2`);
  resultat(police.status === 200, "et le fichier de police répond");

  console.log(
    `\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "DES ÉCARTS"} — ${ok} OK, ${ko} KO\n`,
  );
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

void main();
