/**
 * Boutons et liens-boutons des espaces client et gérant.
 *
 * Le choix de la variante porte un sens, pas une préférence esthétique :
 *   primaire        l'action principale de l'écran (une seule, idéalement)
 *   secondaire      les autres actions
 *   succes          une validation définitive (valider un dossier, remettre une moto)
 *   danger          une action irréversible (déclarer une pièce non conforme)
 *   danger-discret  une suppression proposée sans être mise en avant
 *   fantome         retour, annulation
 */

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";

export type VarianteBouton =
  | "primaire"
  | "secondaire"
  | "succes"
  | "danger"
  | "danger-discret"
  | "fantome";

export type TailleBouton = "sm" | "md" | "lg";

interface Apparence {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  /** Occupe toute la largeur disponible. */
  bloc?: boolean;
  icone?: ReactNode;
}

export function classesBouton(
  { variante = "primaire", taille = "md", bloc = false }: Apparence,
  supplement?: string,
): string {
  return [
    "lme-btn",
    `lme-btn--${variante}`,
    taille !== "md" ? `lme-btn--${taille}` : null,
    bloc ? "lme-btn--bloc" : null,
    supplement,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Bouton({
  variante,
  taille,
  bloc,
  icone,
  chargement = false,
  className,
  disabled,
  type = "button",
  children,
  ...reste
}: Apparence &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Affiche un indicateur et bloque le bouton pendant l'opération. */
    chargement?: boolean;
  }) {
  return (
    <button
      type={type}
      className={classesBouton({ variante, taille, bloc }, className)}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      {...reste}
    >
      {chargement ? <LoaderCircle size={18} className="lme-rotation" aria-hidden /> : icone}
      {children}
    </button>
  );
}

/**
 * Lien présenté comme un bouton.
 *
 * `nouvelOnglet` sert aux documents (PDF servis par l'API) : lien HTML
 * classique, jamais `<Link>`, qui préchargerait le fichier en arrière-plan.
 */
export function LienBouton({
  href,
  variante,
  taille,
  bloc,
  icone,
  nouvelOnglet = false,
  className,
  children,
  ...reste
}: Apparence &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    nouvelOnglet?: boolean;
  }) {
  const classes = classesBouton({ variante, taille, bloc }, className);

  if (nouvelOnglet) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} {...reste}>
        {icone}
        {children}
        <ExternalLink size={16} aria-hidden />
        <span className="lme-sr"> (s’ouvre dans un nouvel onglet)</span>
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...reste}>
      {icone}
      {children}
    </Link>
  );
}
