/**
 * Feuille de suivi — une ligne par réservation, pour les réunions d'équipe.
 *
 * Une ligne entre dans la période si la réservation OU la signature du
 * contrat y tombe : un contrat réservé en août et signé en septembre apparaît
 * dans les deux mois. Le filtre « En cours » montre l'état du jour, sans
 * période.
 *
 * Données personnelles : nom et moyen de contact du client, rien de plus.
 * Aucun numéro de pièce d'identité ne sort de l'application par ce biais.
 */

import { prisma } from "@/lib/prisma";
import { dateCourte } from "@/lib/formatters";
import { formaterTelephone } from "@/lib/phone";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { presentationStatut, STATUTS_VIVANTS } from "@/lib/statuts";
import type { Prisma } from "@/generated/prisma";
import { FORMULE_DU_TYPE, type Periode, type TypeSuivi } from "./filtres";
import { enCsv, type Colonne } from "./csv";

/** L'écran s'arrête là ; l'export va jusqu'à `LIMITE_EXPORT`. */
export const LIMITE_ECRAN = 500;
export const LIMITE_EXPORT = 10_000;

export interface LigneSuivi {
  /** Pour ouvrir le dossier depuis la feuille ; jamais exporté. */
  customerId: string;
  reference: string;
  reserveLe: Date;
  signeLe: Date | null;
  boutique: string;
  client: string;
  contact: string;
  formule: string;
  modele: string;
  dureeMois: number | null;
  redevanceJournaliere: number | null;
  montant: number;
  statutReservation: string;
  statutContrat: string | null;
  serie: string | null;
}

export interface FiltresSuivi {
  periode: Periode;
  boutiqueId: string | null;
  type: TypeSuivi;
}

function conditions({ periode, boutiqueId, type }: FiltresSuivi): Prisma.ReservationWhereInput {
  const intervalle = periode.debut && periode.fin ? { gte: periode.debut, lt: periode.fin } : undefined;
  const formule = FORMULE_DU_TYPE[type];

  return {
    statut: type === "en-cours" ? "ACTIVE" : { not: "BROUILLON" },
    ...(boutiqueId ? { boutiqueId } : {}),
    ...(formule ? { formule } : {}),
    ...(intervalle && type !== "en-cours"
      ? {
          OR: [
            { createdAt: intervalle },
            { contract: { is: { events: { some: { type: "SCELLE", createdAt: intervalle } } } } },
          ],
        }
      : {}),
  };
}

export async function chargerSuivi(filtres: FiltresSuivi, limite: number) {
  const where = conditions(filtres);

  // Le TOTAL ne compte que les contrats VIVANTS : un caduc n'a jamais rien
  // produit, un terminé ou un arrêté ne produira plus rien. Les LIGNES, elles,
  // restent toutes affichées — on veut VOIR la ligne caduque, pas l'additionner.
  //
  // Intersection et non remplacement : en filtre « En cours », `where` limite
  // déjà à ACTIVE, et écraser son statut élargirait le total au lieu de le
  // restreindre.
  const whereEngage: Prisma.ReservationWhereInput = {
    AND: [where, { statut: { in: [...STATUTS_VIVANTS] } }],
  };

  const [total, somme, reservations] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.aggregate({ where: whereEngage, _sum: { montantTotal: true } }),
    prisma.reservation.findMany({
      where,
      take: limite,
      orderBy: { createdAt: "desc" },
      select: {
        customerId: true,
        reference: true,
        createdAt: true,
        formule: true,
        statut: true,
        dureeMois: true,
        redevanceJournaliere: true,
        montantTotal: true,
        modeleContrat: true,
        numeroSerieContrat: true,
        boutique: { select: { store: { select: { name: true } } } },
        produit: { select: { nom: true } },
        vehicule: { select: { numeroChassis: true } },
        customer: {
          select: {
            nom: true,
            prenom: true,
            telephoneContact: true,
            user: { select: { telephone: true, email: true } },
          },
        },
        contract: {
          select: {
            statut: true,
            events: {
              where: { type: "SCELLE" },
              select: { createdAt: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const lignes: LigneSuivi[] = reservations.map((r) => {
    const c = r.customer;
    const telephone = c.user.telephone ?? c.telephoneContact;
    return {
      customerId: r.customerId,
      reference: r.reference,
      reserveLe: r.createdAt,
      signeLe: r.contract?.events[0]?.createdAt ?? null,
      boutique: r.boutique.store.name,
      client: c.nom && c.prenom ? `${c.nom.toUpperCase()} ${c.prenom}` : "Dossier sans nom",
      contact: telephone ? formaterTelephone(telephone) : (c.user.email ?? ""),
      formule: LIBELLES_FORMULE[r.formule],
      modele: r.modeleContrat ?? r.produit.nom,
      dureeMois: r.dureeMois,
      redevanceJournaliere: r.redevanceJournaliere,
      montant: r.montantTotal,
      statutReservation: presentationStatut("reservation", r.statut, "gerant").libelle,
      statutContrat: r.contract ? presentationStatut("contrat", r.contract.statut, "gerant").libelle : null,
      serie: r.vehicule?.numeroChassis ?? r.numeroSerieContrat,
    };
  });

  return { total, montantEngage: somme._sum.montantTotal ?? 0, lignes };
}

// ---------------------------------------------------------------------------
// Export tableur
// ---------------------------------------------------------------------------

const COLONNES: Colonne<LigneSuivi>[] = [
  ["Référence", (l) => l.reference],
  ["Réservé le", (l) => dateCourte(l.reserveLe)],
  ["Signé le", (l) => (l.signeLe ? dateCourte(l.signeLe) : null)],
  ["Boutique", (l) => l.boutique],
  ["Client", (l) => l.client],
  ["Contact", (l) => l.contact],
  ["Formule", (l) => l.formule],
  ["Modèle", (l) => l.modele],
  ["Durée (mois)", (l) => l.dureeMois],
  ["Redevance journalière (FCFA)", (l) => l.redevanceJournaliere],
  ["Montant (FCFA)", (l) => l.montant],
  ["Statut", (l) => l.statutReservation],
  ["Contrat", (l) => l.statutContrat],
  ["N° de série", (l) => l.serie],
];

export function suiviEnCsv(lignes: LigneSuivi[]): string {
  return enCsv(COLONNES, lignes);
}
