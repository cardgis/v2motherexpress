import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estEquipeDeLaBoutique, utilisateurCourant } from "@/lib/auth";
import { lireBlob } from "@/lib/storage";

/**
 * Téléchargement d'un contrat.
 *
 * Comme pour les pièces d'identité, aucune URL de stockage n'est publiée :
 * le fichier ne sort que par cette route, après contrôle des droits. Chaque
 * téléchargement est journalisé — la spécification exige de pouvoir prouver
 * que le client a bien eu accès à son acte.
 */

type Contexte = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Contexte) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { id } = await params;

  const contrat = await prisma.contract.findUnique({
    where: { id },
    include: {
      reservation: {
        select: { boutiqueId: true, customer: { select: { userId: true } } },
      },
    },
  });

  if (!contrat) return NextResponse.json({ error: "Contrat introuvable." }, { status: 404 });

  const proprietaire = contrat.reservation.customer.userId === user.id;
  const equipeHabilitee = estEquipeDeLaBoutique(user, contrat.reservation.boutiqueId);
  const autorise = proprietaire || equipeHabilitee || user.role === "ADMIN";

  // On ne révèle pas l'existence d'un contrat à qui n'a pas le droit de le lire.
  if (!autorise) return NextResponse.json({ error: "Contrat introuvable." }, { status: 404 });

  // Le PDF signé prime sur le brouillon dès qu'il existe.
  const chemin = contrat.pdfSignedPath ?? contrat.pdfDraftPath;
  if (!chemin) {
    return NextResponse.json({ error: "Ce contrat n'a pas encore été établi." }, { status: 409 });
  }

  try {
    const blob = await lireBlob(chemin);

    await prisma.contractEvent.create({
      data: {
        contractId: contrat.id,
        type: "TELECHARGE",
        acteurUserId: user.id,
        metadata: { role: user.role, acte: "CONTRAT", signe: contrat.pdfSignedPath !== null },
      },
    });

    return new NextResponse(Buffer.from(blob.octets), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(blob.octets.byteLength),
        "Content-Disposition": `inline; filename="${contrat.reference}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[contrats/:id/pdf]", error);
    return NextResponse.json({ error: "Contrat illisible." }, { status: 500 });
  }
}
