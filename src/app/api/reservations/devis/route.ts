import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { calculerDevis, ErreurReservation, schemaReservation } from "@/lib/reservation";

/**
 * Chiffre une réservation sans rien enregistrer.
 *
 * Le formulaire appelle cette route à chaque changement pour afficher le
 * montant en direct. Elle emprunte le même chemin de calcul que la création :
 * le prix affiché ne peut donc pas différer du prix enregistré.
 */
export async function POST(request: Request) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  try {
    const analyse = schemaReservation.safeParse(await request.json().catch(() => ({})));
    if (!analyse.success) {
      return NextResponse.json(
        { error: analyse.error.issues[0]?.message ?? "Saisie invalide." },
        { status: 400 },
      );
    }

    return NextResponse.json(await calculerDevis(analyse.data));
  } catch (error) {
    if (error instanceof ErreurReservation) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[reservations/devis]", error);
    return NextResponse.json({ error: "Calcul impossible." }, { status: 500 });
  }
}
