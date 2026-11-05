import { NextResponse } from "next/server";
import { exigerAdminApi } from "@/lib/auth";
import { adresseIp } from "@/lib/requete";
import { creerBoutique, schemaBoutique } from "@/lib/admin/boutiques";
import { refusAcces, refusSaisie, reponseErreur } from "@/lib/admin/api";

/** Ouverture d'une boutique : point de vente du catalogue et boutique, ensemble. */
export async function POST(request: Request) {
  const admin = await exigerAdminApi();
  if (!admin) return refusAcces();

  const analyse = schemaBoutique.safeParse(await request.json().catch(() => null));
  if (!analyse.success) return refusSaisie(analyse.error);

  try {
    const boutique = await creerBoutique(analyse.data);
    console.info(`[admin] boutique ${boutique.code} ouverte par ${admin.id} depuis ${adresseIp(request)}`);
    return NextResponse.json(boutique, { status: 201 });
  } catch (erreur) {
    return reponseErreur(erreur, "boutiques");
  }
}
