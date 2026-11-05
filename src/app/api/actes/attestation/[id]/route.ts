import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estEquipeDeLaBoutique, utilisateurCourant } from "@/lib/auth";
import { lireBlob } from "@/lib/storage";

/**
 * Relecture d'une attestation de versement — le reçu du client.
 *
 * La PRODUCTION reste côté gérant (`POST /api/gerant/versements/{id}/attestation`) :
 * c'est lui qui encaisse. La lecture, elle, suit les mêmes règles que le
 * contrat — le client, l'équipe de sa boutique, l'administrateur — puisque
 * c'est SA preuve de paiement, et qu'il l'ouvre depuis son propre espace.
 *
 * `id` est celui de l'ENCAISSEMENT : un reçu par versement.
 */

type Contexte = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexte) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { id } = await params;

  const versement = await prisma.encaissement.findUnique({
    where: { id },
    select: {
      recuRef: true,
      recuPdfPath: true,
      reservation: {
        select: {
          boutiqueId: true,
          customer: { select: { userId: true } },
          contract: { select: { id: true } },
        },
      },
    },
  });

  // Hors droits : traité comme inexistant, comme partout ailleurs.
  const autorise =
    versement &&
    (versement.reservation.customer.userId === user.id ||
      estEquipeDeLaBoutique(user, versement.reservation.boutiqueId) ||
      user.role === "ADMIN");

  if (!autorise) return NextResponse.json({ error: "Attestation introuvable." }, { status: 404 });

  if (!versement.recuPdfPath) {
    return NextResponse.json(
      { error: "Cette attestation n'a pas encore été établie." },
      { status: 409 },
    );
  }

  try {
    const blob = await lireBlob(versement.recuPdfPath);

    // Journalisé comme le contrat : un reçu contesté se prouve par la trace
    // de sa remise autant que par son contenu.
    if (versement.reservation.contract) {
      await prisma.contractEvent.create({
        data: {
          contractId: versement.reservation.contract.id,
          type: "TELECHARGE",
          acteurUserId: user.id,
          metadata: { role: user.role, acte: "ATTESTATION", recuRef: versement.recuRef },
        },
      });
    }

    return new NextResponse(Buffer.from(blob.octets), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(blob.octets.byteLength),
        "Content-Disposition": `inline; filename="attestation-${versement.recuRef ?? id}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[actes/attestation]", error);
    return NextResponse.json({ error: "Attestation illisible." }, { status: 500 });
  }
}
