import { NextResponse } from "next/server";
import { exigerAdminApi } from "@/lib/auth";
import { annulerVersement, ErreurVersement } from "@/lib/versements";
import { adresseIp } from "@/lib/requete";

/**
 * Annulation d'un versement — administrateur seul.
 *
 * Le gérant saisit ce qu'il encaisse ; il ne défait pas. Une ligne d'argent ne
 * disparaît jamais : elle est marquée annulée, avec son motif et le nom de qui
 * l'a décidé, et reste visible dans l'historique du dossier.
 */

type Contexte = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexte) {
  const admin = await exigerAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Accès réservé à l'administrateur." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    if (String(body?.action ?? "") !== "annuler") {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    const resultat = await annulerVersement({
      admin,
      encaissementId: id,
      motif: String(body?.motif ?? ""),
    });

    console.info(`[versements] annulation ${id} par ${admin.id} depuis ${adresseIp(request)}`);

    return NextResponse.json(resultat);
  } catch (error) {
    if (error instanceof ErreurVersement) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[admin/versements]", error);
    return NextResponse.json({ error: "Annulation impossible." }, { status: 500 });
  }
}
