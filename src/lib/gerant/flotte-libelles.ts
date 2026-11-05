/**
 * Libellés et règles d'affichage de la flotte.
 *
 * Module volontairement SANS accès à la base : il est importé par des
 * composants client, et faire transiter `@/lib/prisma` par là entraînerait
 * `pg` — donc `dns`, `net`, `tls` — dans le bundle du navigateur, où rien de
 * tout cela n'existe.
 */

import type { StatutVehicule } from "@/generated/prisma";

/** Statuts que le gérant peut poser lui-même. */
export const STATUTS_MANUELS: StatutVehicule[] = ["DISPONIBLE", "MAINTENANCE", "HORS_SERVICE"];

/** Statuts posés par le parcours client, jamais à la main. */
export const STATUTS_AUTOMATIQUES: StatutVehicule[] = ["RESERVE", "EN_LOCATION", "VENDU"];

export const LIBELLES_STATUT_VEHICULE: Record<StatutVehicule, string> = {
  DISPONIBLE: "Disponible",
  RESERVE: "Réservée",
  EN_LOCATION: "En location",
  MAINTENANCE: "En atelier",
  VENDU: "Vendue",
  HORS_SERVICE: "Hors service",
};
