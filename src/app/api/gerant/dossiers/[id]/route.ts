import { NextResponse } from "next/server";
import { exigerGerantApi } from "@/lib/auth";
import { ErreurDossier, rejeterDossier, validerDossier } from "@/lib/gerant/dossiers";
import { adresseIp } from "@/lib/requete";

/**
 * Décision du gérant sur un dossier client : validation ou rejet motivé.
 *
 * Le cloisonnement par boutique est assuré dans `src/lib/gerant/dossiers.ts` :
 * un dossier hors périmètre y est traité comme inexistant.
 */

type Contexte = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexte) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "valider") {
      const affectations = Array.isArray(body?.affectations)
        ? body.affectations
            .filter(
              (a: unknown): a is { reservationId: string; vehiculeId: string } =>
                typeof a === "object" &&
                a !== null &&
                typeof (a as Record<string, unknown>).reservationId === "string" &&
                typeof (a as Record<string, unknown>).vehiculeId === "string",
            )
            .filter((a: { vehiculeId: string }) => a.vehiculeId !== "")
        : [];

      const resultat = await validerDossier({ gerant, customerId: id, affectations });

      // Jamais de numéro de pièce dans les journaux applicatifs.
      console.info(
        `[dossiers] validation ${id} par ${gerant.id} depuis ${adresseIp(request)} ` +
          `(${resultat.affectations} véhicule(s) affecté(s))`,
      );
      return NextResponse.json(resultat);
    }

    if (action === "rejeter") {
      const resultat = await rejeterDossier({
        gerant,
        customerId: id,
        motif: String(body?.motif ?? ""),
      });
      console.info(`[dossiers] rejet ${id} par ${gerant.id} depuis ${adresseIp(request)}`);
      return NextResponse.json(resultat);
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    if (error instanceof ErreurDossier) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[gerant/dossiers]", error);
    return NextResponse.json({ error: "Opération impossible." }, { status: 500 });
  }
}
