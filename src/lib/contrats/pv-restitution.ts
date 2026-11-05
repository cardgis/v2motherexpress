/**
 * Constat d'état de la moto électrique — restitution du véhicule.
 *
 * Pendant du constat de remise (`pv-remise.ts`), pour la fin d'un contrat :
 * retour d'une location journalière, ou rupture anticipée d'une
 * location-accession. Une accession menée à son terme ne produit PAS ce
 * document : elle transfère la propriété, la moto ne revient pas.
 *
 * ── Deux différences de fond avec la remise ────────────────────────────────
 * 1. Les états proposés ne sont pas les mêmes. À la remise, la question est
 *    « neuf ou d'occasion ? » ; au retour, elle est « usure normale ou
 *    dégradation ? ». Ce sont les libellés du modèle papier.
 * 2. Les signatures sont recueillies SUR PLACE, et non reprises du contrat.
 *    À la remise, le client reconnaît un véhicule en bon état — l'enjeu est
 *    faible. Au retour, on lui oppose des dégâts et des sommes : son accord
 *    doit être donné devant la moto, pas emprunté à un acte signé des mois
 *    plus tôt.
 *
 * ── Les sommes portées sur le document ────────────────────────────────────
 * Ce constat n'invente aucun barème. Les réparations sont dues « dans les
 * conditions prévues au contrat », et le document renvoie à ses articles.
 * Une seule somme se calcule ici, parce que l'acte en donne lui-même la
 * formule : le différentiel de rupture de la formule avec engagement, soit
 * 500 F par jour facturé depuis le début du contrat jusqu'à la restitution
 * effective (article 5 du contrat d'accession).
 *
 * ⚠ Toute modification du texte ci-dessous change un document juridiquement
 * engageant. Elle doit être validée par La Mother Express avant d'être livrée.
 */

import { ActePdf, type EmplacementSignature } from "./mise-en-page";
import { BAILLEUR } from "./snapshot";
import type {
  EtatAccessoires,
  EtatRestitution,
  Formule,
  MotifRestitution,
} from "@/generated/prisma";

/**
 * Version du texte du constat de restitution, enregistrée sur l'événement de
 * clôture.
 *
 * Même règle que `VERSION_CONSTAT` et `VERSION_MODELES` : À INCRÉMENTER à
 * chaque modification du texte, après validation par La Mother Express.
 *
 * v1 — 2026-09-27 : rédaction d'origine, reprise du bloc « restitution » du
 * modèle papier, avec le récapitulatif des sommes dues.
 */
export const VERSION_CONSTAT_RESTITUTION = 1;

export interface DonneesConstatRestitution {
  reference: string;
  formule: Formule;
  dureeMois: number | null;

  vehiculeMarqueModele: string;
  vehiculeNumeroSerie: string;

  clientNomComplet: string;
  clientNumeroPiece: string;
  clientTelephone: string;

  /** Le gérant qui reçoit le véhicule et signe pour le Bailleur. */
  bailleurSignataire: string;
  /** Contrat en exécution duquel le constat est établi, et sa date. */
  contratReference: string | null;
  contratSigneLe: string | null;

  motif: MotifRestitution;
  motifPrecision: string | null;

  dateRestitution: string;
  heureRestitution: string;
  compteurKm: number | null;
  /** Kilométrage relevé à la remise, pour lire la distance parcourue. */
  compteurKmRemise: number | null;

  carrosserie: EtatRestitution | null;
  freinsPneus: EtatRestitution | null;
  batterieChargeur: EtatRestitution | null;
  accessoires: EtatAccessoires | null;
  accessoiresPrecision: string | null;

  dommagesConstates: boolean;
  dommagesPrecision: string | null;

  /**
   * Sommes portées au récapitulatif. Toutes exprimées en FCFA formatés, déjà
   * arrêtées par l'appelant : le document imprime, il ne calcule pas.
   */
  redevancesImpayees: string | null;
  coutReparations: string | null;
  /** Différentiel de l'article 5, formule avec engagement uniquement. */
  differentielRupture: string | null;
  differentielJours: number | null;
  totalDu: string | null;

  observations: string | null;

  photos: { octets: Uint8Array; mimeType: string; legende?: string }[];
}

export interface ConstatRestitutionCompose {
  octets: Uint8Array;
  emplacements: { bailleur: EmplacementSignature; locataire: EmplacementSignature };
  pages: number;
}

/** Libellés des types de contrat, tels qu'ils figurent en tête du constat. */
function libellesTypeContrat(formule: Formule, dureeMois: number | null) {
  const accession =
    formule === "LOCATION_ACCESSION"
      ? `Location-accession ${dureeMois ?? 24} mois`
      : "Location-accession";

  return [
    { libelle: "Location journalière", cochee: formule === "LOCATION_JOURNALIERE" },
    { libelle: accession, cochee: formule === "LOCATION_ACCESSION" },
  ];
}

/**
 * États proposés au retour — libellés du modèle papier, qui diffèrent de ceux
 * de la remise : on ne demande pas si la moto est neuve, mais si l'usure est
 * normale.
 */
const CHOIX_ETAT = ["BON_ETAT", "USURE_NORMALE", "DEGRADATIONS"] as const;
const LIBELLES_ETAT: Record<(typeof CHOIX_ETAT)[number], string> = {
  BON_ETAT: "Bon état",
  USURE_NORMALE: "Usure normale",
  DEGRADATIONS: "Dégradations (à préciser)",
};

function casesEtat(valeur: EtatRestitution | null) {
  return CHOIX_ETAT.map((c) => ({ libelle: LIBELLES_ETAT[c], cochee: valeur === c }));
}

const LIBELLES_MOTIF: Record<MotifRestitution, string> = {
  FIN_NORMALE: "Fin normale du contrat",
  RUPTURE_ANTICIPEE: "Rupture anticipée",
  DEFAUT_DE_PAIEMENT: "Résiliation pour défaut de paiement",
  AUTRE: "Autre (à préciser)",
};

const MOTIFS: MotifRestitution[] = [
  "FIN_NORMALE",
  "RUPTURE_ANTICIPEE",
  "DEFAUT_DE_PAIEMENT",
  "AUTRE",
];

/**
 * Ligne de traçabilité imprimée sous les deux cadres de signature.
 *
 * Elle dit que le constat a été signé sur place, et en exécution de quel
 * contrat — c'est ce qui rattache la restitution à l'engagement d'origine.
 */
function mentionDeSignature(d: DonneesConstatRestitution): string {
  const signe = `Constat signé sur place le ${d.dateRestitution} à ${d.heureRestitution}, par les deux parties.`;

  if (!d.contratReference) return signe;

  const signeLe = d.contratSigneLe ? `, signé le ${d.contratSigneLe}` : "";
  return `${signe} Établi en exécution du contrat ${d.contratReference}${signeLe}.`;
}

export async function composerConstatRestitution(
  d: DonneesConstatRestitution,
): Promise<ConstatRestitutionCompose> {
  const doc = await ActePdf.creer();

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.titre("CONSTAT D'ÉTAT DE LA MOTO ÉLECTRIQUE");
  doc.texte(`${BAILLEUR.raisonSociale} - NINEA ${BAILLEUR.ninea}`, {
    taille: 9.5,
    centre: true,
    apres: 14,
  });

  doc.cases("Type de contrat", libellesTypeContrat(d.formule, d.dureeMois));
  doc.champ("Véhicule (Marque / Modèle)", d.vehiculeMarqueModele);
  doc.champ("N° de série", d.vehiculeNumeroSerie);
  doc.champ("Nom et prénom du Locataire", d.clientNomComplet);
  doc.champ("N° de pièce d'identité", d.clientNumeroPiece);
  doc.champ("Téléphone", d.clientTelephone);

  doc.separateur({ avant: 14, apres: 12 });

  // ── Bloc de restitution ──────────────────────────────────────────────────
  doc.texte("- ÉTAT FINAL - RESTITUTION DU VÉHICULE -", {
    gras: true,
    centre: true,
    taille: 12,
    apres: 12,
  });

  doc.cases(
    "Motif de la restitution",
    MOTIFS.map((m) => ({ libelle: LIBELLES_MOTIF[m], cochee: d.motif === m })),
  );

  if (d.motifPrecision) {
    doc.texte(d.motifPrecision, { taille: 10, retrait: 12, avant: 2 });
  }

  doc.champ(
    "Date de restitution",
    `${d.dateRestitution}          Heure : ${d.heureRestitution}          Kilométrage : ${
      d.compteurKm !== null ? `${d.compteurKm} km` : "- km"
    }`,
    { avant: 8, apres: d.compteurKmRemise !== null && d.compteurKm !== null ? 2 : 12 },
  );

  // La distance parcourue n'a de sens que si les deux relevés existent.
  if (d.compteurKmRemise !== null && d.compteurKm !== null) {
    doc.champ(
      "Kilométrage à la remise",
      `${d.compteurKmRemise} km          Distance parcourue : ${Math.max(0, d.compteurKm - d.compteurKmRemise)} km`,
      { apres: 12 },
    );
  }

  // Les photos sont la pièce maîtresse du constat : elles précèdent les cases.
  await doc.grilleImages(d.photos, 2);

  doc.espace(6);
  doc.cases("Carrosserie", casesEtat(d.carrosserie));
  doc.cases("Freins / Pneus", casesEtat(d.freinsPneus));
  doc.cases("Batterie / Chargeur", casesEtat(d.batterieChargeur));
  doc.cases("Accessoires (casque, clés, documents)", [
    { libelle: "Complets", cochee: d.accessoires === "COMPLETS" },
    { libelle: "Manquants (à préciser)", cochee: d.accessoires === "MANQUANTS" },
  ]);

  if (d.accessoiresPrecision) {
    doc.texte(d.accessoiresPrecision, { taille: 10, retrait: 12, avant: 2 });
  }

  // ── Dommages ─────────────────────────────────────────────────────────────
  doc.cases("Dommages constatés", [
    { libelle: "Aucun", cochee: !d.dommagesConstates },
    { libelle: "Oui (à préciser)", cochee: d.dommagesConstates },
  ]);

  if (d.dommagesPrecision) {
    doc.texte(d.dommagesPrecision, { taille: 10, retrait: 12, avant: 2 });
  }

  doc.texte("Remarques :", { italique: true, avant: 10, apres: 2 });
  doc.texte(d.observations?.trim() || "Néant", { taille: 10, retrait: 12 });

  // ── Sommes dues ──────────────────────────────────────────────────────────
  //
  // Rien n'est chiffré d'office : chaque ligne n'apparaît que si elle a une
  // valeur. Un constat qui afficherait « 0 FCFA » partout laisserait croire
  // qu'on a arrêté un compte, alors qu'on n'en a relevé aucun.
  const lignes = [
    d.redevancesImpayees
      ? { libelle: "Redevances échues et impayées", montant: d.redevancesImpayees }
      : null,
    d.differentielRupture
      ? {
          libelle: `Différentiel de rupture anticipée${
            d.differentielJours !== null ? ` (${d.differentielJours} jours facturés)` : ""
          }`,
          montant: d.differentielRupture,
        }
      : null,
    d.coutReparations ? { libelle: "Frais de remise en état", montant: d.coutReparations } : null,
  ].filter((l): l is { libelle: string; montant: string } => l !== null);

  if (lignes.length > 0) {
    doc.section("Sommes dues à la restitution", { avant: 14 });

    for (const ligne of lignes) {
      doc.champ(ligne.libelle, ligne.montant);
    }

    if (d.totalDu && lignes.length > 1) {
      doc.texte(`Total dû : ${d.totalDu}`, { gras: true, avant: 6 });
    }

    doc.texte(
      "Ces sommes sont dues dans les conditions prévues au contrat visé ci-dessous, dont les " +
        "stipulations relatives à l'entretien, aux dégradations et à la garantie demeurent seules " +
        "applicables. Le présent constat les récapitule sans y ajouter aucune obligation nouvelle.",
      { taille: 9.5, avant: 6 },
    );
  }

  doc.espace(12);
  doc.texte(
    "Le Locataire et le Bailleur reconnaissent que le véhicule a été restitué dans l'état décrit " +
      "ci-dessus, contradictoirement constaté et photographié en présence des deux parties.",
    { taille: 10.5, apres: 14 },
  );

  const emplacements = doc.blocsSignatureCoteACote(
    `Pour le Bailleur - ${d.bailleurSignataire}`,
    `Le Locataire - ${d.clientNomComplet}`,
  );

  doc.texte(mentionDeSignature(d), { taille: 8, gris: true, avant: 8 });

  return {
    octets: await doc.octets({
      titre: "Constat d'état - restitution",
      reference: d.reference,
    }),
    emplacements: { bailleur: emplacements.gauche, locataire: emplacements.droite },
    pages: doc.nombreDePages,
  };
}
