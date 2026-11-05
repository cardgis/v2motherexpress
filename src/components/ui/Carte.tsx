import type { ReactNode } from "react";

/** Bloc de contenu blanc, avec titre, description et actions facultatifs. */
export function Carte({
  titre,
  description,
  actions,
  niveau = 2,
  accent = false,
  id,
  className,
  children,
}: {
  titre?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Niveau du titre dans la hiérarchie de la page. */
  niveau?: 2 | 3;
  /** Liseré doré : la carte porte l'action attendue. */
  accent?: boolean;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  const Titre = niveau === 3 ? "h3" : "h2";

  return (
    <section
      id={id}
      className={["lme-carte", accent ? "lme-carte--accent" : null, className].filter(Boolean).join(" ")}
    >
      {titre || actions ? (
        <div className="lme-carte__entete">
          <div>
            {titre ? <Titre className="lme-carte__titre">{titre}</Titre> : null}
            {description ? <p className="lme-carte__description">{description}</p> : null}
          </div>
          {actions ? <div className="lme-rangee">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
