import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { creerReservation, ErreurReservation, schemaReservation } from "@/lib/reservation";

/** Enregistre une réservation pour le client connecté. */
export async function POST(request: Request) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  // Un gérant réserve depuis son back-office, pas depuis l'espace client :
  // sans ce garde-fou, il se créerait un dossier client à son propre nom.
  if (user.role !== "CLIENT") {
    return NextResponse.json(
      { error: "Les réservations en ligne sont réservées aux comptes clients." },
      { status: 403 },
    );
  }

  try {
    const analyse = schemaReservation.safeParse(await request.json().catch(() => ({})));
    if (!analyse.success) {
      return NextResponse.json(
        { error: analyse.error.issues[0]?.message ?? "Saisie invalide." },
        { status: 400 },
      );
    }

    const reservation = await creerReservation({ userId: user.id, saisie: analyse.data });

    // Le client enchaîne sur son dossier si celui-ci n'est pas complet.
    const destination =
      reservation.statut === "EN_ATTENTE_DOSSIER" ? "/compte/dossier" : "/compte";

    return NextResponse.json({ ...reservation, destination }, { status: 201 });
  } catch (error) {
    if (error instanceof ErreurReservation) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[reservations]", error);
    return NextResponse.json({ error: "Réservation impossible." }, { status: 500 });
  }
}
