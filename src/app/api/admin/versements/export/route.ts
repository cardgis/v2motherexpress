import { NextResponse } from "next/server";
import { exigerAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adresseIp } from "@/lib/requete";
import { resoudrePeriode } from "@/lib/admin/filtres";
import {
  chargerEtatVersements,
  lireFiltreVersements,
  LIMITE_EXPORT,
  versementsEnCsv,
} from "@/lib/admin/versements";
import { refusAcces, reponseErreur } from "@/lib/admin/api";

/**
 * Export de l'état des versements, pour Excel ou LibreOffice.
 *
 * Contient des noms, des contacts et des montants : réservé à l'administrateur,
 * jamais mis en cache, et chaque export est journalisé.
 */
export async function GET(request: Request) {
  const admin = await exigerAdminApi();
  if (!admin) return refusAcces();

  const url = new URL(request.url);
  const periode = resoudrePeriode(url.searchParams.get("periode"));
  const filtre = lireFiltreVersements(url.searchParams.get("filtre"));
  const saisieBoutique = url.searchParams.get("boutique");

  try {
    const boutique = saisieBoutique
      ? await prisma.boutique.findUnique({ where: { id: saisieBoutique }, select: { id: true, code: true } })
      : null;

    const { lignes } = await chargerEtatVersements(
      { periode, boutiqueId: boutique?.id ?? null, filtre },
      LIMITE_EXPORT,
    );

    const jour = new Date().toISOString().slice(0, 10);
    const fichier = ["lme-versements", boutique?.code.toLowerCase(), filtre, periode.code, jour]
      .filter(Boolean)
      .join("-");

    console.info(
      `[admin] export des versements (${lignes.length} lignes) par ${admin.id} depuis ${adresseIp(request)}`,
    );

    return new NextResponse(versementsEnCsv(lignes), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fichier}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (erreur) {
    return reponseErreur(erreur, "versements");
  }
}
