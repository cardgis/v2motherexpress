/**
 * Annulation d'un dossier par la boutique.
 *
 * ── Ce qui manquait ───────────────────────────────────────────────────────
 * `ANNULEE` et `ANNULE` existaient dans les énumérations, trois requêtes les
 * excluaient par filtre — mais AUCUNE ligne de code ne les écrivait jamais.
 * Personne ne pouvait donc annuler quoi que ce soit : un client qui se
 * désistait laissait son dossier en attente pour toujours, et sa moto bloquée
 * au stock.
 *
 * ── Qui peut annuler ──────────────────────────────────────────────────────
 * Le gérant et l'administrateur, avec un motif conservé. Décision d'Alexandre
 * du 2026-09-29 : le client qui se désiste appelle ou passe en boutique, il n'a
 * pas de bouton dans son espace — l'appel permet de le retenir, ou au moins de
 * comprendre pourquoi il renonce.
 *
 * ── Jusqu'à quand ─────────────────────────────────────────────────────────
 * Tant que le contrat n'est pas SCELLÉ. Un contrat signé par le client mais pas
 * encore contresigné reste annulable : la boutique est libre de ne pas
 * s'engager. Une fois scellé, ce serait une résiliation — autre acte, autres
 * conséquences — et le passage du délai relève du cron d'expiration.
 */

import { prisma } from "@/lib/prisma";
import type { Utilisateur } from "@/lib/auth";
import type { StatutContrat, StatutReservation } from "@/generated/prisma";

/** Le motif est une preuve : trop court, il ne dit rien. */
const MOTIF_MINIMUM = 10;

/** Avant scellement seulement. */
const STATUTS_ANNULABLES: readonly StatutReservation[] = [
  "BROUILLON",
  "EN_ATTENTE_DOSSIER",
  "EN_ATTENTE_VALIDATION",
  "EN_ATTENTE_SIGNATURE",
];

/** Au-delà, l'acte engage les deux parties : on ne l'annule plus par un bouton. */
const CONTRAT_SCELLE: readonly StatutContrat[] = ["SIGNE", "EN_ATTENTE_RETRAIT", "RETIRE"];

export class ErreurAnnulation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurAnnulation";
  }
}

function perimetre(membre: Utilisateur) {
  return membre.role === "ADMIN" ? {} : { boutiqueId: membre.boutiqueId ?? "__aucune__" };
}

/** Un dossier est-il encore annulable ? Sert aussi à l'affichage du bouton. */
export function estAnnulable(
  statut: StatutReservation,
  statutContrat: StatutContrat | null,
): boolean {
  if (!STATUTS_ANNULABLES.includes(statut)) return false;
  return statutContrat === null || !CONTRAT_SCELLE.includes(statutContrat);
}

export async function annulerDossier(params: {
  membre: Utilisateur;
  reservationId: string;
  motif: string;
  ip: string;
}) {
  const { membre, reservationId, ip } = params;
  const motif = params.motif.trim();

  if (motif.length < MOTIF_MINIMUM) {
    throw new ErreurAnnulation(
      "Indiquez pourquoi le dossier est annulé : ce motif est conservé comme trace.",
    );
  }
  if (motif.length > 1000) {
    throw new ErreurAnnulation("Le motif est trop long : 1 000 caractères maximum.");
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(membre) },
    select: {
      id: true,
      reference: true,
      statut: true,
      annuleLe: true,
      vehiculeId: true,
      contract: { select: { id: true, statut: true } },
    },
  });

  if (!reservation) throw new ErreurAnnulation("Réservation introuvable.");

  if (reservation.annuleLe) {
    throw new ErreurAnnulation("Ce dossier est déjà annulé.");
  }

  if (!estAnnulable(reservation.statut, reservation.contract?.statut ?? null)) {
    // Le message dit quoi faire à la place : un refus sans issue laisse le
    // gérant sans solution devant son client.
    throw new ErreurAnnulation(
      reservation.statut === "ACTIVE"
        ? "Le véhicule est sorti : passez par le constat de restitution pour clore ce contrat."
        : `Annulation impossible sur un dossier en statut ${reservation.statut}. ` +
            "Un contrat scellé ne s'annule pas : il se résilie.",
    );
  }

  const maintenant = new Date();

  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        statut: "ANNULEE",
        annuleLe: maintenant,
        annuleParUserId: membre.id,
        annuleMotif: motif,
        // Le délai de retrait n'a plus d'objet : le cron n'a pas à repasser
        // dessus pour la déclarer caduque.
        expireLe: null,
      },
    }),

    ...(reservation.contract
      ? [
          prisma.contract.update({
            where: { id: reservation.contract.id },
            data: { statut: "ANNULE" },
          }),
          prisma.contractEvent.create({
            data: {
              contractId: reservation.contract.id,
              type: "ANNULE",
              acteurUserId: membre.id,
              ip,
              metadata: {
                motif,
                statutAvant: reservation.statut,
                contratAvant: reservation.contract.statut,
                vehiculeLibere: reservation.vehiculeId !== null,
              },
            },
          }),
        ]
      : []),

    // La moto retourne au stock : c'était tout l'enjeu.
    ...(reservation.vehiculeId
      ? [
          prisma.vehicule.update({
            where: { id: reservation.vehiculeId },
            data: { statut: "DISPONIBLE" },
          }),
        ]
      : []),
  ]);

  return {
    reference: reservation.reference,
    vehiculeLibere: reservation.vehiculeId !== null,
  };
}
