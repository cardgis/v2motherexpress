/**
 * Proxy Next.js (ex-middleware) — protection des API contre le CSRF.
 *
 * Les cookies de session sont déjà `SameSite=Lax`, ce qui bloque l'essentiel
 * des requêtes intersites. Ce contrôle ajoute une seconde barrière,
 * indépendante des navigateurs anciens : une requête qui MODIFIE quelque chose
 * doit venir de notre propre origine.
 *
 *   — `Sec-Fetch-Site` (posé par le navigateur, non falsifiable par une page
 *     tierce) doit valoir `same-origin` ;
 *   — à défaut, l'en-tête `Origin` doit désigner notre propre hôte.
 *
 * Un appel sans aucun de ces en-têtes (curl, tâche planifiée) n'est pas un
 * navigateur : il ne porte pas de cookie de victime et n'est pas concerné.
 *
 * L'autorisation elle-même reste faite dans chaque route : ce proxy ne lit
 * pas la session.
 */

import { NextResponse, type NextRequest } from "next/server";

const METHODES_SANS_EFFET = new Set(["GET", "HEAD", "OPTIONS"]);

function refus() {
  return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
}

export function proxy(request: NextRequest) {
  if (METHODES_SANS_EFFET.has(request.method)) return NextResponse.next();

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return refus();

  const origine = request.headers.get("origin");
  if (origine) {
    // Derrière un proxy, l'hôte public est dans x-forwarded-host.
    const hote = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
      .split(",")[0]!
      .trim();

    let hoteOrigine: string | null = null;
    try {
      hoteOrigine = new URL(origine).host;
    } catch {
      return refus();
    }
    if (!hote || hoteOrigine !== hote) return refus();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
