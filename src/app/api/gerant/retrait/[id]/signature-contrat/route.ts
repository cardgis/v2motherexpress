import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estEquipeDeLaBoutique, utilisateurCourant } from "@/lib/auth";
import { lireBlob } from "@/lib/storage";
import type { RoleSignataire } from "@/generated/prisma";

/**
 * Tracé d'une signature déjà apposée sur le CONTRAT de cette réservation.
 *
 * Sert de référence visuelle au moment où le constat de remise est signé en
 * boutique : le gérant compare le tracé que le client fait devant lui à celui
 * du contrat. Une signature qui n'a rien à voir, ou deux signataires inversés
 * sur l'appareil, se voient alors immédiatement.
 *
 * Réservé à l'équipe de la boutique : ce n'est pas un document remis au client,
 * c'est un outil de contrôle interne.
 */

type Contexte = { params: Promise<{ id: string }> };

const ROLES: RoleSignataire[] = ["CLIENT", "GERANT"];

export async function GET(request: Request, { params }: Contexte) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { id } = await params;
  const role = new URL(request.url).searchParams.get("role") as RoleSignataire | null;

  if (!role || !ROLES.includes(role)) {
    return NextResponse.json({ error: "Signataire inconnu." }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: {
      boutiqueId: true,
      contract: { select: { signatures: { where: { role }, select: { imagePath: true } } } },
    },
  });

  // Hors périmètre : traité comme inexistant, comme partout ailleurs.
  if (
    !reservation ||
    (!estEquipeDeLaBoutique(user, reservation.boutiqueId) && user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Signature introuvable." }, { status: 404 });
  }

  const chemin = reservation.contract?.signatures[0]?.imagePath;
  if (!chemin) return NextResponse.json({ error: "Signature introuvable." }, { status: 404 });

  try {
    const blob = await lireBlob(chemin);

    return new NextResponse(Buffer.from(blob.octets), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(blob.octets.byteLength),
        // Une signature ne doit être conservée ni par un cache intermédiaire,
        // ni par le navigateur du gérant.
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[gerant/retrait/signature-contrat]", error);
    return NextResponse.json({ error: "Signature illisible." }, { status: 500 });
  }
}
