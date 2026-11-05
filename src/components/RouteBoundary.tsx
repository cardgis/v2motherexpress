"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Force le remontage du contenu à chaque changement de page du site vitrine,
 * dont les widgets jQuery/UIkit ne survivent pas à une navigation SPA (voir
 * CLAUDE.md).
 *
 * Les espaces client et gérant, eux, sont entièrement pilotés par l'état
 * React : les remonter à chaque page ferait clignoter leur en-tête et perdre
 * l'état du cadre. Leur clé est donc stable au sein d'un même espace.
 */
function cle(pathname: string): string {
  const espace = /^\/(compte|gerant|admin)(\/|$)/.exec(pathname)?.[1];
  return espace ? `espace-${espace}` : pathname;
}

export default function RouteBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <Fragment key={cle(pathname)}>{children}</Fragment>;
}
