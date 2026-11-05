/**
 * Constat d'état de la moto électrique — remise du véhicule.
 *
 * Texte reproduit à l'identique du modèle fourni par le client
 * (`Etat_des_lieux_DEBUT_moto_LA_MOTHER_EXPRESS.pdf`).
 *
 * ── Pourquoi ce document compte plus que le contrat ────────────────────────
 * En cas de litige sur l'état du véhicule, c'est lui qui fait foi : le contrat
 * dit ce que les parties se doivent, le constat dit dans quel état la moto est
 * partie. Les photos en sont la pièce maîtresse.
 *
 * ⚠ Toute modification du texte ci-dessous change un document juridiquement
 * engageant. Elle doit être validée par le client avant d'être livrée.
 */

import { ActePdf, type EmplacementSignature } from "./mise-en-page";
import { BAILLEUR } from "./snapshot";
import type { EtatAccessoires, EtatElement, Formule } from "@/generated/prisma";

/**
 * Version du texte du constat, enregistrée sur l'événement de remise.
 *
 * Même règle que `VERSION_MODELES` pour les contrats : À INCRÉMENTER à chaque
 * modification du texte ci-dessous, après validation par La Mother Express.
 * C'est ce qui permet de savoir, des mois plus tard, quelle rédaction exacte
 * un client a signée — le PDF, lui, ne porte pas son numéro de version, pas
 * plus que les actes.
 *
 * v1 — 2026-09-19 : texte d'origine, plus les signataires nommés sous leur
 * cadre et la mention de contrôle de la pièce d'identité.
 */
export const VERSION_CONSTAT = 1;

export interface DonneesConstat {
  reference: string;
  formule: Formule;
  dureeMois: number | null;

  vehiculeMarqueModele: string;
  vehiculeNumeroSerie: string;

  clientNomComplet: string;
  clientNumeroPiece: string;
  clientTelephone: string;

  /**
   * Qui signe, et sur quoi repose l'identité de chacun.
   *
   * Le constat portait deux cadres anonymes — « Signature du Bailleur »,
   * « Signature du Locataire ». Rien n'y rattachait un tracé à une personne, et
   * deux signatures apposées dans le désordre sur le téléphone du gérant
   * seraient passées inaperçues. Les signataires sont donc nommés sous leur
   * cadre, et la vérification de l'original de la pièce — jusqu'ici consignée
   * en base seulement — est reportée sur le document lui-même.
   */
  bailleurSignataire: string;
  pieceVerifieePar: string | null;
  /** Horodatage du contrôle, « 17/08/2026 14:22:07 ». */
  pieceVerifieeLe: string | null;
  /**
   * Provenance des tracés, imprimée sous les cadres.
   *
   * Les signatures sont reprises du contrat plutôt que refaites en boutique.
   * Le document doit le dire : un tracé recopié ne se fait jamais passer pour
   * un tracé apposé devant le véhicule.
   */
  signaturesReprisesDu: string | null;

  dateRemise: string;
  heureRemise: string;
  compteurKm: number | null;

  carrosserie: EtatElement | null;
  freinsPneus: EtatElement | null;
  batterieChargeur: EtatElement | null;
  accessoires: EtatAccessoires | null;
  accessoiresPrecision: string | null;
  observations: string | null;

  photos: { octets: Uint8Array; mimeType: string; legende?: string }[];
}

export interface ConstatCompose {
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

const CHOIX_ETAT = ["NEUF", "OCCASION", "DEGRADATIONS"] as const;
const LIBELLES_ETAT: Record<(typeof CHOIX_ETAT)[number], string> = {
  NEUF: "Neuf",
  OCCASION: "D'occasion",
  DEGRADATIONS: "Dégradations (à préciser)",
};

function casesEtat(valeur: EtatElement | null) {
  return CHOIX_ETAT.map((c) => ({ libelle: LIBELLES_ETAT[c], cochee: valeur === c }));
}

/**
 * Ligne de traçabilité imprimée sous les deux cadres de signature.
 *
 * C'est l'équivalent, pour le constat, du bloc de traçabilité du contrat : elle
 * dit quand le document a été signé et sur quoi repose l'identité du Locataire.
 */
function mentionDeControle(d: DonneesConstat): string {
  const signe = `Constat signé sur place le ${d.dateRemise} à ${d.heureRemise}.`;

  // Aucun constat ne s'établit sans vérification préalable. Si l'horodatage
  // manquait malgré tout, la mention n'affirme rien plutôt que d'inventer un
  // contrôle qui n'aurait pas eu lieu.
  if (!d.pieceVerifieePar || !d.pieceVerifieeLe) return signe;

  return (
    `${signe} Identité du Locataire vérifiée par ${d.pieceVerifieePar} sur présentation de ` +
    `l'original de la pièce n° ${d.clientNumeroPiece}, le ${d.pieceVerifieeLe}.`
  );
}

export async function composerConstatRemise(d: DonneesConstat): Promise<ConstatCompose> {
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

  // ── Bloc de remise ───────────────────────────────────────────────────────
  doc.texte("- ÉTAT INITIAL - REMISE DU VÉHICULE -", {
    gras: true,
    centre: true,
    taille: 12,
    apres: 12,
  });

  doc.champ(
    "Date de remise",
    `${d.dateRemise}          Heure : ${d.heureRemise}          Kilométrage : ${
      d.compteurKm !== null ? `${d.compteurKm} km` : "- km"
    }`,
    { apres: 12 },
  );

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

  doc.texte("Remarques :", { italique: true, avant: 10, apres: 2 });
  doc.texte(d.observations?.trim() || "Néant", { taille: 10, retrait: 12 });

  doc.espace(12);
  doc.texte("Le Locataire reconnaît avoir reçu le véhicule dans l'état décrit ci-dessus.", {
    taille: 10.5,
    apres: 14,
  });

  const emplacements = doc.blocsSignatureCoteACote(
    `Pour le Bailleur - ${d.bailleurSignataire}`,
    `Le Locataire - ${d.clientNomComplet}`,
  );

  doc.texte(mentionDeControle(d), { taille: 8, gris: true, avant: 8 });

  if (d.signaturesReprisesDu) {
    doc.texte(d.signaturesReprisesDu, { taille: 8, gris: true, avant: 4 });
  }

  return {
    octets: await doc.octets({ titre: "Constat d'état - remise", reference: d.reference }),
    emplacements: { bailleur: emplacements.gauche, locataire: emplacements.droite },
    pages: doc.nombreDePages,
  };
}
