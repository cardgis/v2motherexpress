/**
 * Choix exclusifs présentés en cartes ou en segments.
 *
 * Sous l'habillage, de vrais boutons radio : un groupe se parcourt au clavier
 * avec les flèches, et les lecteurs d'écran annoncent « 2 sur 3, coché ». Des
 * boutons ordinaires imitant des radios perdent tout cela.
 *
 * Le contenu d'un `<label>` doit rester en ligne : utiliser des `<span>`,
 * jamais de `<div>` ni de composant de bloc à l'intérieur.
 */

import type { ReactNode } from "react";

export function GroupeChoix({
  legende,
  requis = false,
  disposition = "pile",
  children,
}: {
  legende: ReactNode;
  requis?: boolean;
  disposition?: "pile" | "grille" | "segments";
  children: ReactNode;
}) {
  const classe =
    disposition === "grille" ? "lme-grille-choix" : disposition === "segments" ? "lme-segments" : "lme-pile lme-pile--serree";

  return (
    <fieldset className="lme-groupe">
      <legend>
        {legende}
        {requis ? (
          <span className="lme-requis" aria-hidden>
            *
          </span>
        ) : null}
      </legend>
      <div className={classe}>{children}</div>
    </fieldset>
  );
}

export function Choix<V extends string>({
  nom,
  valeur,
  coche,
  onChoisir,
  titre,
  detail,
  image,
  desactive = false,
  children,
}: {
  nom: string;
  valeur: V;
  coche: boolean;
  onChoisir: (valeur: V) => void;
  titre: ReactNode;
  detail?: ReactNode;
  /** Illustration au-dessus du titre : la carte devient visuelle. */
  image?: ReactNode;
  desactive?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className={image ? "lme-choix lme-choix--visuel" : "lme-choix"} data-coche={coche ? "" : undefined}>
      <input
        type="radio"
        className="lme-sr"
        name={nom}
        value={valeur}
        checked={coche}
        disabled={desactive}
        onChange={() => onChoisir(valeur)}
      />
      {image}
      <span className="lme-choix__titre">{titre}</span>
      {detail ? <span className="lme-choix__detail">{detail}</span> : null}
      {children}
    </label>
  );
}

export function Segment<V extends string>({
  nom,
  valeur,
  coche,
  onChoisir,
  desactive = false,
  children,
}: {
  nom: string;
  valeur: V;
  coche: boolean;
  onChoisir: (valeur: V) => void;
  desactive?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="lme-segment" data-coche={coche ? "" : undefined}>
      <input
        type="radio"
        className="lme-sr"
        name={nom}
        value={valeur}
        checked={coche}
        disabled={desactive}
        onChange={() => onChoisir(valeur)}
      />
      {children}
    </label>
  );
}
