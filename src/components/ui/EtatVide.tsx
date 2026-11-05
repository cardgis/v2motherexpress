import type { ReactNode } from "react";

/** Liste vide : dit ce qui manque, et propose l'action qui la remplit. */
export function EtatVide({
  icone,
  titre,
  children,
  action,
}: {
  icone?: ReactNode;
  titre: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="lme-vide">
      {icone}
      <p className="lme-vide__titre">{titre}</p>
      {children ? <p className="lme-petit">{children}</p> : null}
      {action}
    </div>
  );
}
