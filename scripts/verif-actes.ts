/**
 * Contrôle de non-régression du TEXTE des actes.
 *
 * Une clause qui disparaît d'un contrat ne casse aucun test de compilation :
 * le PDF se génère très bien sans elle. Ce script relit donc le texte
 * réellement présent dans les octets produits et vérifie que les clauses qui
 * portent la valeur juridique y sont — notamment la règle des six jours sur
 * sept et, sur la formule avec engagement, l'article du différentiel et sa
 * mention manuscrite.
 *
 *   npm run verif:actes
 */

import zlib from "node:zlib";

import { composerContratAccession } from "../src/lib/contrats/accession";
import { composerContratVente } from "../src/lib/contrats/vente";
import { composerContratJournaliere } from "../src/lib/contrats/journaliere";
import { composerConstatRemise, type DonneesConstat } from "../src/lib/contrats/pv-remise";
import { composerAttestation, type DonneesAttestation } from "../src/lib/contrats/attestation";
import {
  composerConstatRestitution,
  type DonneesConstatRestitution,
} from "../src/lib/contrats/pv-restitution";
import { BAILLEUR, type SnapshotContrat } from "../src/lib/contrats/snapshot";

// ---------------------------------------------------------------------------
// Extraction du texte d'un PDF
// ---------------------------------------------------------------------------

/**
 * Relit les chaînes affichées par les opérateurs `Tj` des flux de contenu.
 * Suffisant pour vérifier une présence de clause — ce n'est pas un extracteur
 * complet, il ne restitue ni l'ordre des colonnes ni la mise en page.
 */
function texteDuPdf(octets: Uint8Array): string {
  const buffer = Buffer.from(octets);
  const latin = buffer.toString("latin1");
  let texte = "";

  const debutFlux = /stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = debutFlux.exec(latin)) !== null) {
    const debut = m.index + m[0].length;
    const fin = latin.indexOf("endstream", debut);
    if (fin < 0) continue;

    const brut = buffer.subarray(debut, fin);
    let clair: string;
    try {
      clair = zlib.inflateSync(brut).toString("latin1");
    } catch {
      clair = brut.toString("latin1"); // flux non compressé
    }

    // pdf-lib encode le texte des polices standard en chaînes HEXADÉCIMALES
    // (`<48656C6C6F> Tj`) et non en littéraux entre parenthèses. Les deux
    // formes sont acceptées ici, le format PDF autorisant l'une et l'autre.
    for (const t of clair.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
      const hex = t[1]!.replace(/\s+/g, "");
      texte += Buffer.from(hex, "hex").toString("latin1") + " ";
    }
    for (const t of clair.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)) {
      texte += t[1]!.replace(/\\([()\\])/g, "$1") + " ";
    }
  }

  // Les espaces multiples brouillent les recherches de phrases entières.
  return texte.replace(/\s+/g, " ");
}

/** Flux de contenu décompressés, un par page (ou par ajout de contenu). */
function fluxDuPdf(octets: Uint8Array): string[] {
  const buffer = Buffer.from(octets);
  const latin = buffer.toString("latin1");
  const flux: string[] = [];
  const debutFlux = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = debutFlux.exec(latin)) !== null) {
    const debut = m.index + m[0].length;
    const fin = latin.indexOf("endstream", debut);
    if (fin < 0) continue;
    try {
      flux.push(zlib.inflateSync(buffer.subarray(debut, fin)).toString("latin1"));
    } catch {
      // flux binaire (police, image) : sans texte ni tracé utile ici
    }
  }
  return flux;
}

/**
 * Libellés des cases COCHÉES, dans l'ordre d'impression.
 *
 * Une case cochée est dessinée par `cases()` en deux traits obliques de
 * 0,9 pt ; son libellé est écrit juste à droite, sur la même ligne. On
 * retrouve donc la croix (`x y m … x2 y2 l`, montante) puis le texte dont
 * l'origine est à moins de 4 pt à droite et à la même hauteur. Compter des
 * traits ne suffirait pas : il faut savoir QUELLE case porte la croix.
 */
function casesCochees(octets: Uint8Array): string[] {
  const libelles: string[] = [];
  for (const contenu of fluxDuPdf(octets)) {
    const textes = [...contenu.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm\s*<([0-9A-Fa-f]+)> Tj/g)].map((t) => ({
      x: Number(t[1]),
      y: Number(t[2]),
      texte: Buffer.from(t[3]!, "hex").toString("latin1").trim(),
    }));
    const croix = [...contenu.matchAll(/([\d.]+) ([\d.]+) m\s+[\d.]+ [\d.]+ m\s+([\d.]+) ([\d.]+) l/g)]
      .map((c) => ({ x1: Number(c[1]), y1: Number(c[2]), x2: Number(c[3]), y2: Number(c[4]) }))
      // Diagonale montante seulement : une croix n'est comptée qu'une fois.
      .filter((c) => c.x2 > c.x1 && c.y2 > c.y1);

    for (const c of croix) {
      const libelle = textes.find((t) => t.x - c.x2 > 0 && t.x - c.x2 < 4 && Math.abs(t.y - (c.y1 - 2.6)) < 3);
      if (libelle) libelles.push(libelle.texte);
    }
  }
  return libelles;
}

// ---------------------------------------------------------------------------
// Jeu d'essai
// ---------------------------------------------------------------------------

const COMMUN = {
  dateEmission: "10/09/2026",
  bailleurRaisonSociale: BAILLEUR.raisonSociale,
  bailleurNinea: BAILLEUR.ninea,
  bailleurSiege: BAILLEUR.siege,
  bailleurRepresentant: "NASSALAN Frédéric Olivier",
  bailleurAdresseBoutique: "Route de Fatick, quartier Téfess, Mbour",
  // Valeurs propres à la location journalière : « Néant » partout ailleurs,
  // comme les pointillés laissés vides sur les contrats papier.
  departLe: "Néant",
  retourLe: "Néant",
  dureeLocation: "Néant",
  tarifLocation: "Néant",
  montantCaution: "Néant",
  limiteKm: "Néant",
  forfaitKmSupplementaires: "Néant",
  zoneUtilisation: "Néant",
  etatGeneral: "Néant",
  clientNomComplet: "SARR Abdoulaye",
  clientNumeroPiece: "1 07 20011011 000060",
  clientAdresse: "Grand Mbour",
  clientTelephone: "+221 78 455 92 90",
  vehiculeImmatriculation: "Néant",
  vehiculeCmc: "Néant",
  lieuSignature: "Mbour",
  dateSignature: "17/08/2026",
  echeances: [],
  montantTotalIndicatif: "0 FCFA",
  joursFacturesIndicatif: null,
  prixTotal: "860 000 FCFA",
  temoinNom: "NDIAYE Moussa",
} satisfies Partial<SnapshotContrat>;

const ACCESSION_24: SnapshotContrat = {
  ...COMMUN,
  reference: "LME-2026-MBR-0001",
  formule: "LOCATION_ACCESSION",
  vehiculeMarqueModele: "REVOO / B12",
  vehiculeNumeroSerie: "HB3BH2108S9110183",
  vehiculeValeurReference: "860 000 FCFA",
  dureeMois: 24,
  dateDebut: "17/08/2026",
  dateFin: "17/08/2028",
  redevanceJournaliere: "5 000 FCFA",
  avecEngagement: false,
  tarifSansEngagement: "Néant",
  differentielJournalier: "Néant",
};

const ACCESSION_12_ENGAGEMENT: SnapshotContrat = {
  ...ACCESSION_24,
  reference: "LME-2026-THS-0003",
  vehiculeMarqueModele: "REVOO / A10",
  vehiculeValeurReference: "410 000 FCFA",
  dureeMois: 12,
  dateFin: "17/08/2027",
  redevanceJournaliere: "2 500 FCFA",
  avecEngagement: true,
  tarifSansEngagement: "3 000 FCFA",
  differentielJournalier: "500 FCFA",
};

const VENTE: SnapshotContrat = {
  ...COMMUN,
  reference: "LME-2026-MBR-0004",
  formule: "VENTE_ECHELONNEE",
  clientNomComplet: "DIOP Omar",
  clientNumeroPiece: "1596200100848",
  vehiculeMarqueModele: "REVOO / B12",
  vehiculeNumeroSerie: "HB3BH2105S9120069",
  vehiculeCmc: "2026 14V 12239",
  vehiculeValeurReference: "860 000 FCFA",
  dureeMois: null,
  dateDebut: "25/06/2026",
  dateFin: "Néant",
  redevanceJournaliere: "Néant",
  avecEngagement: false,
  tarifSansEngagement: "Néant",
  differentielJournalier: "Néant",
};

/**
 * Location journalière. C'est l'acte le plus riche en valeurs saisies par le
 * gérant : heures, caution, kilométrage, zone, état — aucune ne se déduit du
 * catalogue.
 */
const JOURNALIERE: SnapshotContrat = {
  ...COMMUN,
  reference: "LME-2026-THS-0210",
  formule: "LOCATION_JOURNALIERE",
  clientNomComplet: "FALL Aminata",
  vehiculeMarqueModele: "REVOO / A10",
  vehiculeNumeroSerie: "HB3BH2109T9104412",
  vehiculeImmatriculation: "R 4412",
  vehiculeValeurReference: "410 000 FCFA",
  dureeMois: null,
  dateDebut: "12/09/2026",
  dateFin: "15/09/2026",
  redevanceJournaliere: "Néant",
  avecEngagement: false,
  tarifSansEngagement: "Néant",
  differentielJournalier: "Néant",

  departLe: "12/09/2026 à 08h30",
  retourLe: "15/09/2026 à 18h00",
  dureeLocation: "3 jours",
  tarifLocation: "27 000 FCFA",
  montantCaution: "50 000 FCFA",
  limiteKm: "300 km",
  forfaitKmSupplementaires: "1 000 FCFA par km",
  zoneUtilisation: "Région de Thiès",
  etatGeneral: "Bon état, rayure légère sur le garde-boue arrière",
};

/**
 * Attestation de versement — reçu du premier versement de la vente DIOP Omar,
 * repris du modèle papier : 60 % encaissés, quatre échéances restantes.
 */
const ATTESTATION: DonneesAttestation = {
  reference: "LME-2026-MBR-0004",
  formule: "VENTE_ECHELONNEE",
  bailleurRaisonSociale: BAILLEUR.raisonSociale,
  bailleurNinea: BAILLEUR.ninea,
  bailleurSiege: BAILLEUR.siege,
  bailleurRepresentant: "NASSALAN Frédéric Olivier",
  clientNomComplet: "DIOP Omar",
  clientNumeroPiece: "1596200100848",
  montantVerse: "516 000 FCFA",
  datePaiement: "25/06/2026",
  mode: "ESPECES",
  montantRestantDu: "344 000 FCFA",
  echeances: [
    { libelle: "1er (60 %)", cochee: true },
    { libelle: "2e (10 %)", cochee: false },
    { libelle: "3e (10 %)", cochee: false },
    { libelle: "4e (10 %)", cochee: false },
    { libelle: "5e (10 %)", cochee: false },
  ],
  signaturesReprisesDu: "Signatures reprises du contrat LME-2026-MBR-0004, signé le 25/06/2026.",
  lieuSignature: "Mbour",
  dateSignature: "25/06/2026",
};

/**
 * Constat de remise. Sans photo : `grilleImages` n'imprime rien quand la liste
 * est vide, et ce qui est vérifié ici est le texte, pas l'incrustation.
 */
const CONSTAT: DonneesConstat = {
  reference: "LME-2026-THS-0003",
  formule: "LOCATION_ACCESSION",
  dureeMois: 12,
  vehiculeMarqueModele: "REVOO / A10",
  vehiculeNumeroSerie: "HB3BH2104T9103507",
  clientNomComplet: "SARR Abdoulaye",
  clientNumeroPiece: "1 07 20011011 000060",
  clientTelephone: "+221 78 455 92 90",
  bailleurSignataire: "MENDY Lazare Evariste",
  pieceVerifieePar: "MENDY Lazare Evariste",
  pieceVerifieeLe: "17/08/2026 14:22:07",
  signaturesReprisesDu: "Signatures reprises du contrat LME-2026-THS-0003, signé le 17/08/2026.",
  dateRemise: "17/08/2026",
  heureRemise: "14h30",
  compteurKm: 12,
  carrosserie: "NEUF",
  freinsPneus: "NEUF",
  batterieChargeur: "OCCASION",
  accessoires: "COMPLETS",
  accessoiresPrecision: null,
  observations: null,
  photos: [],
};

/**
 * Constat de restitution : rupture anticipée d'une accession A10 avec
 * engagement, rendue avec des dégâts. Le cas le plus chargé — il porte les
 * trois sommes à la fois.
 */
const RESTITUTION: DonneesConstatRestitution = {
  reference: "LME-2026-THS-0003",
  formule: "LOCATION_ACCESSION",
  dureeMois: 12,
  vehiculeMarqueModele: "REVOO / A10",
  vehiculeNumeroSerie: "HB3BH2108S9110183",
  clientNomComplet: "SARR Abdoulaye",
  clientNumeroPiece: "1 07 20011011 000060",
  clientTelephone: "+221 78 455 92 90",
  bailleurSignataire: "MENDY Lazare Evariste",
  contratReference: "LME-2026-THS-0003",
  contratSigneLe: "17/08/2026",
  motif: "RUPTURE_ANTICIPEE",
  motifPrecision: null,
  dateRestitution: "27/09/2026",
  heureRestitution: "16h10",
  compteurKm: 4300,
  compteurKmRemise: 12,
  carrosserie: "USURE_NORMALE",
  freinsPneus: "DEGRADATIONS",
  batterieChargeur: "USURE_NORMALE",
  accessoires: "COMPLETS",
  accessoiresPrecision: null,
  dommagesConstates: true,
  dommagesPrecision: "Plaquettes de frein avant hors d'usage, jante arrière voilée.",
  redevancesImpayees: "45 000 FCFA",
  coutReparations: "30 000 FCFA",
  differentielRupture: "156 000 FCFA",
  differentielJours: 312,
  totalDu: "231 000 FCFA",
  observations: null,
  photos: [],
};

// ---------------------------------------------------------------------------

let ok = 0;
let ko = 0;

function verifie(libelle: string, condition: boolean) {
  if (condition) ok++;
  else ko++;
  console.log(`  ${condition ? "OK" : "KO"}   ${libelle}`);
}

function contient(texte: string, attendu: string): boolean {
  return texte.includes(attendu);
}

async function main() {
  // ── Accession 24 mois, sans engagement ───────────────────────────────────
  console.log("\n=== Location-accession 24 mois (B12, sans engagement) ===");
  const a24 = await composerContratAccession(ACCESSION_24);
  const t24 = texteDuPdf(a24.octets);

  verifie("titre de l'acte", contient(t24, "CONTRAT DE LOCATION-ACCESSION DE MOTO"));
  verifie("NINEA de l'entreprise", contient(t24, "008246888"));
  verifie("représentant de la boutique", contient(t24, "NASSALAN Frédéric Olivier"));
  verifie("identité du locataire", contient(t24, "SARR Abdoulaye"));

  // ── Le témoin, sur les trois contrats ─────────────────────────────────────
  // Ce bloc est la raison d'être de VERSION_MODELES = 2. On vérifie les trois
  // éléments qui donnent sa valeur au témoin, et le mot qui change d'un acte à
  // l'autre : « Accédant » ici, « Acheteur » pour la vente, « Locataire » pour
  // le journalier.
  verifie("témoin : son cadre de signature", contient(t24, "LE TÉMOIN"));
  verifie("témoin : son nom", contient(t24, "NDIAYE Moussa"));
  verifie("témoin : la prise de connaissance", contient(t24, "avoir pris connaissance du présent contrat"));
  verifie("témoin : l'attestation d'identité et de consentement", contient(t24, "atteste de l'identité et du consentement"));
  verifie("témoin : le mot propre à l'accession", contient(t24, "consentement de l'Accédant"));
  verifie(
    "témoin : la limite de son engagement est ÉCRITE",
    contient(t24, "ne constitue pas un cautionnement") && contient(t24, "aucune obligation financière"),
  );
  verifie("témoin : un emplacement de signature lui est réservé", a24.emplacements.temoin !== undefined);
  verifie("numéro de pièce", contient(t24, "1 07 20011011 000060"));
  verifie("numéro de série du véhicule", contient(t24, "HB3BH2108S9110183"));
  verifie("valeur de référence", contient(t24, "860 000 FCFA"));
  verifie("durée en toutes lettres", contient(t24, "vingt-quatre (24) mois"));
  verifie("redevance journalière", contient(t24, "5 000 FCFA par jour"));
  verifie(
    "RÈGLE DES 6 JOURS SUR 7",
    contient(t24, "due six (6) jours sur sept (7) par semaine"),
  );
  verifie("réserve de propriété", contient(t24, "propriété exclusive"));
  verifie("clause GPS", contient(t24, "dispositif GPS"));
  verifie("droit sénégalais", contient(t24, "République du Sénégal"));
  verifie("sans article de différentiel", !contient(t24, "tarif préférentiel"));
  verifie("13 articles", contient(t24, "Article 13 - Droit applicable"));
  verifie("3 pages", a24.pages === 3);

  // ── Accession 12 mois AVEC engagement ────────────────────────────────────
  console.log("\n=== Location-accession 12 mois (A10, AVEC engagement) ===");
  const a12 = await composerContratAccession(ACCESSION_12_ENGAGEMENT);
  const t12 = texteDuPdf(a12.octets);

  verifie("sous-titre de la formule", contient(t12, "FORMULE AVEC ENGAGEMENT"));
  verifie("durée ferme de douze mois", contient(t12, "durée ferme de douze (12) mois"));
  verifie("redevance préférentielle", contient(t12, "2 500 FCFA par jour"));
  verifie(
    "ARTICLE 5 - tarif préférentiel",
    contient(t12, "Article 5 - Tarif préférentiel et différentiel"),
  );
  verifie("tarif de référence rappelé", contient(t12, "3 000 FCFA par jour"));
  verifie("différentiel de 500 F/j", contient(t12, "cinq cents (500) FCFA par jour"));
  verifie(
    "différentiel dû sur la TOTALITÉ des jours",
    contient(t12, "calculé sur la totalité des jours de location facturés"),
  );
  verifie(
    "renvoi à l'article 5 dans l'absence de paiement",
    contient(t12, "rend exigible le différentiel prévu à l'article 5"),
  );
  verifie(
    "MENTION MANUSCRITE exigée",
    contient(t12, "Lu et approuvé, je reconnais avoir pris connaissance de l'article 5"),
  );
  verifie("14 articles (un de plus)", contient(t12, "Article 14 - Droit applicable"));
  verifie("4 pages", a12.pages === 4);

  // ── Vente échelonnée ─────────────────────────────────────────────────────
  console.log("\n=== Vente avec paiement échelonné ===");
  const v = await composerContratVente(VENTE);

  const tv = texteDuPdf(v.octets);
  // Le témoin sur la vente : même bloc, mais « de l'Acheteur ».
  verifie("vente — témoin : son cadre", contient(tv, "LE TÉMOIN"));
  verifie("vente — témoin : le mot propre à la vente", contient(tv, "consentement de l'Acheteur"));
  verifie("vente — témoin : emplacement réservé", v.emplacements.temoin !== undefined);

  verifie("titre de l'acte", contient(tv, "CONTRAT DE VENTE DE MOTO"));
  verifie("sous-titre", contient(tv, "AVEC PAIEMENT ÉCHELONNÉ"));
  verifie("identité de l'acheteur", contient(tv, "DIOP Omar"));
  verifie("CMC du véhicule", contient(tv, "2026 14V 12239"));
  verifie("prix total", contient(tv, "860 000 FCFA"));
  verifie("acompte de 60 %", contient(tv, "60 % du prix total à la signature"));
  verifie("échéance à 30 jours", contient(tv, "trente (30) jours"));
  verifie("échéance à 60 jours", contient(tv, "soixante (60) jours"));
  verifie("échéance à 90 jours", contient(tv, "quatre-vingt-dix (90) jours"));
  verifie("échéance à 120 jours", contient(tv, "cent vingt (120) jours"));
  verifie("réserve de propriété jusqu'au paiement", contient(tv, "jusqu'au paiement intégral"));
  verifie("solde exigible en cas de perte totale", contient(tv, "perte totale du véhicule"));
  verifie("13 articles", contient(tv, "Article 13 - Droit applicable"));
  verifie("3 pages", v.pages === 3);

  // ── Modes de paiement cochés par le gérant ───────────────────────────────
  console.log("\n=== Modes de paiement ===");
  verifie("snapshot sans modes (ancien contrat) : aucune case cochée", casesCochees(a24.octets).length === 0);
  verifie(
    "accession : les quatre libellés d'origine restent imprimés",
    ["En espèces", "Par Wave", "Par Orange Money", "Par virement bancaire"].every((l) => contient(t24, l)),
  );

  const a24Modes = await composerContratAccession({ ...ACCESSION_24, modesPaiement: ["WAVE", "VIREMENT"] });
  const cochesAccession = casesCochees(a24Modes.octets);
  verifie(
    `accession : seules « Par Wave » et « Par virement bancaire » sont cochées (${cochesAccession.join(", ")})`,
    cochesAccession.join("|") === "Par Wave|Par virement bancaire",
  );
  verifie("accession : texte identique, cocher ne change que les croix", texteDuPdf(a24Modes.octets) === t24);
  verifie("accession : même nombre de pages", a24Modes.pages === a24.pages);

  const vModes = await composerContratVente({ ...VENTE, modesPaiement: ["ESPECES", "ORANGE_MONEY"] });
  const cochesVente = casesCochees(vModes.octets);
  // La case d'état de l'article 9 s'ajoute désormais aux modes : l'acte ne
  // laisse plus la question sans réponse. L'ordre est celui de l'impression.
  verifie(
    `vente : les deux modes convenus, plus l'état de l'article 9 (${cochesVente.join(", ")})`,
    cochesVente.join("|") === "Espèces|Orange Money|Neuf",
  );
  verifie("vente : texte identique", texteDuPdf(vModes.octets) === tv);

  const tous = await composerContratVente({ ...VENTE, modesPaiement: ["ESPECES", "WAVE", "ORANGE_MONEY", "VIREMENT"] });
  verifie("vente : les quatre modes cochés, plus l'état", casesCochees(tous.octets).length === 5);

  // ── Vente : état du véhicule et prix saisis par le gérant ────────────────
  console.log("\n=== Vente : état du véhicule et prix ===");

  // Sans valeur — snapshot figé avant l'ajout du champ — l'acte doit imprimer
  // « Neuf » exactement comme il le faisait en dur.
  verifie("par défaut : l'article 2 annonce « Neuf »", contient(tv, "État du véhicule au moment de la vente : Neuf"));
  verifie("par défaut : la case « Neuf » de l'article 9 est cochée", casesCochees(v.octets).includes("Neuf"));
  verifie("par défaut : « D'occasion » n'est PAS cochée", !casesCochees(v.octets).includes("D'occasion"));

  const vOccasion = await composerContratVente({ ...VENTE, etatVenteVehicule: "D'occasion" });
  const tvOccasion = texteDuPdf(vOccasion.octets);
  const cochesOccasion = casesCochees(vOccasion.octets);

  verifie(
    "occasion : l'article 2 annonce « D'occasion »",
    contient(tvOccasion, "État du véhicule au moment de la vente : D'occasion"),
  );
  verifie("occasion : la case « D'occasion » est cochée", cochesOccasion.includes("D'occasion"));
  verifie("occasion : « Neuf » n'est PAS cochée", !cochesOccasion.includes("Neuf"));
  verifie(
    "les DEUX libellés de l'article 9 restent imprimés dans les deux cas",
    contient(tv, "Neuf") && contient(tv, "D'occasion") &&
      contient(tvOccasion, "Neuf") && contient(tvOccasion, "D'occasion"),
  );
  verifie("occasion : même nombre de pages", vOccasion.pages === v.pages);

  // Le prix de l'article 3 est une VALEUR : le gérant le corrige quand le
  // tarif a changé, et c'est lui dont l'échéancier tire les 60 %.
  const vPrixCorrige = await composerContratVente({ ...VENTE, prixTotal: "790 000 FCFA" });
  const tvPrix = texteDuPdf(vPrixCorrige.octets);
  verifie("prix corrigé : imprimé à l'article 3", contient(tvPrix, "Le prix total est fixé à : 790 000 FCFA"));
  verifie("prix corrigé : l'ancien prix ne figure plus", !contient(tvPrix, "860 000 FCFA"));
  verifie(
    "prix corrigé : les pourcentages de l'article 3 sont inchangés",
    contient(tvPrix, "Premier versement : 60 % du prix total à la signature du contrat."),
  );

  // ── Emplacements de signature ────────────────────────────────────────────
  console.log("\n=== Emplacements de signature (lot 5) ===");
  for (const [nom, acte] of [
    ["accession 24 mois", a24],
    ["accession 12 mois", a12],
    ["vente", v],
  ] as const) {
    const { client, gerant } = acte.emplacements;
    verifie(
      `${nom} : deux emplacements sur la dernière page`,
      client.page === acte.pages - 1 && gerant.page === acte.pages - 1,
    );
    verifie(
      `${nom} : le gérant signe au-dessus du client`,
      gerant.y > client.y,
    );
  }

  // ── Location journalière ─────────────────────────────────────────────────
  console.log("\n=== Location journalière ===");
  const j = await composerContratJournaliere(JOURNALIERE);
  const tj = texteDuPdf(j.octets);

  // Le témoin sur le journalier : « du Locataire ».
  verifie("journalier — témoin : son cadre", contient(tj, "LE TÉMOIN"));
  verifie("journalier — témoin : le mot propre au journalier", contient(tj, "consentement du Locataire"));
  verifie("journalier — témoin : emplacement réservé", j.emplacements.temoin !== undefined);

  // SANS témoin : ni cadre vide, ni texte orphelin. C'est le contrôle qui
  // protège les contrats produits avant l'introduction du témoin.
  const jSansTemoin = await composerContratJournaliere({ ...JOURNALIERE, temoinNom: null });
  const tjSans = texteDuPdf(jSansTemoin.octets);
  verifie("sans témoin — aucun cadre « LE TÉMOIN »", !contient(tjSans, "LE TÉMOIN"));
  verifie("sans témoin — aucun texte de reconnaissance", !contient(tjSans, "avoir pris connaissance du présent contrat"));
  verifie("sans témoin — aucun emplacement réservé", jSansTemoin.emplacements.temoin === undefined);

  verifie("titre de l'acte", contient(tj, "CONTRAT DE LOCATION JOURNALIÈRE DE MOTO"));
  verifie("NINEA de l'entreprise", contient(tj, "008246888"));
  verifie(
    "ADRESSE DE LA BOUTIQUE, et non le siège",
    contient(tj, "Route de Fatick, quartier Téfess, Mbour"),
  );
  verifie("identité du locataire", contient(tj, "FALL Aminata"));
  verifie("numéro d'immatriculation", contient(tj, "R 4412"));
  verifie("DATE ET HEURE de départ", contient(tj, "12/09/2026 à 08h30"));
  verifie("DATE ET HEURE de retour", contient(tj, "15/09/2026 à 18h00"));
  verifie("durée de location", contient(tj, "3 jours"));
  verifie("tarif de location", contient(tj, "27 000 FCFA"));
  verifie("CAUTION", contient(tj, "50 000 FCFA"));
  verifie(
    "la caution ne couvre que partiellement",
    contient(tj, "La caution sert de garantie partielle"),
  );
  verifie("limite de kilométrage", contient(tj, "300 km"));
  verifie("forfait de dépassement", contient(tj, "1 000 FCFA par km"));
  verifie("ZONE d'utilisation", contient(tj, "Région de Thiès"));
  verifie("sortie de zone interdite", contient(tj, "sans autorisation écrite du Loueur est interdite"));
  verifie("interdiction de sous-louer", contient(tj, "prêter ou sous-louer"));
  verifie("amendes à la charge du locataire", contient(tj, "à la charge exclusive du Locataire"));
  verifie("clause GPS", contient(tj, "géolocalisation GPS"));
  verifie("vol ou non restitution", contient(tj, "remboursement de la valeur totale du véhicule"));
  verifie("état général constaté", contient(tj, "rayure légère sur le garde-boue arrière"));
  verifie("droit sénégalais", contient(tj, "République du Sénégal"));
  verifie("17 articles", contient(tj, "Article 17 - Droit applicable"));
  verifie(
    "deux emplacements de signature sur la dernière page",
    j.emplacements.client.page === j.pages - 1 && j.emplacements.gerant.page === j.pages - 1,
  );

  const jSansSaisie = await composerContratJournaliere({
    ...JOURNALIERE,
    montantCaution: "Néant",
    limiteKm: "Néant",
    zoneUtilisation: "Néant",
  });
  verifie(
    "champs non saisis : « Néant », jamais un blanc trompeur",
    contient(texteDuPdf(jSansSaisie.octets), "Montant de la caution (FCFA) : Néant"),
  );

  const jModes = await composerContratJournaliere({ ...JOURNALIERE, modesPaiement: ["WAVE"] });
  verifie("mode de paiement coché", casesCochees(jModes.octets).join("|") === "Wave");

  // ── Constat d'état — remise ──────────────────────────────────────────────
  //
  // Les deux cadres de signature étaient anonymes : rien ne reliait un tracé à
  // une personne. Ces contrôles garantissent que les signataires restent nommés
  // et que le contrôle de la pièce figure bien sur le document.
  console.log("\n=== Constat d'état — remise ===");
  const constat = await composerConstatRemise(CONSTAT);
  const tc = texteDuPdf(constat.octets);

  verifie("titre du constat", contient(tc, "CONSTAT D'ÉTAT DE LA MOTO"));
  verifie("numéro de série du véhicule", contient(tc, "HB3BH2104T9103507"));
  verifie(
    "SIGNATAIRE du Bailleur nommé sous son cadre",
    contient(tc, "Pour le Bailleur - MENDY Lazare Evariste"),
  );
  verifie(
    "SIGNATAIRE Locataire nommé sous son cadre",
    contient(tc, "Le Locataire - SARR Abdoulaye"),
  );
  verifie("date et heure de signature", contient(tc, "signé sur place le 17/08/2026 à 14h30"));
  verifie(
    "CONTRÔLE DE LA PIÈCE reporté sur le document",
    contient(tc, "Identité du Locataire vérifiée par MENDY Lazare Evariste"),
  );
  verifie("numéro de pièce dans la mention", contient(tc, "1 07 20011011 000060"));
  verifie("horodatage du contrôle", contient(tc, "17/08/2026 14:22:07"));

  verifie(
    "PROVENANCE des signatures indiquée",
    contient(tc, "Signatures reprises du contrat LME-2026-THS-0003"),
  );

  const casesConstat = casesCochees(constat.octets);
  verifie(
    `états du véhicule cochés (${casesConstat.join(", ")})`,
    casesConstat.includes("Neuf") &&
      casesConstat.includes("D'occasion") &&
      casesConstat.includes("Complets"),
  );
  verifie(
    "les deux cadres de signature sont côte à côte, sur la même page",
    constat.emplacements.bailleur.page === constat.emplacements.locataire.page &&
      constat.emplacements.bailleur.y === constat.emplacements.locataire.y,
  );

  // Sans contrôle enregistré, la mention ne doit RIEN affirmer.
  const constatSansControle = await composerConstatRemise({
    ...CONSTAT,
    pieceVerifieePar: null,
    pieceVerifieeLe: null,
  });
  verifie(
    "aucun contrôle enregistré : la mention n'invente pas de vérification",
    !contient(texteDuPdf(constatSansControle.octets), "Identité du Locataire vérifiée"),
  );

  // ── Attestation de versement ─────────────────────────────────────────────
  console.log("\n=== Attestation de versement ===");
  const att = await composerAttestation(ATTESTATION);
  const ta = texteDuPdf(att.octets);

  verifie("titre du document", contient(ta, "ATTESTATION DE VERSEMENT"));
  verifie("NINEA de l'entreprise", contient(ta, "008246888"));
  verifie("formule « Je soussigné(e) »", contient(ta, "Je soussigné(e)"));
  verifie("représentant qui atteste", contient(ta, "NASSALAN Frédéric Olivier, représentant(e)"));
  verifie("identité du client", contient(ta, "DIOP Omar"));
  verifie("numéro de pièce", contient(ta, "1596200100848"));
  verifie(
    "CADRE du versement nommé comme l'acte",
    contient(ta, "du contrat de vente de moto électrique avec paiement échelonné"),
  );
  verifie("montant versé", contient(ta, "516 000 FCFA"));
  verifie("MONTANT RESTANT DÛ", contient(ta, "Montant restant dû après ce versement : 344 000 FCFA"));
  verifie(
    "formule de délivrance",
    contient(ta, "pour servir et valoir ce que de droit"),
  );
  verifie("case « Autre » imprimée", contient(ta, "Autre"));
  verifie(
    "PROVENANCE des signatures indiquée",
    contient(ta, "Signatures reprises du contrat LME-2026-MBR-0004"),
  );

  const cochesAtt = casesCochees(att.octets);
  verifie(
    `mode et échéance cochés, rien d'autre (${cochesAtt.join(", ")})`,
    cochesAtt.join("|") === "Espèces|1er (60 %)",
  );

  // Deuxième versement : la croix du premier RESTE, celle du deuxième s'ajoute.
  const att2 = await composerAttestation({
    ...ATTESTATION,
    montantVerse: "86 000 FCFA",
    montantRestantDu: "258 000 FCFA",
    mode: "WAVE",
    echeances: ATTESTATION.echeances.map((e, i) => ({ ...e, cochee: i <= 1 })),
  });
  verifie(
    "CASES CUMULATIVES : 1er et 2e cochés au deuxième versement",
    casesCochees(att2.octets).join("|") === "Wave|1er (60 %)|2e (10 %)",
  );

  // Sans échéancier — location-accession — la ligne n'est pas imprimée plutôt
  // que de montrer cinq cases vides.
  const attAccession = await composerAttestation({
    ...ATTESTATION,
    formule: "LOCATION_ACCESSION",
    echeances: [],
  });
  const taAccession = texteDuPdf(attAccession.octets);
  verifie(
    "accession : cadre du versement adapté",
    contient(taAccession, "du contrat de location-accession de moto électrique"),
  );
  verifie(
    "accession : aucune ligne « Versement concerné »",
    !contient(taAccession, "Versement concerné"),
  );

  // ── Constat de restitution ───────────────────────────────────────────────
  console.log("\n=== Constat d'état — restitution ===");
  const restitution = await composerConstatRestitution(RESTITUTION);
  const tr = texteDuPdf(restitution.octets);
  const cr = casesCochees(restitution.octets);

  verifie("titre du constat", contient(tr, "CONSTAT D'ÉTAT DE LA MOTO ÉLECTRIQUE"));
  verifie("BLOC DE RESTITUTION, et non de remise", contient(tr, "ÉTAT FINAL - RESTITUTION DU VÉHICULE"));
  verifie("numéro de série du véhicule", contient(tr, "HB3BH2108S9110183"));
  verifie("SIGNATAIRE du Bailleur nommé", contient(tr, "Pour le Bailleur - MENDY Lazare Evariste"));
  verifie("SIGNATAIRE Locataire nommé", contient(tr, "Le Locataire - SARR Abdoulaye"));
  verifie("date et heure de restitution", contient(tr, "27/09/2026") && contient(tr, "16h10"));
  verifie("kilométrage à la remise rappelé", contient(tr, "Kilométrage à la remise"));
  verifie("DISTANCE PARCOURUE calculée", contient(tr, "Distance parcourue : 4288 km"));
  verifie("contrat visé sous les signatures", contient(tr, "Établi en exécution du contrat LME-2026-THS-0003"));
  verifie("signatures données sur place, par les deux parties", contient(tr, "signé sur place") && contient(tr, "par les deux parties"));
  verifie(
    "la phrase qui reconnaît l'état est CONTRADICTOIRE",
    contient(tr, "contradictoirement constaté et photographié en présence des deux parties"),
  );

  // Les états proposés au retour ne sont PAS ceux de la remise.
  verifie("états de retour imprimés, pas ceux de la remise", contient(tr, "Usure normale") && !contient(tr, "D'occasion"));
  verifie(
    `états et motif cochés, rien d'autre (${cr.join(", ")})`,
    cr.includes("Rupture anticipée") &&
      cr.includes("Usure normale") &&
      cr.includes("Dégradations (à préciser)") &&
      cr.includes("Oui (à préciser)") &&
      !cr.includes("Aucun") &&
      !cr.includes("Fin normale du contrat"),
  );

  // ── Les sommes : récapitulées, jamais créées ─────────────────────────────
  verifie("redevances échues et impayées", contient(tr, "Redevances échues et impayées : 45 000 FCFA"));
  verifie("DIFFÉRENTIEL avec le nombre de jours retenus", contient(tr, "Différentiel de rupture anticipée (312 jours facturés) : 156 000 FCFA"));
  verifie("frais de remise en état", contient(tr, "Frais de remise en état : 30 000 FCFA"));
  verifie("total dû", contient(tr, "Total dû : 231 000 FCFA"));
  verifie(
    "AUCUNE OBLIGATION NOUVELLE : le constat renvoie aux articles du contrat",
    contient(tr, "sans y ajouter aucune obligation nouvelle"),
  );

  // Rien à réclamer : aucun bloc de sommes plutôt que des « 0 FCFA » trompeurs.
  const rienADevoir = await composerConstatRestitution({
    ...RESTITUTION,
    motif: "FIN_NORMALE",
    dommagesConstates: false,
    dommagesPrecision: null,
    redevancesImpayees: null,
    differentielRupture: null,
    differentielJours: null,
    coutReparations: null,
    totalDu: null,
  });
  const trRien = texteDuPdf(rienADevoir.octets);
  verifie("dossier sans dette : aucun bloc « Sommes dues »", !contient(trRien, "Sommes dues à la restitution"));
  verifie("dossier sans dette : aucun « 0 FCFA » trompeur", !contient(trRien, "0 FCFA"));
  verifie("dossier sans dette : « Aucun » dommage coché", casesCochees(rienADevoir.octets).includes("Aucun"));

  verifie(
    "les deux cadres de signature sont côte à côte, sur la même page",
    restitution.emplacements.bailleur.page === restitution.emplacements.locataire.page &&
      restitution.emplacements.bailleur.x < restitution.emplacements.locataire.x,
  );

  console.log(
    `\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "ÉCHECS DÉTECTÉS"} — ${ok} OK, ${ko} KO\n`,
  );
  process.exit(ko === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
