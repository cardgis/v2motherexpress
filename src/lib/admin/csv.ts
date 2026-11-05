/**
 * Export tableur — protection commune à toutes les feuilles de l'administration.
 *
 * Cette protection vivait dans `suivi.ts`. Elle est partagée dès qu'une
 * deuxième feuille s'exporte : une garantie de sécurité recopiée est une
 * garantie qui finit par diverger.
 */

export type Valeur = string | number | null;

export type Colonne<L> = [titre: string, lire: (ligne: L) => Valeur];

/**
 * Une cellule de fichier CSV, protégée contre l'injection de formule.
 *
 * Un nom de client saisi comme `=HYPERLINK(...)` s'exécuterait à l'ouverture
 * dans Excel : tout texte commençant par un caractère de formule est préfixé
 * d'une apostrophe. Seule exception, un téléphone déjà normalisé (« +221 77… »),
 * écrit comme texte pour qu'Excel ne le transforme pas en nombre.
 */
export function cellule(valeur: Valeur): string {
  if (valeur === null) return "";
  if (typeof valeur === "number") return String(valeur);

  if (/^\+\d[\d ]{5,20}$/.test(valeur)) return `="${valeur}"`;

  let texte = valeur.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  return /[";]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/**
 * Séparateur « ; » et marque UTF-8 en tête : c'est ce qu'attend Excel réglé
 * en français, sans quoi les accents et les colonnes arrivent brouillés.
 */
export function enCsv<L>(colonnes: Colonne<L>[], lignes: L[]): string {
  const entete = colonnes.map(([titre]) => cellule(titre)).join(";");
  const corps = lignes.map((l) => colonnes.map(([, lire]) => cellule(lire(l))).join(";"));
  return `﻿${[entete, ...corps].join("\r\n")}\r\n`;
}
