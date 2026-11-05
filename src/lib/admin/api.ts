/** Réponses communes des routes d'API de l'administration. */

import { NextResponse } from "next/server";
import type { z } from "zod";
import { ErreurAdmin } from "./erreurs";

export const refusAcces = () =>
  NextResponse.json({ error: "Accès réservé à l’administrateur." }, { status: 403 });

export function refusSaisie(erreur: z.ZodError) {
  const probleme = erreur.issues[0];
  const champ = probleme?.path[0];
  return NextResponse.json(
    { error: probleme?.message ?? "Saisie invalide.", champ: typeof champ === "string" ? champ : undefined },
    { status: 400 },
  );
}

/** Refus métier : message affiché. Erreur imprévue : journalisée, message neutre. */
export function reponseErreur(erreur: unknown, contexte: string) {
  if (erreur instanceof ErreurAdmin) {
    return NextResponse.json({ error: erreur.message, champ: erreur.champ }, { status: erreur.statut });
  }
  console.error(`[admin/${contexte}]`, erreur);
  return NextResponse.json({ error: "Opération impossible." }, { status: 500 });
}
