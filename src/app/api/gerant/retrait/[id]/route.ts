import { NextResponse } from "next/server";
import { exigerGerantApi } from "@/lib/auth";
import { enregistrerConstat, ErreurRetrait, verifierPiece } from "@/lib/retrait";
import { adresseIp } from "@/lib/requete";
import type { EtatAccessoires, EtatElement } from "@/generated/prisma";

/**
 * Retrait en boutique : vérification de la pièce, puis constat de remise.
 *
 * Deux actions :
 *   { action: "verifier-piece" }  confrontation de l'original avec la copie
 *   { action: "completer" }       état des lieux, signatures, sortie du véhicule
 */

type Contexte = { params: Promise<{ id: string }> };

const ETATS: EtatElement[] = ["NEUF", "OCCASION", "DEGRADATIONS"];
const ACCESSOIRES: EtatAccessoires[] = ["COMPLETS", "MANQUANTS"];

function etat(valeur: unknown, defaut: EtatElement): EtatElement {
  return ETATS.includes(valeur as EtatElement) ? (valeur as EtatElement) : defaut;
}

export async function POST(request: Request, { params }: Contexte) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    // ── Confrontation de la pièce ──────────────────────────────────────────
    if (action === "verifier-piece") {
      // La case n'est pas un détail : elle engage nominativement le gérant.
      if (typeof body?.conforme !== "boolean") {
        return NextResponse.json(
          { error: "Indiquez si l'original correspond à la copie." },
          { status: 400 },
        );
      }

      const handover = await verifierPiece({
        gerant,
        reservationId: id,
        conforme: body.conforme,
        motifRefus: body?.motifRefus ? String(body.motifRefus) : undefined,
        ip: adresseIp(request),
      });

      return NextResponse.json({
        statut: handover.statut,
        pieceConforme: handover.pieceConforme,
      });
    }

    // ── Constat de remise ──────────────────────────────────────────────────
    if (action === "completer") {
      // Aucune signature n'est reçue du navigateur : le constat reprend les
      // tracés du contrat, que seul le serveur sait retrouver.
      const heure = String(body?.heureRemise ?? "").trim();
      if (!/^\d{1,2}\s*h\s*\d{0,2}$/i.test(heure)) {
        return NextResponse.json(
          { error: "Indiquez l'heure de remise, au format 14h30." },
          { status: 400 },
        );
      }

      const compteur = Number(body?.compteurKm);
      const batterie = Number(body?.niveauBatterie);

      const resultat = await enregistrerConstat({
        gerant,
        reservationId: id,
        ip: adresseIp(request),
        saisie: {
          compteurKm: Number.isFinite(compteur) && compteur >= 0 ? Math.round(compteur) : null,
          heureRemise: heure,
          niveauBatterie:
            Number.isFinite(batterie) && batterie >= 0 && batterie <= 100
              ? Math.round(batterie)
              : null,
          carrosserie: etat(body?.carrosserie, "NEUF"),
          freinsPneus: etat(body?.freinsPneus, "NEUF"),
          batterieChargeur: etat(body?.batterieChargeur, "NEUF"),
          accessoires: ACCESSOIRES.includes(body?.accessoires) ? body.accessoires : "COMPLETS",
          accessoiresPrecision: body?.accessoiresPrecision
            ? String(body.accessoiresPrecision)
            : undefined,
          casqueRemis: body?.casqueRemis === true,
          chargeurRemis: body?.chargeurRemis === true,
          observations: body?.observations ? String(body.observations) : undefined,
        },
      });

      return NextResponse.json({
        statut: "ACTIVE",
        empreintePv: resultat.empreinte,
        pages: resultat.pages,
      });
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    if (error instanceof ErreurRetrait) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[gerant/retrait]", error);
    return NextResponse.json({ error: "Opération impossible." }, { status: 500 });
  }
}
