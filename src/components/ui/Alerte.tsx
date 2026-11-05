/**
 * Message d'état sur fond coloré. L'icône double toujours la couleur.
 *
 * `vivante` : à activer pour un message qui APPARAÎT suite à une action
 * (erreur d'envoi, confirmation), afin qu'il soit annoncé par les lecteurs
 * d'écran. Un bandeau affiché dès le chargement n'en a pas besoin.
 */

import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { Ton } from "@/lib/statuts";

const ICONES = {
  info: Info,
  succes: CircleCheck,
  attention: TriangleAlert,
  erreur: CircleAlert,
  neutre: Info,
} as const;

export function Alerte({
  ton = "info",
  titre,
  icone,
  children,
  actions,
  vivante = false,
  className,
}: {
  ton?: Ton;
  titre?: ReactNode;
  /** Remplace l'icône du ton quand le sens est plus précis (cadenas, horloge…). */
  icone?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  vivante?: boolean;
  className?: string;
}) {
  const Icone = ICONES[ton];
  const role = vivante ? (ton === "erreur" ? "alert" : "status") : undefined;

  return (
    <div className={["lme-alerte", `lme-alerte--${ton}`, className].filter(Boolean).join(" ")} role={role}>
      {icone ?? <Icone size={20} aria-hidden />}
      <div className="lme-alerte__corps">
        {titre ? <strong className="lme-alerte__titre">{titre}</strong> : null}
        {children ? <div>{children}</div> : null}
        {actions ? <div className="lme-alerte__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
