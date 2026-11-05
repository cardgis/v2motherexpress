import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estEquipeDeLaBoutique, utilisateurCourant } from "@/lib/auth";
import { lireBlob } from "@/lib/storage";

/**
 * Téléchargement du constat de remise.
 *
 * Accessible au client comme au gérant de la boutique : c'est la pièce qui
 * protège les deux parties, chacune doit pouvoir la produire.
 *
 * D'où `/api/actes/` et non `/api/gerant/…` : le client ouvre ce document
 * depuis son propre espace, et l'adresse d'une de ses pièces n'a pas à lui
 * donner l'impression de regarder par-dessus l'épaule du back-office.
 *
 * `id` est celui de la RÉSERVATION : un dossier n'a qu'un constat de remise.
 */

type Contexte = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexte) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: {
      reference: true,
      boutiqueId: true,
      customer: { select: { userId: true } },
      contract: { select: { id: true } },
      handover: { select: { pvPdfPath: true } },
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Constat introuvable." }, { status: 404 });
  }

  const proprietaire = reservation.customer.userId === user.id;
  const equipeHabilitee = estEquipeDeLaBoutique(user, reservation.boutiqueId);

  // Hors droits : traité comme inexistant, on ne révèle pas son existence.
  if (!proprietaire && !equipeHabilitee && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Constat introuvable." }, { status: 404 });
  }

  const chemin = reservation.handover?.pvPdfPath;
  if (!chemin) {
    return NextResponse.json({ error: "Le constat n'a pas encore été établi." }, { status: 409 });
  }

  try {
    const blob = await lireBlob(chemin);

    // Journalisé comme le contrat : la spécification exige de pouvoir prouver
    // que le client a bien eu accès à ses actes, pas seulement au premier.
    if (reservation.contract) {
      await prisma.contractEvent.create({
        data: {
          contractId: reservation.contract.id,
          type: "TELECHARGE",
          acteurUserId: user.id,
          metadata: { role: user.role, acte: "CONSTAT" },
        },
      });
    }

    return new NextResponse(Buffer.from(blob.octets), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(blob.octets.byteLength),
        "Content-Disposition": `inline; filename="constat-remise-${reservation.reference}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[actes/constat]", error);
    return NextResponse.json({ error: "Constat illisible." }, { status: 500 });
  }
}
