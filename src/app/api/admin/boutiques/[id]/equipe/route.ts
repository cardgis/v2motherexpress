import { NextResponse } from "next/server";
import { exigerAdminApi } from "@/lib/auth";
import { adresseIp } from "@/lib/requete";
import { nommerMembre, schemaMembre } from "@/lib/admin/boutiques";
import { refusAcces, refusSaisie, reponseErreur } from "@/lib/admin/api";

type Contexte = { params: Promise<{ id: string }> };

/** Nomme un gérant ou un commercial dans la boutique, ou change son rôle. */
export async function POST(request: Request, { params }: Contexte) {
  const admin = await exigerAdminApi();
  if (!admin) return refusAcces();

  const analyse = schemaMembre.safeParse(await request.json().catch(() => null));
  if (!analyse.success) return refusSaisie(analyse.error);

  const { id } = await params;

  try {
    const membre = await nommerMembre(id, analyse.data);
    console.info(`[admin] ${membre.role} ${membre.id} nommé dans ${id} par ${admin.id} depuis ${adresseIp(request)}`);
    return NextResponse.json(membre, { status: 201 });
  } catch (erreur) {
    return reponseErreur(erreur, "equipe");
  }
}
