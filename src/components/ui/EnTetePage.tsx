/**
 * En-tête de page : fil d'Ariane, surtitre, titre, badge, actions.
 *
 * Sur ordinateur, le fil d'Ariane montre tout le chemin ; sur mobile, il se
 * réduit à un retour vers la page parente (« ‹ Dossiers »), seul utile au
 * pouce et qui tient sur une ligne.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ElementFil {
  libelle: string;
  href: string;
}

export function EnTetePage({
  fil,
  surtitre,
  titre,
  description,
  badge,
  actions,
}: {
  /** Pages parentes, de la plus haute à la plus proche. */
  fil?: ElementFil[];
  surtitre?: ReactNode;
  titre: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="lme-entete-page">
      <div className="lme-entete-page__texte">
        {fil && fil.length > 0 ? (
          <nav aria-label="Fil d’Ariane">
            <ol className="lme-fil">
              {fil.map((element, i) => {
                const parent = i === fil.length - 1;
                return (
                  <li key={element.href} className={parent ? "lme-fil__parent" : undefined}>
                    <Link href={element.href}>
                      {parent ? <ChevronLeft size={16} className="lme-fil__retour" aria-hidden /> : null}
                      {element.libelle}
                    </Link>
                    <ChevronRight size={14} className="lme-fil__sep" aria-hidden />
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        {surtitre ? <p className="lme-surtitre">{surtitre}</p> : null}

        <div className="lme-rangee" style={{ gap: "8px 14px" }}>
          <h1 className="lme-titre-page">{titre}</h1>
          {badge}
        </div>

        {description ? <p className="lme-description">{description}</p> : null}
      </div>

      {actions ? <div className="lme-entete-page__actions">{actions}</div> : null}
    </div>
  );
}
