import { NextResponse } from "next/server";
import { contratParJeton, ErreurSignature, journaliser } from "@/lib/contrats/signature";
import { lireBlob } from "@/lib/storage";
import { adresseIp, userAgent } from "@/lib/requete";

/**
 * Lecture du contrat depuis le lien de signature, sans session.
 *
 * Le jeton vaut authentification : le lien arrive par WhatsApp sur un
 * téléphone où la session a souvent expiré, et exiger une reconnexion avant
 * même de pouvoir lire l'acte ferait abandonner le client.
 *
 * L'ouverture est journalisée — la piste d'audit doit pouvoir établir que le
 * document a bien été mis à disposition avant d'être signé.
 */

type Contexte = { params: Promise<{ jeton: string }> };

export async function GET(request: Request, { params }: Contexte) {
  const { jeton } = await params;

  try {
    const contrat = await contratParJeton(jeton);
    if (!contrat.pdfDraftPath) {
      return NextResponse.json({ error: "Contrat introuvable." }, { status: 404 });
    }

    const blob = await lireBlob(contrat.pdfDraftPath);

    await journaliser(contrat.id, "OUVERT", {
      acteurUserId: contrat.reservation.customer.userId,
      ip: adresseIp(request),
      userAgent: userAgent(request),
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
    if (error instanceof ErreurSignature) {
      return NextResponse.json({ error: error.message }, { status: 410 });
    }
    console.error("[signature/:jeton/pdf]", error);
    return NextResponse.json({ error: "Contrat illisible." }, { status: 500 });
  }
}
