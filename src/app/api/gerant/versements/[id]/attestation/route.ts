import { NextResponse } from "next/server";
import { exigerGerantApi } from "@/lib/auth";
import { genererAttestation, ErreurVersement } from "@/lib/versements";
import { adresseIp } from "@/lib/requete";

/**
 * Production de l'attestation de versement — le reçu remis au client.
 *
 * Réservée au gérant : c'est lui qui encaisse. La RELECTURE est ailleurs,
 * sur `GET /api/actes/attestation/{id}` : le client ouvre son reçu depuis son
 * propre espace, une adresse en `/api/gerant/` n'avait rien à y faire.
 */

type Contexte = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexte) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const resultat = await genererAttestation({ membre: gerant, encaissementId: id });

    console.info(
      `[versements] attestation ${resultat.recuRef} par ${gerant.id} depuis ${adresseIp(request)}`,
    );

    return NextResponse.json({ recuRef: resultat.recuRef, pages: resultat.pages });
  } catch (error) {
    if (error instanceof ErreurVersement) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[versements/attestation]", error);
    return NextResponse.json({ error: "Attestation impossible." }, { status: 500 });
  }
}
