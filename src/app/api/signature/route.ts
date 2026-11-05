import { NextResponse } from "next/server";
import { demanderCode, verifierCode, ErreurOtp } from "@/lib/otp";
import {
  apposerSignature,
  contratParJeton,
  ErreurSignature,
  journaliser,
} from "@/lib/contrats/signature";
import { identifiantDuCompte } from "@/lib/identifiant";
import { decoderTracePng } from "@/lib/fichiers";
import { masquerIdentifiant } from "@/lib/phone";
import { adresseIp, userAgent } from "@/lib/requete";

/**
 * Vercel coupe une fonction à 10 s par défaut. Or l'envoi Dexchange prend
 * jusqu'à 25 s — son API parle à l'opérateur avant de répondre — et un délai
 * dépassé N'ANNULE PAS le SMS déjà lancé : le client recevrait un code que
 * `demanderCode` vient d'invalider en voyant l'échec. Sans cette ligne, le
 * correctif de `DELAI_DEXCHANGE_MS` serait annulé par la plateforme.
 */
export const maxDuration = 60;

/**
 * Signature du client, par lien opaque.
 *
 * Le jeton fait office d'authentification : le client n'a pas besoin d'être
 * connecté pour signer, ce qui compte quand le lien arrive par WhatsApp sur
 * un téléphone où la session a expiré. Le code à usage unique, lui, reste
 * obligatoire — c'est lui qui relie le tracé à une personne. Il part vers
 * l'identifiant VÉRIFIÉ du compte (téléphone, sinon e-mail), jamais vers une
 * coordonnée déclarée.
 *
 * Deux actions :
 *   { action: "demander-code" }  envoie le code
 *   { action: "signer", ... }    vérifie le code puis appose la signature
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jeton = String(body?.jeton ?? "");

    const contrat = await contratParJeton(jeton);
    const client = contrat.reservation.customer;
    const identifiant = identifiantDuCompte(client.user);

    if (!identifiant) {
      throw new ErreurSignature(
        "Aucun téléphone ni e-mail vérifié sur ce compte. Contactez votre boutique.",
      );
    }

    const ip = adresseIp(request);
    const agent = userAgent(request);

    // ── Envoi du code ──────────────────────────────────────────────────────
    if (body?.action === "demander-code") {
      const { expiresAt, canal, codeDeDeveloppement } = await demanderCode({
        identifiant,
        but: "SIGNATURE",
        contractId: contrat.id,
        ip,
      });

      await journaliser(contrat.id, "OTP_ENVOYE", {
        acteurUserId: client.userId,
        ip,
        userAgent: agent,
      });

      return NextResponse.json({
        destinataireMasque: masquerIdentifiant(identifiant.valeur),
        expiresAt: expiresAt.toISOString(),
        canal,
        codeDeDeveloppement,
      });
    }

    // ── Signature ──────────────────────────────────────────────────────────
    if (body?.action === "signer") {
      const code = String(body?.code ?? "").trim();
      if (!code) return NextResponse.json({ error: "Code requis." }, { status: 400 });

      const trace = decoderTracePng(body?.trace);
      if (!trace.ok) return NextResponse.json({ error: trace.erreur }, { status: 400 });

      const { canal } = await verifierCode({
        destinataire: identifiant.valeur,
        code,
        but: "SIGNATURE",
        contractId: contrat.id,
      });

      await journaliser(contrat.id, "OTP_VALIDE", {
        acteurUserId: client.userId,
        ip,
        userAgent: agent,
      });

      const snapshot = contrat.donnees as { clientNomComplet?: string };

      const resultat = await apposerSignature({
        contractId: contrat.id,
        role: "CLIENT",
        signataireUserId: client.userId,
        // Le nom est figé depuis le snapshot du contrat, pas depuis le profil
        // vivant : c'est celui qui figure sur l'acte qui fait foi.
        signataireNom: snapshot.clientNomComplet ?? "Client",
        signaturePng: trace.png,
        ip,
        userAgent: agent,
        otpVerifie: true,
        otpCanal: canal,
        telephone: identifiant.type === "TELEPHONE" ? identifiant.valeur : undefined,
        email: identifiant.type === "EMAIL" ? identifiant.valeur : undefined,
        mention: String(body?.mention ?? "").slice(0, 500),
      });

      return NextResponse.json({ statut: resultat.statut, empreinte: resultat.empreinte });
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    if (error instanceof ErreurOtp) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statutHttp });
    }
    if (error instanceof ErreurSignature) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[signature]", error);
    return NextResponse.json({ error: "Signature impossible." }, { status: 500 });
  }
}
