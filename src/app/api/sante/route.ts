import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { manqueAuStockage } from "@/lib/storage";

/**
 * Sonde de santé pour l'orchestrateur (Vercel, Azure Container Apps, load
 * balancer OVHcloud…). Il retire du trafic une instance qui répond 503.
 *
 * Elle vérifie TROIS choses, chacune ajoutée après une panne qu'elle n'avait
 * pas vue venir :
 *
 *   1. la base RÉPOND ;
 *   2. le SCHÉMA est à jour avec le code déployé (2026-11-12) ;
 *   3. le STOCKAGE est configuré (2026-11-05).
 *
 * Le stockage est contrôlé SANS appel réseau : on vérifie que les variables du
 * driver configuré sont présentes. Éprouver l'aller-retour supposerait
 * d'écrire un blob à chaque appel, sur un point d'entrée public — inacceptable.
 *
 * Ne révèle rien : ni nom de base, ni variable manquante, ni colonne. Le
 * détail va dans les journaux, où seul l'exploitant le lit.
 *
 * ELLE DIT EN REVANCHE QUEL COMMIT EST SERVI (2026-11-12), et c'est le seul
 * renseignement qu'elle livre. Sans lui, « le nouveau code est-il en ligne ? »
 * ne se vérifie pas : le 2026-11-12, la sonde a répondu 200 pendant trois
 * minutes d'attente parce que l'ANCIEN code allait parfaitement avec l'ANCIEN
 * schéma. La migration a donc été appliquée sur un déploiement périmé, et la
 * production est tombée vingt minutes. Une attente à la montre n'est pas une
 * preuve ; `commit` en est une.
 *
 * C'est à vérifier AVANT toute migration DESTRUCTIVE (`DROP COLUMN`, retrait
 * d'une valeur d'énumération), où le nouveau code doit être servi d'abord.
 * Pour une migration ADDITIVE, l'ordre est l'inverse : la base d'abord.
 *
 * Divulgation acceptée : sept caractères d'une empreinte de commit d'un dépôt
 * PRIVÉ ne mènent à aucun code. À reconsidérer si le dépôt devient public.
 */

export const dynamic = "force-dynamic";

const DELAI_MS = 3_000;
const SANS_CACHE = { "Cache-Control": "no-store" };

/** Le commit servi, pour que la bascule d'un déploiement se CONSTATE. */
const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "local";

export async function GET() {
  const manquante = manqueAuStockage();
  if (manquante) {
    console.error(`[sante] stockage non configuré : ${manquante}`);
    return NextResponse.json(
      { statut: "indisponible", commit: COMMIT },
      { status: 503, headers: SANS_CACHE },
    );
  }

  try {
    await Promise.race([
      // `SELECT 1` prouvait seulement que la base RÉPOND. Le 2026-11-12, une
      // migration appliquée en local et pas en production a fait échouer tout
      // le parcours client — le code déployé réclamait une colonne absente —
      // pendant que cette sonde affichait 200. Le code était en avance sur sa
      // base, et rien ne le disait.
      //
      // On interroge donc une table par le CLIENT GÉNÉRÉ, qui sélectionne
      // toutes les colonnes qu'il croit exister. Une colonne manquante fait
      // alors échouer la sonde, à l'endroit prévu pour ça plutôt qu'au milieu
      // d'un retrait. `Reservation` est choisie parce qu'elle porte le plus de
      // champs ajoutés au fil des migrations, donc la plus exposée à l'écart.
      //
      // Coût : une lecture indexée sur une ligne. `verif:prod` ne peut pas
      // faire ce contrôle, lui qui s'interdit délibérément de toucher la base.
      prisma.reservation.findFirst({ take: 1 }),
      new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("délai dépassé")), DELAI_MS)),
    ]);
    return NextResponse.json({ statut: "ok", commit: COMMIT }, { headers: SANS_CACHE });
  } catch (error) {
    console.error("[sante] base injoignable ou schéma en retard sur le code", error);
    return NextResponse.json(
      { statut: "indisponible", commit: COMMIT },
      { status: 503, headers: SANS_CACHE },
    );
  }
}
