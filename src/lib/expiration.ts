/**
 * Réservations non retirées — libération automatique du véhicule.
 *
 * ── La promesse que le schéma faisait déjà ─────────────────────────────────
 * `Reservation.expireLe` est posé à 7 jours au scellement, et son commentaire
 * annonce : « Passé ce délai sans retrait, un cron libère le véhicule ».
 * Ce cron n'existait pas. Une moto réservée pour un client qui ne venait plus
 * restait donc bloquée indéfiniment, invisible pour les autres clients.
 *
 * `CADUQUE` est bien l'état voulu : son commentaire dans le schéma dit
 * « pièce non conforme au retrait, OU DÉLAI DÉPASSÉ ».
 *
 * ── Ce qui n'est PAS touché ────────────────────────────────────────────────
 * Seules les réservations en `EN_ATTENTE_RETRAIT` dont le délai est passé. Une
 * réservation déjà retirée a vu son `expireLe` effacé au retrait ; un dossier
 * qui n'a pas atteint le scellement n'en a jamais eu.
 *
 * Rien n'est supprimé : le dossier, ses pièces et sa piste d'audit restent.
 * C'est une libération de stock, pas un effacement.
 */

import { prisma } from "@/lib/prisma";

export interface ReservationExpiree {
  reference: string;
  expireLe: Date;
  /** Numéro de châssis de la moto rendue au stock, si une était attribuée. */
  vehiculeLibere: string | null;
}

/**
 * Passe en caducité les réservations dont le délai de retrait est dépassé.
 *
 * `apercu` n'écrit rien : il sert à voir ce que le cron ferait avant de le
 * laisser tourner seul.
 */
export async function expirerReservations(
  options: { maintenant?: Date; apercu?: boolean } = {},
): Promise<ReservationExpiree[]> {
  const maintenant = options.maintenant ?? new Date();

  const candidates = await prisma.reservation.findMany({
    where: {
      statut: "EN_ATTENTE_RETRAIT",
      expireLe: { not: null, lt: maintenant },
    },
    select: {
      id: true,
      reference: true,
      expireLe: true,
      vehiculeId: true,
      vehicule: { select: { numeroChassis: true } },
      contract: { select: { id: true } },
    },
    orderBy: { expireLe: "asc" },
  });

  const expirees: ReservationExpiree[] = [];

  for (const r of candidates) {
    const ligne: ReservationExpiree = {
      reference: r.reference,
      expireLe: r.expireLe!,
      vehiculeLibere: r.vehicule?.numeroChassis ?? null,
    };

    if (options.apercu) {
      expirees.push(ligne);
      continue;
    }

    // Une transaction PAR réservation : si l'une échoue, les autres sont déjà
    // libérées. Un lot entier qui retombe parce qu'un dossier est bancal
    // laisserait des motos bloquées sans raison.
    await prisma.$transaction([
      prisma.reservation.update({ where: { id: r.id }, data: { statut: "CADUQUE" } }),

      ...(r.contract
        ? [
            prisma.contract.update({ where: { id: r.contract.id }, data: { statut: "CADUC" } }),
            prisma.contractEvent.create({
              data: {
                contractId: r.contract.id,
                type: "EXPIRE",
                metadata: {
                  expireLe: r.expireLe!.toISOString(),
                  constateLe: maintenant.toISOString(),
                  vehiculeLibere: ligne.vehiculeLibere,
                },
              },
            }),
          ]
        : []),

      ...(r.vehiculeId
        ? [prisma.vehicule.update({ where: { id: r.vehiculeId }, data: { statut: "DISPONIBLE" } })]
        : []),
    ]);

    expirees.push(ligne);
  }

  return expirees;
}
