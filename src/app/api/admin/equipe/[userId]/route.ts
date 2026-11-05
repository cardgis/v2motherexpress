import { NextResponse } from "next/server";
import { exigerAdminApi } from "@/lib/auth";
import { adresseIp } from "@/lib/requete";
import { retirerMembre } from "@/lib/admin/boutiques";
import { refusAcces, reponseErreur } from "@/lib/admin/api";

type Contexte = { params: Promise<{ userId: string }> };

/** Retire un membre de son équipe : il redevient client, ses sessions sont révoquées. */
export async function DELETE(request: Request, { params }: Contexte) {
  const admin = await exigerAdminApi();
  if (!admin) return refusAcces();

  const { userId } = await params;

  try {
    await retirerMembre(userId);
    console.info(`[admin] membre ${userId} retiré par ${admin.id} depuis ${adresseIp(request)}`);
    return NextResponse.json({ ok: true });
  } catch (erreur) {
    return reponseErreur(erreur, "equipe/:id");
  }
}
