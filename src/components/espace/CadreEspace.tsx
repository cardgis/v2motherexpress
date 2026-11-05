/**
 * Cadre commun des espaces connectés : en-tête, contenu, navigation basse.
 *
 * Rendu par les layouts `compte/(espace)` et `gerant` : il reste monté quand
 * on passe d'une page à l'autre du même espace, seul le contenu change.
 */

import type { ReactNode } from "react";
import "@/styles/espace.css";
import EnTeteEspace, { type IdentiteAffichee, type LienRaccourci } from "./EnTeteEspace";
import NavigationBasse from "./NavigationBasse";
import type { Espace } from "./navigation";

export default function CadreEspace({
  espace,
  titreEspace,
  identite,
  pastilles,
  raccourcis,
  children,
}: {
  espace: Espace;
  titreEspace: string;
  identite: IdentiteAffichee;
  pastilles?: Record<string, number>;
  raccourcis?: LienRaccourci[];
  children: ReactNode;
}) {
  return (
    <div className="lme-app" data-nav-basse="">
      <a href="#contenu" className="lme-evitement">
        Aller au contenu
      </a>
      <EnTeteEspace
        espace={espace}
        titreEspace={titreEspace}
        identite={identite}
        pastilles={pastilles}
        raccourcis={raccourcis}
      />
      <main id="contenu" className="lme-contenu" tabIndex={-1}>
        {children}
      </main>
      <NavigationBasse espace={espace} pastilles={pastilles} />
    </div>
  );
}

/** Initiales pour l'avatar, ou `null` quand on ne connaît pas encore le nom. */
export function initiales(prenom: string | null | undefined, nom: string | null | undefined): string | null {
  const lettres = [prenom, nom]
    .map((mot) => mot?.trim().charAt(0))
    .filter(Boolean)
    .join("");
  return lettres ? lettres.toUpperCase() : null;
}
