/**
 * Profils des comptes et page d'accueil de chacun.
 *
 * Importable côté client : types Prisma uniquement, aucun accès à la base.
 */

import type { Role } from "@/generated/prisma";

export const LIBELLES_ROLE: Record<Role, string> = {
  CLIENT: "Client",
  GERANT: "Gérant",
  COMMERCIAL: "Commercial",
  ADMIN: "Administrateur",
};

/** Profils qu'un administrateur peut attribuer dans une boutique. */
export const ROLES_EQUIPE = ["GERANT", "COMMERCIAL"] as const satisfies readonly Role[];
export type RoleEquipe = (typeof ROLES_EQUIPE)[number];

/** Où arrive chaque profil après sa connexion. */
export function accueilDuRole(role: Role): string {
  switch (role) {
    case "CLIENT":
      return "/compte";
    case "ADMIN":
      return "/admin";
    case "GERANT":
    case "COMMERCIAL":
      return "/gerant";
  }
}
