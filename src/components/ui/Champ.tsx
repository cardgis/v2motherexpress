"use client";

/**
 * Champ de formulaire : libellé, saisie, aide et message d'état.
 *
 * Relie automatiquement le libellé à la saisie (`htmlFor`/`id`) et le message
 * à la saisie (`aria-describedby`), et pose `aria-invalid` en cas d'erreur :
 * c'est cet attribut qui colore la bordure en rouge, si bien que l'état visuel
 * et l'état annoncé aux lecteurs d'écran ne peuvent pas diverger.
 *
 * États, dans l'ordre de priorité :
 *   erreur    rouge, icône d'alerte, message annoncé
 *   succes    vert, coche — la valeur a été contrôlée et acceptée
 *   verrou    gris, cadenas — la valeur existe mais ne se modifie plus ici
 *   aide      texte d'accompagnement neutre, toujours affiché
 */

import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Lock } from "lucide-react";

interface ProprietesSaisie {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  "data-etat"?: string;
}

export function Champ({
  libelle,
  requis = false,
  facultatif = false,
  aide,
  erreur,
  succes,
  verrou,
  large = false,
  id,
  children,
}: {
  libelle: ReactNode;
  requis?: boolean;
  facultatif?: boolean;
  aide?: ReactNode;
  erreur?: string | null;
  succes?: ReactNode;
  /** Raison pour laquelle la valeur n'est plus modifiable. */
  verrou?: ReactNode;
  /** Occupe toute la ligne dans une grille de champs. */
  large?: boolean;
  id?: string;
  children: ReactElement<ProprietesSaisie>;
}) {
  const genere = useId();
  const idChamp = id ?? children.props.id ?? `champ${genere.replace(/[^a-zA-Z0-9]/g, "")}`;
  const idAide = `${idChamp}-aide`;
  const idMessage = `${idChamp}-message`;

  const message: { classe: string; icone: ReactNode; texte: ReactNode; role?: "alert" } | null = erreur
    ? { classe: "lme-message lme-message--erreur", icone: <CircleAlert size={16} aria-hidden />, texte: erreur, role: "alert" }
    : succes
      ? { classe: "lme-message lme-message--succes", icone: <CircleCheck size={16} aria-hidden />, texte: succes }
      : verrou
        ? { classe: "lme-message", icone: <Lock size={14} aria-hidden />, texte: verrou }
        : null;

  const decrit = [message ? idMessage : null, aide ? idAide : null].filter(Boolean).join(" ");

  const saisie = cloneElement(children, {
    id: idChamp,
    className: ["lme-saisie", children.props.className].filter(Boolean).join(" "),
    "aria-invalid": erreur ? true : undefined,
    "aria-describedby": decrit || undefined,
    "aria-required": requis || undefined,
    "data-etat": !erreur && succes ? "valide" : children.props["data-etat"],
  });

  return (
    <div className={large ? "lme-champ lme-champ--large" : "lme-champ"}>
      <label htmlFor={idChamp} className="lme-libelle">
        {libelle}
        {requis ? (
          <span className="lme-requis" aria-hidden>
            *
          </span>
        ) : null}
        {facultatif ? <span className="lme-facultatif">facultatif</span> : null}
      </label>

      {saisie}

      {message ? (
        <p id={idMessage} className={message.classe} role={message.role}>
          {message.icone}
          {message.texte}
        </p>
      ) : null}

      {aide ? (
        <p id={idAide} className="lme-aide">
          {aide}
        </p>
      ) : null}
    </div>
  );
}
