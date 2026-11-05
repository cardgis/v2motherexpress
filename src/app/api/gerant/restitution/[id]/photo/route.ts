import { NextResponse } from "next/server";
import { exigerGerantApi } from "@/lib/auth";
import { ajouterPhotoRestitution, ErreurRestitution } from "@/lib/restitution";
import { ANGLES_ATTENDUS } from "@/lib/retrait";
import { typeReel, type TypeFichier } from "@/lib/fichiers";
import type { AngleHandover } from "@/generated/prisma";

/**
 * Photos de l'état des lieux de sortie.
 *
 * Mêmes angles que la remise : c'est la comparaison des deux séries qui prouve
 * une dégradation, elle exige les mêmes points de vue. Compression côté
 * navigateur avant l'envoi, le plafond ci-dessous n'est qu'un garde-fou.
 */

const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;
const FORMATS_ACCEPTES: TypeFichier[] = ["image/jpeg", "image/png", "image/webp"];

type Contexte = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexte) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  if (Number(request.headers.get("content-length") ?? 0) > TAILLE_MAX_OCTETS + 64 * 1024) {
    return NextResponse.json({ error: "Photo trop lourde." }, { status: 413 });
  }

  const { id } = await params;

  try {
    const formulaire = await request.formData();
    const fichier = formulaire.get("photo");
    const angle = String(formulaire.get("angle") ?? "") as AngleHandover;

    if (!(fichier instanceof File)) {
      return NextResponse.json({ error: "Photo manquante." }, { status: 400 });
    }
    if (!ANGLES_ATTENDUS.includes(angle)) {
      return NextResponse.json({ error: "Angle de prise de vue inconnu." }, { status: 400 });
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      return NextResponse.json(
        { error: "Photo trop lourde. Reprenez-la en qualité moindre." },
        { status: 413 },
      );
    }

    const octets = new Uint8Array(await fichier.arrayBuffer());
    const mimeType = typeReel(octets);
    if (!mimeType || !FORMATS_ACCEPTES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Format non accepté. Utilisez JPEG, PNG ou WebP." },
        { status: 415 },
      );
    }

    const resultat = await ajouterPhotoRestitution({
      gerant,
      reservationId: id,
      angle,
      octets,
      mimeType,
    });

    return NextResponse.json({ angle: resultat.angle });
  } catch (error) {
    if (error instanceof ErreurRestitution) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[gerant/restitution/photo]", error);
    return NextResponse.json({ error: "Envoi de la photo impossible." }, { status: 500 });
  }
}
