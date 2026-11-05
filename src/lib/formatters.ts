export const money = (value?: number | null) =>
  value ? `${value.toLocaleString("fr-FR")} F` : "-";

// ---------------------------------------------------------------------------
// V2 — formatage contractuel
//
// Les montants sont TOUJOURS des entiers de francs CFA. Aucun formatage de
// montant ne doit être écrit à la main ailleurs : ce qui s'affiche à l'écran
// doit être identique, au caractère près, à ce qui s'imprime sur le contrat.
// ---------------------------------------------------------------------------

/** Fuseau de référence — UTC+0 toute l'année, pas de changement d'heure. */
export const FUSEAU_DAKAR = "Africa/Dakar";

/** 410000 → « 410 000 FCFA » (espaces normales, lisibles dans un PDF). */
export function fcfa(montant: number): string {
  return (
    new Intl.NumberFormat("fr-FR").format(Math.round(montant)).replace(/[  ]/g, " ") +
    " FCFA"
  );
}

/** 410000 → « 410 000 » — sans devise, pour les tableaux et les colonnes chiffrées. */
export function nombre(valeur: number): string {
  return new Intl.NumberFormat("fr-FR").format(valeur).replace(/[  ]/g, " ");
}

/** (3, "moto") → « 3 motos » ; (1, "commercial", "commerciaux") → « 1 commercial ». */
export function quantite(n: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${nombre(n)} ${n > 1 ? pluriel : singulier}`;
}

/** « 12 mars 2026 » — heure de Dakar. */
export function dateFr(d: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: FUSEAU_DAKAR,
  }).format(new Date(d));
}

/** « 12/03/2026 14:32:07 » — pour les blocs de traçabilité et la piste d'audit. */
export function horodatageFr(d: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: FUSEAU_DAKAR,
  }).format(new Date(d));
}

/** « 04/07/2026 » — c'est le format employé sur les actes. */
export function dateCourte(d: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: FUSEAU_DAKAR,
  }).format(new Date(d));
}

/**
 * Ajoute un nombre de mois à une date, en heure de Dakar.
 * Sert à calculer la date de fin d'un contrat d'accession à partir de sa durée.
 */
export function ajouterMois(d: Date, mois: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + mois);
  return r;
}
