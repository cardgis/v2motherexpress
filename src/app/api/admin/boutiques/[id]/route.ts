import { NextResponse } from "next/server";
import { exigerAdminApi } from "@/lib/auth";
import { adresseIp } from "@/lib/requete";
import { modifierBoutique, schemaModificationBoutique } from "@/lib/admin/boutiques";
import { refusAcces, refusSaisie, reponseErreur } from "@/lib/admin/api";

type Contexte = { params: Promise<{ id: string }> };

/** Informations d'une boutique. Le code, imprimé dans les références, n'est pas modifiable. */
export async function PATCH(request: Request, { params }: Contexte) {
  const admin = await exigerAdminApi();
  if (!admin) return refusAcces();

  const analyse = schemaModificationBoutique.safeParse(await request.json().catch(() => null));
  if (!analyse.success) return refusSaisie(analyse.error);

  const { id } = await params;

  try {
    await modifierBoutique(id, analyse.data);
    console.info(`[admin] boutique ${id} modifiée par ${admin.id} depuis ${adresseIp(request)}`);
    return NextResponse.json({ ok: true });
  } catch (erreur) {
    return reponseErreur(erreur, "boutiques/:id");
  }
}
