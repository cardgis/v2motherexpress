import { NextResponse } from "next/server";
import { exigerGerantApi } from "@/lib/auth";
import { annulerDossier, ErreurAnnulation } from "@/lib/annulation";
import { adresseIp } from "@/lib/requete";

/**
 * Actions de la boutique sur une réservation.
 *
 *   { action: "annuler", motif } annule le dossier et libère le véhicule
 *
 * Réservée au gérant et à l'administrateur : le client qui se désiste appelle
 * ou passe en boutique. `exigerGerantApi` refuse au passage le commercial, en
 * lecture seule.
 */

type Contexte = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexte) {
  const membre = await exigerGerantApi();
  if (!membre) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    if (String(body?.action ?? "") !== "annuler") {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    const resultat = await annulerDossier({
      membre,
      reservationId: id,
      motif: String(body?.motif ?? ""),
      ip: adresseIp(request),
    });

    return NextResponse.json({ statut: "ANNULEE", ...resultat });
  } catch (error) {
    if (error instanceof ErreurAnnulation) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[gerant/reservations/annuler]", error);
    return NextResponse.json({ error: "Annulation impossible." }, { status: 500 });
  }
}
