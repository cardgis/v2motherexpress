"use client";

/**
 * Barre de navigation basse — téléphones uniquement (masquée en CSS au-delà).
 *
 * À portée de pouce, c'est elle que le gérant utilise en boutique, le
 * téléphone dans une main. Fixe en bas d'écran : le contenu réserve sa
 * hauteur en marge basse (`.lme-contenu`), rien ne passe dessous.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { NAVIGATION, estActif, type Espace } from "./navigation";

export default function NavigationBasse({
  espace,
  pastilles = {},
}: {
  espace: Espace;
  pastilles?: Record<string, number>;
}) {
  const chemin = usePathname();
  const liens = NAVIGATION[espace];

  return (
    <nav aria-label="Navigation principale">
      <ul className="lme-nav-basse" style={{ "--lme-nb-liens": liens.length } as CSSProperties}>
        {liens.map((lien) => {
          const actif = estActif(lien, chemin);
          const compteur = pastilles[lien.href] ?? 0;
          return (
            <li key={lien.href}>
              <Link href={lien.href} className="lme-nav-basse__lien" aria-current={actif ? "page" : undefined}>
                <lien.Icone size={22} aria-hidden />
                {lien.libelleCourt ?? lien.libelle}
                {compteur > 0 ? (
                  <span className="lme-pastille">
                    {compteur}
                    <span className="lme-sr"> en attente</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
