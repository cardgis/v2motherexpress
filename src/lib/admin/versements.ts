/**
 * État des versements, toutes boutiques — vue de l'administrateur.
 *
 * La feuille de suivi montre les contrats ; celle-ci montre l'ARGENT : ce qui
 * est exigible aujourd'hui, ce qui est rentré, ce qui manque. Les deux se
 * complètent et ne se remplacent pas.
 *
 * ── Ce qu'une ligne représente ─────────────────────────────────────────────
 * Un dossier dont le contrat est scellé — c'est le scellement qui ouvre le
 * suivi — ou qui porte déjà un versement. Une réservation en cours de
 * signature n'a rien à encaisser : elle n'apparaît pas.
 *
 * ── Ce que la période filtre, et ce qu'elle ne filtre pas ──────────────────
 * Un solde est un état du JOUR : il ne se découpe pas en périodes. La période
 * ne sert donc qu'au total « encaissé sur la période ». Les lignes, elles,
 * montrent toujours la situation réelle du dossier.
 */

import { prisma } from "@/lib/prisma";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { calculerSolde, type SoldeReservation } from "@/lib/versements";
import { dateCourte } from "@/lib/formatters";
import { LIBELLES_MODE_PAIEMENT } from "@/lib/modes-paiement";
import type { Formule, ModePaiement, Prisma } from "@/generated/prisma";
import type { Periode } from "./filtres";
import { enCsv, type Colonne } from "./csv";

/** L'écran s'arrête là ; l'export va jusqu'à `LIMITE_EXPORT`. */
export const LIMITE_ECRAN = 300;
export const LIMITE_EXPORT = 10_000;

export const FILTRES_VERSEMENTS = [
  { code: "tous", libelle: "Tous" },
  { code: "retard", libelle: "En retard" },
  { code: "a-jour", libelle: "À jour" },
  { code: "soldes", libelle: "Soldés" },
] as const;

export type FiltreVersements = (typeof FILTRES_VERSEMENTS)[number]["code"];

export function lireFiltreVersements(saisie: unknown): FiltreVersements {
  return FILTRES_VERSEMENTS.find((f) => f.code === saisie)?.code ?? "tous";
}

export interface VersementVu {
  id: string;
  montant: number;
  mode: ModePaiement;
  recuLe: Date;
  reference: string | null;
  recuRef: string | null;
  /** Renseigné dès que l'attestation a été tirée pour ce versement. */
  recuPdfPath: string | null;
  saisiParNom: string;
  annuleLe: Date | null;
  annuleMotif: string | null;
}

export interface LigneVersements {
  reservationId: string;
  /** Pour ouvrir la fiche du dossier ; jamais exporté. */
  customerId: string;
  reference: string;
  client: string;
  contact: string | null;
  boutique: string;
  formule: Formule;
  modele: string;
  solde: SoldeReservation;
  versements: VersementVu[];
  dernierVersement: Date | null;
}

export interface TotauxVersements {
  duADate: number;
  encaisse: number;
  retard: number;
  enRetard: number;
  /** Versements non annulés reçus dans la période choisie. */
  encaissePeriode: number;
}

/**
 * Dossiers concernés par un encaissement.
 *
 * `suiviDepuis` est posé au scellement : c'est le marqueur le plus sûr. Les
 * deux autres cas rattrapent les contrats scellés avant la mise en service du
 * suivi, pour qu'aucun dossier qui reçoit de l'argent ne reste invisible.
 */
function conditions(boutiqueId: string | null): Prisma.ReservationWhereInput {
  return {
    ...(boutiqueId ? { boutiqueId } : {}),
    statut: { notIn: ["BROUILLON", "ANNULEE", "CADUQUE"] },
    OR: [
      { suiviDepuis: { not: null } },
      { encaissements: { some: {} } },
      { contract: { is: { statut: { in: ["SIGNE", "EN_ATTENTE_RETRAIT", "RETIRE"] } } } },
    ],
  };
}

export async function chargerEtatVersements(
  filtres: { periode: Periode; boutiqueId: string | null; filtre: FiltreVersements },
  limite: number,
) {
  const reservations = await prisma.reservation.findMany({
    where: conditions(filtres.boutiqueId),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerId: true,
      reference: true,
      formule: true,
      montantTotal: true,
      redevanceJournaliere: true,
      suiviDepuis: true,
      // Date d'arrêt : elle gèle le compteur d'une accession rompue.
      restitution: { select: { dateRestitution: true } },
      modeleContrat: true,
      produit: { select: { nom: true } },
      boutique: { select: { store: { select: { name: true } } } },
      customer: {
        select: { nom: true, prenom: true, telephoneContact: true, user: { select: { telephone: true } } },
      },
      echeances: { select: { montantDu: true, echeanceLe: true } },
      encaissements: {
        select: {
          id: true,
          montant: true,
          mode: true,
          recuLe: true,
          reference: true,
          recuRef: true,
          recuPdfPath: true,
          saisiParNom: true,
          annuleLe: true,
          annuleMotif: true,
        },
        orderBy: { recuLe: "desc" },
      },
      contract: {
        select: {
          events: { where: { type: "SCELLE" }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
        },
      },
    },
  });

  const toutes: LigneVersements[] = reservations.map((r) => {
    const c = r.customer;
    const vivants = r.encaissements.filter((e) => e.annuleLe === null);

    return {
      reservationId: r.id,
      customerId: r.customerId,
      reference: r.reference,
      client: c.nom && c.prenom ? `${c.nom.toUpperCase()} ${c.prenom}` : "Dossier sans nom",
      contact: c.user.telephone ?? c.telephoneContact,
      boutique: r.boutique.store.name,
      formule: r.formule,
      modele: r.modeleContrat ?? r.produit.nom,
      solde: calculerSolde({
        formule: r.formule,
        montantTotal: r.montantTotal,
        redevanceJournaliere: r.redevanceJournaliere,
        scelleLe: r.contract?.events[0]?.createdAt ?? null,
        suiviDepuis: r.suiviDepuis,
        arreteLe: r.restitution?.dateRestitution ?? null,
        echeances: r.echeances,
        encaissements: r.encaissements,
      }),
      versements: r.encaissements,
      dernierVersement: vivants[0]?.recuLe ?? null,
    };
  });

  const retenues = toutes.filter((l) => {
    switch (filtres.filtre) {
      case "retard":
        return l.solde.retard > 0;
      case "a-jour":
        return l.solde.retard === 0 && !l.solde.solde;
      case "soldes":
        return l.solde.solde;
      default:
        return true;
    }
  });

  // Le plus urgent d'abord : c'est la raison d'être de l'écran.
  retenues.sort((a, b) => b.solde.retard - a.solde.retard || a.client.localeCompare(b.client));

  const debut = filtres.periode.debut;
  const fin = filtres.periode.fin;
  const dansPeriode = (d: Date) => (!debut || d >= debut) && (!fin || d < fin);

  const totaux: TotauxVersements = {
    duADate: retenues.reduce((s, l) => s + l.solde.duADate, 0),
    encaisse: retenues.reduce((s, l) => s + l.solde.encaisse, 0),
    retard: retenues.reduce((s, l) => s + l.solde.retard, 0),
    enRetard: retenues.filter((l) => l.solde.retard > 0).length,
    encaissePeriode: retenues.reduce(
      (s, l) =>
        s +
        l.versements
          .filter((v) => v.annuleLe === null && dansPeriode(v.recuLe))
          .reduce((t, v) => t + v.montant, 0),
      0,
    ),
  };

  return { total: retenues.length, totaux, lignes: retenues.slice(0, limite) };
}

// ---------------------------------------------------------------------------
// Export tableur
// ---------------------------------------------------------------------------

const COLONNES: Colonne<LigneVersements>[] = [
  ["Référence", (l) => l.reference],
  ["Client", (l) => l.client],
  ["Contact", (l) => l.contact],
  ["Boutique", (l) => l.boutique],
  ["Formule", (l) => LIBELLES_FORMULE[l.formule]],
  ["Modèle", (l) => l.modele],
  ["Montant du contrat (FCFA)", (l) => l.solde.duTotal],
  ["Dû à ce jour (FCFA)", (l) => l.solde.duADate],
  ["Encaissé (FCFA)", (l) => l.solde.encaisse],
  ["Reste au terme (FCFA)", (l) => l.solde.restant],
  ["Retard (FCFA)", (l) => l.solde.retard],
  ["Retard (jours)", (l) => l.solde.joursDeRetard],
  ["Soldé", (l) => (l.solde.solde ? "oui" : "non")],
  ["Suivi partiel", (l) => (l.solde.suiviPartiel ? "oui" : "non")],
  ["Versements", (l) => l.versements.filter((v) => v.annuleLe === null).length],
  ["Dernier versement", (l) => (l.dernierVersement ? dateCourte(l.dernierVersement) : null)],
  [
    "Modes employés",
    (l) => {
      const modes = [...new Set(l.versements.filter((v) => v.annuleLe === null).map((v) => v.mode))];
      return modes.map((m) => LIBELLES_MODE_PAIEMENT[m]).join(" · ") || null;
    },
  ],
];

export function versementsEnCsv(lignes: LigneVersements[]): string {
  return enCsv(COLONNES, lignes);
}
