/**
 * Adresses du back-office, selon l'espace depuis lequel on l'ouvre.
 *
 * Les mêmes écrans — dossiers, retrait, flotte — servent au gérant, au
 * commercial et à l'administrateur. Ils vivaient sous `/gerant`, si bien que
 * l'administrateur quittait son espace dès qu'il ouvrait un contrat : il
 * perdait ses onglets, et l'adresse affichait `/gerant`.
 *
 * Chaque écran reçoit donc sa base et y puise ses liens. Aucune duplication de
 * page : seules les adresses et les libellés du fil d'Ariane changent.
 *
 * Module sans dépendance serveur : importable par les composants client.
 */

export type BaseBackOffice = "/admin" | "/gerant";

interface Etape {
  libelle: string;
  href: string;
}

/** Première marche du fil d'Ariane : l'accueil de l'espace. */
export const FIL_RACINE: Record<BaseBackOffice, Etape> = {
  "/admin": { libelle: "Chiffres", href: "/admin" },
  "/gerant": { libelle: "Tableau de bord", href: "/gerant" },
};

/** Deuxième marche : la liste des dossiers, nommée selon l'espace. */
export const FIL_DOSSIERS: Record<BaseBackOffice, Etape> = {
  "/admin": { libelle: "Contrats", href: "/admin/contrats" },
  "/gerant": { libelle: "Dossiers", href: "/gerant/dossiers" },
};

/** La liste s'appelle « Contrats » côté administration, « Dossiers » en boutique. */
export const cheminDossier = (base: BaseBackOffice, customerId: string): string =>
  base === "/admin" ? `/admin/contrats/${customerId}` : `/gerant/dossiers/${customerId}`;

export const cheminRetrait = (base: BaseBackOffice, reservationId: string): string =>
  `${base}/retrait/${reservationId}`;

/** Fin de contrat : constat de restitution, symétrique du retrait. */
export const cheminRestitution = (base: BaseBackOffice, reservationId: string): string =>
  `${base}/restitution/${reservationId}`;

export const cheminFlotte = (base: BaseBackOffice): string => `${base}/flotte`;
