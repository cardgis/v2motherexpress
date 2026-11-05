import { NextResponse } from "next/server";
import { z } from "zod";
import { exigerGerantApi } from "@/lib/auth";
import { chercherDossiers, enregistrerVersement, ErreurVersement } from "@/lib/versements";
import { MODES_PAIEMENT } from "@/lib/modes-paiement";
import { adresseIp } from "@/lib/requete";

/**
 * Encaissements saisis en boutique.
 *
 *   GET  ?q=…   recherche un dossier (référence, nom, téléphone)
 *   POST        enregistre un versement reçu
 *
 * Réservé au gérant : c'est lui qui reçoit l'argent. Le commercial est refusé
 * par `exigerGerantApi`, l'annulation appartient à l'administrateur seul.
 * Le cloisonnement par boutique est appliqué dans `src/lib/versements.ts`.
 */

const schema = z.object({
  reservationId: z.string().min(1).max(64),
  /** Le champ arrive en texte : « 25 000 » et « 25000 » valent pareil. */
  montant: z.union([z.string().max(15), z.number()]),
  mode: z.enum(MODES_PAIEMENT, { message: "Mode de paiement inconnu." }),
  recuLe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de réception invalide."),
  reference: z.string().max(60, "Référence : 60 caractères maximum.").optional(),
});

/** Les séparateurs de milliers saisis à la main sont retirés. */
function lireMontant(saisie: string | number): number {
  if (typeof saisie === "number") return Math.round(saisie);
  const chiffres = saisie.replace(/[^0-9]/g, "");
  return chiffres === "" ? 0 : Number(chiffres);
}

export async function GET(request: Request) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  const requete = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ dossiers: await chercherDossiers(gerant, requete.slice(0, 80)) });
}

export async function POST(request: Request) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  try {
    const analyse = schema.safeParse(await request.json().catch(() => ({})));
    if (!analyse.success) {
      return NextResponse.json(
        { error: analyse.error.issues[0]?.message ?? "Saisie invalide." },
        { status: 400 },
      );
    }
    const saisie = analyse.data;

    const versement = await enregistrerVersement({
      membre: gerant,
      reservationId: saisie.reservationId,
      montant: lireMontant(saisie.montant),
      mode: saisie.mode,
      recuLe: new Date(`${saisie.recuLe}T12:00:00Z`),
      reference: saisie.reference,
    });

    // Journalisé sans le montant : le détail vit en base, le journal sert à
    // retrouver qui a saisi quoi, depuis où.
    console.info(
      `[versements] saisie ${versement.recuRef} par ${gerant.id} depuis ${adresseIp(request)}`,
    );

    return NextResponse.json(versement, { status: 201 });
  } catch (error) {
    if (error instanceof ErreurVersement) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[versements]", error);
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  }
}
