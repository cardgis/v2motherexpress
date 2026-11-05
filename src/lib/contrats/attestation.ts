/**
 * Attestation de versement — reçu remis au client après chaque paiement.
 *
 * Texte reproduit à l'identique du modèle fourni par le client
 * (`Attestation_Versement_Diop_Omar.pdf`).
 *
 * ── Deux écarts assumés avec le papier ─────────────────────────────────────
 * 1. Le modèle porte « M. DIOP Omar ». Nous ne stockons aucune civilité, et la
 *    déduire d'un prénom se tromperait tôt ou tard : le nom est écrit seul.
 *    Les formes « soussigné(e) » et « représentant(e) » du document d'origine,
 *    elles, sont conservées telles quelles.
 * 2. Les cases « Versement concerné » sont CUMULATIVES : l'attestation du
 *    deuxième versement coche le premier ET le deuxième. Le client voit ainsi
 *    où il en est de son échéancier, ce qu'une case isolée ne disait pas.
 *
 * ⚠ Toute modification du texte ci-dessous change un document remis au client.
 * Elle doit être validée avant d'être livrée, et faire monter VERSION_ATTESTATION.
 */

import { ActePdf, type EmplacementSignature } from "./mise-en-page";
import type { Formule, ModePaiement } from "@/generated/prisma";

/**
 * Version du texte de l'attestation, journalisée avec chaque reçu produit.
 *
 * v1 — 2026-09-27 : texte d'origine, noms sans civilité, cases cumulatives.
 */
export const VERSION_ATTESTATION = 1;

/** Le modèle porte cinq cases ; nos modes n'en couvrent que quatre. */
const MODES_IMPRIMES: { libelle: string; mode: ModePaiement | null }[] = [
  { libelle: "Espèces", mode: "ESPECES" },
  { libelle: "Wave", mode: "WAVE" },
  { libelle: "Orange Money", mode: "ORANGE_MONEY" },
  { libelle: "Virement", mode: "VIREMENT" },
  // Jamais cochée : la liste des modes est fermée côté application.
  { libelle: "Autre", mode: null },
];

/** L'acte au titre duquel le versement est reçu, nommé comme sur le contrat. */
const CADRE_DU_VERSEMENT: Record<Formule, string> = {
  VENTE_ECHELONNEE: "du contrat de vente de moto électrique avec paiement échelonné",
  LOCATION_ACCESSION: "du contrat de location-accession de moto électrique",
  LOCATION_JOURNALIERE: "du contrat de location journalière de moto électrique",
};

export interface DonneesAttestation {
  reference: string;
  formule: Formule;

  bailleurRaisonSociale: string;
  bailleurNinea: string;
  bailleurSiege: string;
  bailleurRepresentant: string;

  clientNomComplet: string;
  clientNumeroPiece: string;

  montantVerse: string;
  datePaiement: string;
  mode: ModePaiement;
  montantRestantDu: string;

  /**
   * Une entrée par échéance de l'acte, dans l'ordre, avec son libellé abrégé
   * (« 1er (60 %) ») et son état. Vide pour une formule sans échéancier : la
   * ligne n'est alors pas imprimée plutôt que de montrer des cases vierges.
   */
  echeances: { libelle: string; cochee: boolean }[];

  /** Provenance des tracés : un reçu ne les fait jamais passer pour récents. */
  signaturesReprisesDu: string | null;

  lieuSignature: string;
  dateSignature: string;
}

export interface AttestationComposee {
  octets: Uint8Array;
  emplacements: { client: EmplacementSignature; gerant: EmplacementSignature };
  pages: number;
}

export async function composerAttestation(d: DonneesAttestation): Promise<AttestationComposee> {
  const doc = await ActePdf.creer();

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.titre("ATTESTATION DE VERSEMENT");
  doc.texte(`${d.bailleurRaisonSociale} · NINEA : ${d.bailleurNinea}`, {
    taille: 9.5,
    centre: true,
  });
  doc.texte(`Adresse : ${d.bailleurSiege}`, { taille: 9.5, centre: true });

  doc.separateur({ avant: 16, apres: 14 });

  // ── Corps ────────────────────────────────────────────────────────────────
  doc.texte("Je soussigné(e),");
  doc.texte(
    `${d.bailleurRepresentant}, représentant(e) de ${d.bailleurRaisonSociale}, atteste par la ` +
      "présente avoir reçu de :",
    { avant: 6 },
  );
  doc.champ("Nom et prénom", d.clientNomComplet, { avant: 6 });
  doc.champ("Numéro de pièce d'identité", d.clientNumeroPiece);
  doc.texte(
    `dans le cadre ${CADRE_DU_VERSEMENT[d.formule]}, la somme suivante :`,
    { avant: 6 },
  );

  doc.separateur({ avant: 14, apres: 12 });

  doc.champ("Montant versé", d.montantVerse);
  doc.champ("Date du paiement", d.datePaiement);
  doc.cases(
    "Mode de paiement",
    MODES_IMPRIMES.map((m) => ({ libelle: m.libelle, cochee: m.mode === d.mode })),
  );

  if (d.echeances.length > 0) {
    doc.cases("Versement concerné", d.echeances);
  }

  doc.champ("Montant restant dû après ce versement", d.montantRestantDu);

  doc.separateur({ avant: 14, apres: 12 });

  doc.texte(
    "La présente attestation est délivrée à l'Acheteur pour servir et valoir ce que de droit.",
    { italique: true },
  );

  // ── Signatures ───────────────────────────────────────────────────────────
  doc.champ("Fait à", `${d.lieuSignature}          Le : ${d.dateSignature}`, {
    avant: 14,
    apres: 12,
  });

  const gerant = doc.blocSignature(
    `LE VENDEUR - ${d.bailleurRaisonSociale}`,
    `Représenté(e) par : ${d.bailleurRepresentant}`,
  );

  doc.espace(10);
  const client = doc.blocSignature("L'ACHETEUR", `Nom : ${d.clientNomComplet}`);

  // Les tracés viennent du contrat : le dire, sinon le reçu laisserait croire
  // que les deux parties ont signé ce document-ci, devant lui.
  if (d.signaturesReprisesDu) {
    doc.texte(d.signaturesReprisesDu, { taille: 8, gris: true, avant: 8 });
  }

  return {
    octets: await doc.octets({ titre: "Attestation de versement", reference: d.reference }),
    emplacements: { client, gerant },
    pages: doc.nombreDePages,
  };
}
