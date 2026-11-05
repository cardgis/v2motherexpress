import { NextResponse } from "next/server";
import { exigerGerantApi } from "@/lib/auth";
import {
  ajouterVehicule,
  ErreurFlotte,
  modifierVehicule,
  supprimerVehicule,
} from "@/lib/gerant/flotte";
import type { StatutVehicule } from "@/generated/prisma";

/**
 * Inventaire des motos d'une boutique.
 *
 * POST   ajoute une machine
 * PATCH  corrige immatriculation, CMC, couleur ou statut
 * DELETE retire une machine jamais engagée sur un dossier
 *
 * Le cloisonnement par boutique est assuré dans `src/lib/gerant/flotte.ts`.
 */

async function gerant() {
  return exigerGerantApi();
}

const refusAcces = () =>
  NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });

function erreur(e: unknown) {
  if (e instanceof ErreurFlotte) return NextResponse.json({ error: e.message }, { status: 409 });
  console.error("[gerant/flotte]", e);
  return NextResponse.json({ error: "Opération impossible." }, { status: 500 });
}

export async function POST(request: Request) {
  const user = await gerant();
  if (!user) return refusAcces();

  try {
    const body = await request.json().catch(() => ({}));
    const vehicule = await ajouterVehicule({
      gerant: user,
      boutiqueId: body?.boutiqueId ? String(body.boutiqueId) : undefined,
      produitId: String(body?.produitId ?? ""),
      numeroChassis: String(body?.numeroChassis ?? ""),
      immatriculation: body?.immatriculation ? String(body.immatriculation) : undefined,
      cmc: body?.cmc ? String(body.cmc) : undefined,
      couleur: body?.couleur ? String(body.couleur) : undefined,
    });
    return NextResponse.json(vehicule, { status: 201 });
  } catch (e) {
    return erreur(e);
  }
}

export async function PATCH(request: Request) {
  const user = await gerant();
  if (!user) return refusAcces();

  try {
    const body = await request.json().catch(() => ({}));
    const vehicule = await modifierVehicule({
      gerant: user,
      vehiculeId: String(body?.vehiculeId ?? ""),
      // `undefined` signifie « ne touche pas », une chaîne vide signifie
      // « efface » : les deux doivent rester distincts.
      immatriculation: body?.immatriculation === undefined ? undefined : String(body.immatriculation),
      cmc: body?.cmc === undefined ? undefined : String(body.cmc),
      couleur: body?.couleur === undefined ? undefined : String(body.couleur),
      statut: body?.statut === undefined ? undefined : (String(body.statut) as StatutVehicule),
    });
    return NextResponse.json(vehicule);
  } catch (e) {
    return erreur(e);
  }
}

export async function DELETE(request: Request) {
  const user = await gerant();
  if (!user) return refusAcces();

  try {
    const body = await request.json().catch(() => ({}));
    const retire = await supprimerVehicule(user, String(body?.vehiculeId ?? ""));
    return NextResponse.json(retire);
  } catch (e) {
    return erreur(e);
  }
}
