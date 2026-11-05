/**
 * Modes de paiement cochés par le gérant sur l'acte.
 *
 * Les deux actes (location-accession, vente échelonnée) impriment les quatre
 * cases de l'article « Modalités de paiement » ; le gérant coche celles
 * convenues avec le client, comme il saisit la date ou le numéro de série.
 *
 * Module sans dépendance serveur : partagé par l'écran du gérant, l'API et la
 * composition des actes.
 */

import type { ModePaiement } from "@/generated/prisma";

/** Ordre d'impression sur les actes — ne pas le modifier. */
export const MODES_PAIEMENT = ["ESPECES", "WAVE", "ORANGE_MONEY", "VIREMENT"] as const satisfies readonly ModePaiement[];

export const LIBELLES_MODE_PAIEMENT: Record<ModePaiement, string> = {
  ESPECES: "Espèces",
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  VIREMENT: "Virement bancaire",
};

/** Sans doublon et dans l'ordre des actes, quel que soit l'ordre des clics. */
export function normaliserModes(modes: readonly ModePaiement[]): ModePaiement[] {
  return MODES_PAIEMENT.filter((m) => modes.includes(m));
}
