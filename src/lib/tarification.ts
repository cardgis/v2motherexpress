/**
 * Calcul des montants et des échéanciers — La Mother Express.
 *
 * ── Invariant absolu ───────────────────────────────────────────────────────
 * Tous les montants sont des ENTIERS de francs CFA. Aucun flottant ne doit
 * approcher un montant : sur un échéancier 60 % + 4 × 10 %, des arrondis
 * flottants produiraient un reliquat de quelques francs qui ne tombe jamais
 * juste. Le résidu d'arrondi est systématiquement reporté sur la DERNIÈRE
 * échéance, de sorte que la somme des échéances égale toujours le total, au
 * franc près.
 *
 * ── Règle des 6 jours sur 7 ────────────────────────────────────────────────
 * La redevance n'est due que 6 jours par semaine. Ne JAMAIS multiplier un
 * tarif journalier par 30 pour obtenir un mois. La conversion passe toujours
 * par les semaines :
 *
 *     semaines = mois × 52 / 12       jours facturés = semaines × 6
 *
 * Contrôle : B12, 5 000 F/j sur 24 mois
 *     24 × 52 / 12 = 104 semaines → 624 jours → 3 120 000 FCFA
 * ce qui correspond aux ~3,12 M FCFA de la grille tarifaire.
 */

/** Jours facturés par semaine — la redevance n'est pas due le 7ᵉ jour. */
export const JOURS_FACTURES_PAR_SEMAINE = 6;

const SEMAINES_PAR_MOIS = 52 / 12;

/** Convertit une durée en mois vers le nombre de jours effectivement facturés. */
export function joursFactures(dureeMois: number): number {
  const semaines = Math.round(dureeMois * SEMAINES_PAR_MOIS);
  return semaines * JOURS_FACTURES_PAR_SEMAINE;
}

/**
 * Nombre de jours facturés entre deux dates, règle des 6 j/7 appliquée.
 * Utilisé pour la location courte durée, où le client choisit ses dates.
 */
export function joursFacturesEntre(debut: Date, fin: Date): number {
  const MS_JOUR = 24 * 3_600_000;
  const joursCalendaires =
    Math.round((dateSeule(fin).getTime() - dateSeule(debut).getTime()) / MS_JOUR) + 1;

  if (joursCalendaires <= 0) return 0;

  // 6 jours facturés par tranche de 7, plus le reliquat plafonné à 6.
  const semaines = Math.floor(joursCalendaires / 7);
  const reste = joursCalendaires % 7;
  return semaines * JOURS_FACTURES_PAR_SEMAINE + Math.min(reste, JOURS_FACTURES_PAR_SEMAINE);
}

/** Ramène une date à minuit — les durées se comptent en jours, pas en heures. */
function dateSeule(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Échéanciers
// ---------------------------------------------------------------------------

export interface Echeance {
  numero: number;
  libelle: string;
  montant: number;
  /** Jours après la signature. 0 = dû à la signature. */
  jourDepuisSignature: number;
}

/**
 * Répartit un total en parts entières dont la somme vaut exactement le total.
 * Le résidu d'arrondi va sur la dernière part.
 */
function repartir(total: number, parts: number[]): number[] {
  const montants = parts.slice(0, -1).map((p) => Math.round(total * p));
  const dejaReparti = montants.reduce((s, m) => s + m, 0);
  montants.push(total - dejaReparti);
  return montants;
}

/**
 * Vente échelonnée : 60 % à la signature, puis 4 × 10 % étalés sur 120 jours
 * (une échéance tous les 30 jours).
 */
export function echeancierVenteEchelonnee(prixTotal: number): Echeance[] {
  const montants = repartir(prixTotal, [0.6, 0.1, 0.1, 0.1, 0.1]);

  return montants.map((montant, i) => ({
    numero: i + 1,
    libelle: i === 0 ? "Acompte à la signature (60 %)" : `Échéance ${i} sur 4 (10 %)`,
    montant,
    jourDepuisSignature: i * 30,
  }));
}

// ---------------------------------------------------------------------------
// Location-accession
// ---------------------------------------------------------------------------

export interface OffreAccession {
  redevanceJournaliere: number;
  dureeMois: number;
  /** Durée ferme : le tarif remisé est lié à un engagement contractuel. */
  avecEngagement: boolean;
  /**
   * Différentiel dû par jour loué en cas de rupture anticipée imputable au
   * client. Nul si l'offre est sans engagement.
   */
  differentielSiRupture: number;
}

export interface CalculAccession extends OffreAccession {
  joursFactures: number;
  montantTotal: number;
}

export function calculerAccession(offre: OffreAccession): CalculAccession {
  const jours = joursFactures(offre.dureeMois);
  return {
    ...offre,
    joursFactures: jours,
    montantTotal: offre.redevanceJournaliere * jours,
  };
}

/**
 * Rupture anticipée d'une offre à engagement : le tarif remisé était la
 * contrepartie de la durée ferme. Le différentiel est dû sur TOUS les jours
 * effectivement loués, pas seulement sur les jours restants.
 *
 * Exemple A10 : 2 500 F/j au lieu de 3 000 F/j contre 12 mois d'engagement.
 * Rupture au bout de 100 jours loués → 100 × 500 = 50 000 F dus.
 */
export function differentielRuptureAnticipee(
  offre: OffreAccession,
  joursEffectivementLoues: number,
): number {
  if (!offre.avecEngagement) return 0;
  return offre.differentielSiRupture * Math.max(0, joursEffectivementLoues);
}

// ---------------------------------------------------------------------------
// Location courte durée
// ---------------------------------------------------------------------------

export function calculerLocationJournaliere(params: {
  tarifJournalier: number;
  dateDebut: Date;
  dateFin: Date;
}): { joursFactures: number; montantTotal: number } {
  const jours = joursFacturesEntre(params.dateDebut, params.dateFin);
  return { joursFactures: jours, montantTotal: params.tarifJournalier * jours };
}
