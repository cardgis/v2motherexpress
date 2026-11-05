/**
 * Page où renvoyer le visiteur après sa connexion (`?suite=`).
 *
 * Le paramètre vient de l'adresse : n'importe qui peut forger un lien
 * `/compte/connexion?suite=https://site-pirate.example`. On n'accepte donc
 * qu'un chemin interne de l'espace client, avec au plus des paramètres simples
 * (lettres, chiffres, `=`, `&`, `-`, `_`) : ni `//`, ni `:`, ni `.`, ni `%` —
 * rien qui puisse désigner un autre site.
 */

export const LIEN_RESERVER = "/compte/connexion?suite=/compte/reserver";

/** Ce que le visiteur a cliqué sur la fiche d'un modèle. */
export type IntentionReservation = "location" | "achat";

/**
 * Réserver un modèle précis depuis la vitrine : le formulaire s'ouvre avec ce
 * modèle choisi, et la vente échelonnée présélectionnée pour un achat.
 */
export function lienReserver(modele: string, intention: IntentionReservation): string {
  const suite = `/compte/reserver?modele=${encodeURIComponent(modele)}&intention=${intention}`;
  return `/compte/connexion?suite=${encodeURIComponent(suite)}`;
}

export function suiteSure(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  if (!/^\/compte(\/[a-z0-9-]+)*(\?[a-z0-9=&_-]{1,200})?$/i.test(valeur)) return null;
  // Revenir sur la connexion après s'être connecté tournerait en rond.
  if (valeur.startsWith("/compte/connexion")) return null;
  return valeur;
}
