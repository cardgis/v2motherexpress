import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigerGerantApi } from "@/lib/auth";
import { apposerSignature, creerJetonSignature, ErreurSignature } from "@/lib/contrats/signature";
import { ErreurGeneration, transmettreAuClient } from "@/lib/contrats";
import { decoderTracePng } from "@/lib/fichiers";
import { adresseIp, userAgent } from "@/lib/requete";

/**
 * Actions du gérant sur un contrat : transmission au client, émission du lien
 * de signature, et contre-signature une fois le client passé.
 *
 * Le cloisonnement par boutique est vérifié ici : un gérant ne peut agir que
 * sur les contrats de sa propre boutique.
 */

type Contexte = { params: Promise<{ id: string }> };

function lienSignature(jeton: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/signer/${jeton}`;
}

export async function POST(request: Request, { params }: Contexte) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  const { id } = await params;

  const contrat = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, statut: true, reservation: { select: { boutiqueId: true } } },
  });

  // Hors périmètre : traité comme inexistant, sans le dire.
  if (
    !contrat ||
    (gerant.role !== "ADMIN" && contrat.reservation.boutiqueId !== gerant.boutiqueId)
  ) {
    return NextResponse.json({ error: "Contrat introuvable." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    // ── Mise à disposition du client ───────────────────────────────────────
    //
    // Tant que le gérant n'a pas fait ce geste, le contrat reste un brouillon
    // qu'il est seul à voir. Le lien de signature est produit dans la foulée :
    // transmettre et donner le moyen de signer sont la même intention.
    if (action === "transmettre") {
      const resultat = await transmettreAuClient(contrat.id, gerant.id);
      const jeton = await creerJetonSignature(contrat.id);

      return NextResponse.json({
        statut: resultat.statut,
        dejaTransmis: resultat.dejaTransmis,
        lien: lienSignature(jeton),
        expireDans: "72 heures",
      });
    }

    // ── Nouveau lien de signature, quand le précédent a expiré ─────────────
    //
    // Le lien complet n'existe qu'ici : seul son condensat est conservé. La
    // spécification interdit d'envoyer le PDF en pièce jointe — c'est ce lien
    // qui part par WhatsApp, et son ouverture est tracée.
    if (action === "lien") {
      const jeton = await creerJetonSignature(contrat.id);
      return NextResponse.json({ lien: lienSignature(jeton), expireDans: "72 heures" });
    }

    // ── Contre-signature ───────────────────────────────────────────────────
    if (action === "contresigner") {
      const trace = decoderTracePng(body?.trace);
      if (!trace.ok) return NextResponse.json({ error: trace.erreur }, { status: 400 });

      const resultat = await apposerSignature({
        contractId: contrat.id,
        role: "GERANT",
        signataireUserId: gerant.id,
        signataireNom: gerant.nomAffichage ?? "Gérant",
        signaturePng: trace.png,
        ip: adresseIp(request),
        userAgent: userAgent(request),
        // Le gérant est déjà authentifié par sa session : l'OTP ne s'applique
        // qu'au client, dont on ne maîtrise pas l'appareil.
        otpVerifie: false,
      });

      return NextResponse.json(resultat);
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    if (error instanceof ErreurSignature || error instanceof ErreurGeneration) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[contrats/:id]", error);
    return NextResponse.json({ error: "Opération impossible." }, { status: 500 });
  }
}
