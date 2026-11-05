import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estEquipeDeLaBoutique, utilisateurCourant, type Utilisateur } from "@/lib/auth";
import { lireBlob, supprimerBlob } from "@/lib/storage";

/**
 * Lecture et suppression d'une pièce justificative.
 *
 * ── Le point de contrôle du dispositif ─────────────────────────────────────
 * Aucune URL de stockage n'est jamais publiée. C'est ici, et uniquement ici,
 * qu'une carte d'identité peut être lue — après vérification que le demandeur
 * y a droit. Trois cas seulement :
 *   — le client propriétaire de la pièce ;
 *   — le gérant ou le commercial d'une boutique où ce client a une réservation ;
 *   — un administrateur.
 *
 * Un gérant de Mbour ne voit donc pas les pièces d'un dossier de Thiès.
 */

type Contexte = { params: Promise<{ id: string }> };

async function chargerAutorise(id: string, user: Utilisateur) {
  const document = await prisma.customerDocument.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          userId: true,
          reservations: { select: { boutiqueId: true } },
        },
      },
    },
  });

  if (!document) return { document: null, autorise: false, proprietaire: false };

  const proprietaire = document.customer.userId === user.id;

  const equipeHabilitee = document.customer.reservations.some((r) => estEquipeDeLaBoutique(user, r.boutiqueId));

  const autorise = proprietaire || equipeHabilitee || user.role === "ADMIN";

  return { document, autorise, proprietaire };
}

export async function GET(request: Request, { params }: Contexte) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { id } = await params;
  const { document, autorise } = await chargerAutorise(id, user);

  // Même réponse qu'une pièce inexistante : on ne révèle pas qu'un document
  // existe à quelqu'un qui n'a pas le droit de le voir.
  if (!document || !autorise) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  if (document.purgeAt) {
    return NextResponse.json({ error: "Ce document a été supprimé." }, { status: 410 });
  }

  try {
    const blob = await lireBlob(document.blobPath);

    return new NextResponse(Buffer.from(blob.octets), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(blob.octets.byteLength),
        "Content-Disposition": `inline; filename="${document.type.toLowerCase()}"`,
        // Une pièce d'identité ne doit être conservée ni par un cache
        // intermédiaire, ni par le navigateur.
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[documents/:id] lecture", error);
    return NextResponse.json({ error: "Document illisible." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Contexte) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { id } = await params;
  const { document, proprietaire } = await chargerAutorise(id, user);

  // Seul le client retire ses propres pièces ; un gérant rejette un dossier,
  // il n'en supprime pas les documents.
  if (!document || !proprietaire) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: document.customerId },
    select: { statutKyc: true },
  });

  // Dès que le gérant a le dossier sous les yeux, les pièces sont figées :
  // retirer une pièce en cours de vérification romprait le lien entre ce qu'il
  // examine et ce qu'il valide.
  if (customer.statutKyc === "VALIDE" || customer.statutKyc === "A_VERIFIER") {
    return NextResponse.json(
      { error: "Votre dossier est en vérification ou validé : les pièces ne peuvent plus être modifiées." },
      { status: 409 },
    );
  }

  await prisma.customerDocument.delete({ where: { id } });
  await supprimerBlob(document.blobPath).catch((e) =>
    console.error("[documents/:id] blob non supprimé", e),
  );

  return NextResponse.json({ ok: true });
}
