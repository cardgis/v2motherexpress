import { NextResponse } from "next/server";
import { exigerAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adresseIp } from "@/lib/requete";
import { lireTypeSuivi, resoudrePeriode } from "@/lib/admin/filtres";
import { chargerSuivi, LIMITE_EXPORT, suiviEnCsv } from "@/lib/admin/suivi";
import { refusAcces, reponseErreur } from "@/lib/admin/api";

/**
 * Export de la feuille de suivi, pour Excel ou LibreOffice.
 *
 * Contient des noms et des moyens de contact de clients : réservé à
 * l'administrateur, jamais mis en cache, et chaque export est journalisé.
 */
export async function GET(request: Request) {
  const admin = await exigerAdminApi();
  if (!admin) return refusAcces();

  const url = new URL(request.url);
  const periode = resoudrePeriode(url.searchParams.get("periode"));
  const type = lireTypeSuivi(url.searchParams.get("type"));
  const saisieBoutique = url.searchParams.get("boutique");

  try {
    const boutique = saisieBoutique
      ? await prisma.boutique.findUnique({ where: { id: saisieBoutique }, select: { id: true, code: true } })
      : null;

    const { lignes } = await chargerSuivi({ periode, boutiqueId: boutique?.id ?? null, type }, LIMITE_EXPORT);

    const jour = new Date().toISOString().slice(0, 10);
    const fichier = ["lme-suivi", boutique?.code.toLowerCase(), type, periode.code, jour].filter(Boolean).join("-");

    console.info(`[admin] export du suivi (${lignes.length} lignes) par ${admin.id} depuis ${adresseIp(request)}`);

    return new NextResponse(suiviEnCsv(lignes), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fichier}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (erreur) {
    return reponseErreur(erreur, "suivi");
  }
}
