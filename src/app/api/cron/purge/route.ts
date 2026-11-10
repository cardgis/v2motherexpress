import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { purgerPieces, delaiHeures } from "@/lib/purge";

/**
 * Déclenchement HTTP de la purge des pièces d'identité.
 *
 * `npm run cron:purge` reste la voie normale sur un serveur qui sait lancer un
 * script ; Vercel ne sait que frapper une URL. Cette route appelle la MÊME
 * fonction, donc les deux voies ne peuvent pas dériver l'une de l'autre.
 *
 * Même garde que `/api/cron/expiration`, et pour une raison plus forte encore :
 * cette route SUPPRIME des données. Sans `CRON_SECRET`, elle se désactive au
 * lieu de fonctionner sans protection — un effacement déclenchable par un appel
 * public serait la pire des portes ouvertes.
 *
 * Le secret est comparé à temps constant, et l'absence de secret est refusée
 * AVANT la comparaison : la forme naïve compare à « Bearer undefined », qu'il
 * suffit d'envoyer.
 */

// Une pièce par itération, et autant d'itérations que de dossiers clos : la
// valeur par défaut de Vercel couperait le traitement au milieu.
export const maxDuration = 60;

function secretValide(entete: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !entete) return false;

  const attendu = Buffer.from(`Bearer ${secret}`);
  const recu = Buffer.from(entete);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[cron/purge] CRON_SECRET absent — route désactivée");
    return NextResponse.json({ error: "Cron non configuré." }, { status: 503 });
  }

  if (!secretValide(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const pieces = await purgerPieces();
    const effacees = pieces.filter((p) => p.effacee).length;

    // Ni identifiant de client ni chemin de blob dans les journaux : ce sont
    // des pièces d'identité. Des compteurs suffisent à surveiller le cron.
    console.info(
      `[cron/purge] ${effacees} pièce(s) effacée(s), ${pieces.length - effacees} programmée(s) ` +
        `— délai de ${delaiHeures()} h`,
    );

    return NextResponse.json({
      effacees,
      programmees: pieces.length - effacees,
      delaiHeures: delaiHeures(),
    });
  } catch (error) {
    console.error("[cron/purge]", error);
    return NextResponse.json({ error: "Purge impossible." }, { status: 500 });
  }
}
