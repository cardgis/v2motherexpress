import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { manqueAuStockage } from "@/lib/storage";

/**
 * Sonde de santé pour l'orchestrateur (Vercel, Azure Container Apps, load
 * balancer OVHcloud…). Il retire du trafic une instance qui répond 503.
 *
 * Elle vérifie DEUX choses, et la seconde a été ajoutée le 2026-11-05 : la
 * base, et la configuration du stockage. Une sonde qui ne contrôlait que la
 * base déclarait le service sain alors qu'aucune pièce d'identité ne pouvait
 * être téléversée — panne qui ne se découvrait que chez un gérant, pendant un
 * retrait, avec un client en face.
 *
 * Le stockage est vérifié SANS appel réseau : on contrôle que les variables du
 * driver configuré sont présentes. Éprouver l'aller-retour supposerait
 * d'écrire à chaque appel, sur un point d'entrée public — inacceptable.
 *
 * Ne révèle rien : ni version, ni nom de base, ni variable manquante. Le nom
 * de la variable va dans les journaux, où seul l'exploitant le lit.
 */

export const dynamic = "force-dynamic";

const DELAI_MS = 3_000;
const SANS_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  const manquante = manqueAuStockage();
  if (manquante) {
    console.error(`[sante] stockage non configuré : ${manquante}`);
    return NextResponse.json({ statut: "indisponible" }, { status: 503, headers: SANS_CACHE });
  }

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("délai dépassé")), DELAI_MS)),
    ]);
    return NextResponse.json({ statut: "ok" }, { headers: SANS_CACHE });
  } catch (error) {
    console.error("[sante] base de données injoignable", error);
    return NextResponse.json({ statut: "indisponible" }, { status: 503, headers: SANS_CACHE });
  }
}
