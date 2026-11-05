import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estEquipeDeLaBoutique, utilisateurCourant } from "@/lib/auth";
import { lireBlob } from "@/lib/storage";

/**
 * Téléchargement du constat de restitution.
 *
 * Mêmes droits que le constat de remise : le client, l'équipe de sa boutique,
 * l'administrateur. C'est la pièce qui arrête l'état du véhicule au retour et
 * les sommes qui en découlent — le client doit pouvoir la produire autant que
 * la boutique.
 *
 * `id` est celui de la RÉSERVATION : un dossier n'a qu'une restitution.
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
      restitution: { select: { pvPdfPath: true } },
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

  const chemin = reservation.restitution?.pvPdfPath;
  if (!chemin) {
    return NextResponse.json(
      { error: "Le constat de restitution n'a pas encore été établi." },
      { status: 409 },
    );
  }

  try {
    const blob = await lireBlob(chemin);

    if (reservation.contract) {
      await prisma.contractEvent.create({
        data: {
          contractId: reservation.contract.id,
          type: "TELECHARGE",
          acteurUserId: user.id,
          metadata: { role: user.role, acte: "RESTITUTION" },
        },
      });
    }

    return new NextResponse(Buffer.from(blob.octets), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(blob.octets.byteLength),
        "Content-Disposition": `inline; filename="constat-restitution-${reservation.reference}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[actes/restitution]", error);
    return NextResponse.json({ error: "Constat illisible." }, { status: 500 });
  }
}
