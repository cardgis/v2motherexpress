import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Sonde de santé pour l'orchestrateur (Azure Container Apps, Kubernetes,
 * load balancer OVHcloud…). Il retire du trafic une instance qui répond 503
 * et la redémarre si besoin.
 *
 * Ne révèle rien : ni version, ni nom de base, ni message d'erreur.
 */

export const dynamic = "force-dynamic";

const DELAI_MS = 3_000;
const SANS_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
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
