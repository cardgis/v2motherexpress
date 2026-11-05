/**
 * Filtres des chiffres de l'administration : période, type de ligne.
 *
 * Module sans accès à la base : partagé par les pages, les routes d'export et
 * les composants de filtre dans le navigateur.
 *
 * Les bornes sont calculées en UTC, qui est aussi l'heure de Dakar toute
 * l'année : un mois commence à minuit à Dakar.
 */

import { dateFr } from "@/lib/formatters";
import type { Formule } from "@/generated/prisma";

export type CodePeriode = "mois" | "mois-precedent" | "trimestre" | "annee" | "12-mois" | "tout";

export const PERIODES: { code: CodePeriode; libelle: string }[] = [
  { code: "mois", libelle: "Ce mois-ci" },
  { code: "mois-precedent", libelle: "Mois précédent" },
  { code: "trimestre", libelle: "Ce trimestre" },
  { code: "annee", libelle: "Cette année" },
  { code: "12-mois", libelle: "12 derniers mois" },
  { code: "tout", libelle: "Depuis le début" },
];

export const PERIODE_PAR_DEFAUT: CodePeriode = "mois";

export interface Periode {
  code: CodePeriode;
  libelle: string;
  /** Inclus. `null` : sans limite. */
  debut: Date | null;
  /** Exclu. `null` : sans limite. */
  fin: Date | null;
}

/** Une valeur inconnue (adresse bricolée) retombe sur la période par défaut. */
export function resoudrePeriode(saisie: unknown, maintenant = new Date()): Periode {
  const trouvee = PERIODES.find((p) => p.code === saisie) ?? PERIODES.find((p) => p.code === PERIODE_PAR_DEFAUT)!;
  const a = maintenant.getUTCFullYear();
  const m = maintenant.getUTCMonth();
  const premier = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 1));
  const trimestre = m - (m % 3);

  const bornes: Record<CodePeriode, [Date | null, Date | null]> = {
    mois: [premier(a, m), premier(a, m + 1)],
    "mois-precedent": [premier(a, m - 1), premier(a, m)],
    trimestre: [premier(a, trimestre), premier(a, trimestre + 3)],
    annee: [premier(a, 0), premier(a + 1, 0)],
    "12-mois": [premier(a, m - 11), premier(a, m + 1)],
    tout: [null, null],
  };

  const [debut, fin] = bornes[trouvee.code];
  return { code: trouvee.code, libelle: trouvee.libelle, debut, fin };
}

/** « du 1 septembre 2026 au 30 septembre 2026 », ou « depuis l'ouverture ». */
export function libelleIntervalle(periode: Periode): string {
  if (!periode.debut || !periode.fin) return "depuis l’ouverture";
  return `du ${dateFr(periode.debut)} au ${dateFr(new Date(periode.fin.getTime() - 1))}`;
}

// ---------------------------------------------------------------------------
// Feuille de suivi
// ---------------------------------------------------------------------------

export const TYPES_SUIVI = [
  { code: "tout", libelle: "Tout" },
  { code: "ventes", libelle: "Ventes" },
  { code: "longue", libelle: "Longue durée" },
  { code: "courte", libelle: "Courte durée" },
  { code: "en-cours", libelle: "En cours" },
] as const;

export type TypeSuivi = (typeof TYPES_SUIVI)[number]["code"];

export const FORMULE_DU_TYPE: Partial<Record<TypeSuivi, Formule>> = {
  ventes: "VENTE_ECHELONNEE",
  longue: "LOCATION_ACCESSION",
  courte: "LOCATION_JOURNALIERE",
};

export function lireTypeSuivi(saisie: unknown): TypeSuivi {
  return TYPES_SUIVI.find((t) => t.code === saisie)?.code ?? "tout";
}

/** Paramètres d'adresse des filtres, sans les valeurs par défaut. */
export function parametresFiltres(filtres: {
  periode?: CodePeriode;
  boutiqueId?: string | null;
  type?: TypeSuivi;
}): string {
  const params = new URLSearchParams();
  if (filtres.periode && filtres.periode !== PERIODE_PAR_DEFAUT) params.set("periode", filtres.periode);
  if (filtres.boutiqueId) params.set("boutique", filtres.boutiqueId);
  if (filtres.type && filtres.type !== "tout") params.set("type", filtres.type);
  const texte = params.toString();
  return texte ? `?${texte}` : "";
}

// ---------------------------------------------------------------------------
// Séries des graphiques
// ---------------------------------------------------------------------------

/** Couleurs choisies pour rester distinctes à l'impression en niveaux de gris. */
export const SERIES = [
  { cle: "ventes", libelle: "Ventes", couleur: "#c79a2a" },
  { cle: "longues", libelle: "Location longue durée", couleur: "#3f4653" },
  { cle: "courtes", libelle: "Location courte durée", couleur: "#5b7fa6" },
] as const;

export type CleSerie = (typeof SERIES)[number]["cle"];
