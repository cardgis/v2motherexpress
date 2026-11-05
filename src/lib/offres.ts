/**
 * Catalogue des offres commerciales — source de vérité unique des tarifs.
 *
 * ── Pourquoi ce fichier et pas la table `Tarification` ─────────────────────
 * Les colonnes `rachat*` de `Tarification` (V1) portent 5 000 F/j × 730 jours
 * = 3 650 000 FCFA pour TOUS les modèles. C'est un calcul à 7 j/7 (2 ans ×
 * 365), en contradiction avec la règle des 6 jours sur 7. Arbitrage retenu :
 * la grille de la spécification fait foi. Le contrôle de cohérence est
 * exécutable — `npm run verif:tarif`.
 *
 * ── Statut des redevances ──────────────────────────────────────────────────
 * A10 et B12 proviennent de la grille officielle, et sont confirmées mot pour
 * mot par les contrats signés fournis par le client (article 4, et article 5
 * pour le différentiel de la formule avec engagement).
 *
 * A12, C32 et E52 ne figuraient dans aucun document. Leurs redevances ont été
 * interpolées sur les deux points connus (410 000 F → 3 000 F/j,
 * 860 000 F → 5 000 F/j), arrondies à 500 F, puis VALIDÉES par le client le
 * 2026-09-10. Elles ne sont donc plus provisoires.
 *
 * Le drapeau `provisoire` reste dans le type : il resservira au prochain
 * modèle ajouté au catalogue sans tarif d'accession arrêté.
 */

import type { Formule } from "@/generated/prisma";
import { calculerAccession, type CalculAccession } from "@/lib/tarification";

export interface OffreAccessionModele {
  /** Identifiant lisible, utilisé dans les formulaires et sur le contrat. */
  cle: string;
  libelle: string;
  redevanceJournaliere: number;
  dureeMois: number;
  /** Durée ferme : le tarif remisé est la contrepartie de l'engagement. */
  avecEngagement: boolean;
  /** Différentiel dû par jour loué en cas de rupture anticipée du client. */
  differentielSiRupture: number;
  /** Tarif non confirmé commercialement — à valider avant mise en production. */
  provisoire?: boolean;
}

/**
 * Offres d'accession par modèle REVOO, indexées sur `Produit.modele`.
 * Un modèle peut proposer plusieurs formules (l'A10 en a deux).
 */
export const OFFRES_ACCESSION: Record<string, OffreAccessionModele[]> = {
  A10: [
    {
      cle: "A10_SANS_ENGAGEMENT",
      libelle: "Sans engagement — 14 mois",
      redevanceJournaliere: 3000,
      dureeMois: 14,
      avecEngagement: false,
      differentielSiRupture: 0,
    },
    {
      cle: "A10_AVEC_ENGAGEMENT",
      libelle: "Avec engagement — 12 mois fermes",
      redevanceJournaliere: 2500,
      dureeMois: 12,
      avecEngagement: true,
      // 3 000 − 2 500 : la remise est liée à l'engagement de 12 mois.
      differentielSiRupture: 500,
    },
  ],
  B12: [
    {
      cle: "B12_24M",
      libelle: "Location-accession — 24 mois",
      redevanceJournaliere: 5000,
      dureeMois: 24,
      avecEngagement: false,
      differentielSiRupture: 0,
    },
  ],
  A12: [
    {
      cle: "A12_24M",
      libelle: "Location-accession — 24 mois",
      redevanceJournaliere: 3500,
      dureeMois: 24,
      avecEngagement: false,
      differentielSiRupture: 0,
    },
  ],
  C32: [
    {
      cle: "C32_24M",
      libelle: "Location-accession — 24 mois",
      redevanceJournaliere: 4000,
      dureeMois: 24,
      avecEngagement: false,
      differentielSiRupture: 0,
    },
  ],
  E52: [
    {
      cle: "E52_24M",
      libelle: "Location-accession — 24 mois",
      redevanceJournaliere: 5500,
      dureeMois: 24,
      avecEngagement: false,
      differentielSiRupture: 0,
    },
  ],
};

/** Offres d'accession d'un modèle, chiffrées (jours facturés et total). */
export function offresAccessionPour(
  modele: string,
): Array<OffreAccessionModele & CalculAccession> {
  return (OFFRES_ACCESSION[modele] ?? []).map((o) => ({ ...o, ...calculerAccession(o) }));
}

/** Retrouve une offre par sa clé, tous modèles confondus. */
export function offreAccessionParCle(cle: string): OffreAccessionModele | null {
  for (const offres of Object.values(OFFRES_ACCESSION)) {
    const trouvee = offres.find((o) => o.cle === cle);
    if (trouvee) return trouvee;
  }
  return null;
}

/** Formules ouvertes à un modèle, d'après le catalogue et les offres définies. */
export function formulesDisponiblesPour(produit: {
  modele: string;
  aLaVente: boolean;
  aLaLocation: boolean;
}): Formule[] {
  const formules: Formule[] = [];
  if (produit.aLaLocation) formules.push("LOCATION_JOURNALIERE");
  if ((OFFRES_ACCESSION[produit.modele]?.length ?? 0) > 0) formules.push("LOCATION_ACCESSION");
  if (produit.aLaVente) formules.push("VENTE_ECHELONNEE");
  return formules;
}

export const LIBELLES_FORMULE: Record<Formule, string> = {
  LOCATION_JOURNALIERE: "Location journalière",
  LOCATION_ACCESSION: "Location-accession",
  VENTE_ECHELONNEE: "Vente échelonnée",
};
