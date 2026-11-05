import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { expirerReservations } from "@/lib/expiration";

/**
 * Déclenchement HTTP du cron d'expiration.
 *
 * `npm run cron:expiration` reste la voie normale sur un serveur qui sait
 * lancer un script. Mais Vercel — comme toute plateforme sans machine
 * persistante — ne sait que FRAPPER UNE URL : cette route existe pour ça, et
 * appelle exactement la même fonction. Aucune logique n'est dupliquée, donc
 * aucune des deux voies ne peut dériver de l'autre.
 *
 * ── Le piège de l'authentification par secret ──────────────────────────────
 * La forme naïve, qu'on lit partout :
 *
 *     if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
 *
 * est une PORTE OUVERTE quand la variable n'est pas définie : elle compare
 * alors à la chaîne « Bearer undefined », qu'il suffit d'envoyer. D'où l'ordre
 * inverse ici — on refuse d'abord l'absence de secret, et seulement ensuite on
 * compare, à temps constant pour ne pas livrer le secret caractère par
 * caractère à qui mesure les durées de réponse.
 */

// Plusieurs réservations, une transaction chacune : la valeur par défaut de
// Vercel (10 s) couperait le traitement au milieu, en laissant des dossiers
// faits et d'autres non.
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
    // Une route de cron sans secret ne doit pas « marcher quand même » : elle
    // libérerait des motos sur simple appel public.
    console.error("[cron/expiration] CRON_SECRET absent — route désactivée");
    return NextResponse.json({ error: "Cron non configuré." }, { status: 503 });
  }

  if (!secretValide(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const expirees = await expirerReservations();

    // Les références suffisent au journal : pas de nom, pas de numéro.
    console.info(
      `[cron/expiration] ${expirees.length} réservation(s) caduque(s)` +
        (expirees.length > 0 ? ` : ${expirees.map((e) => e.reference).join(", ")}` : ""),
    );

    return NextResponse.json({
      traitees: expirees.length,
      references: expirees.map((e) => e.reference),
      vehiculesLiberes: expirees.filter((e) => e.vehiculeLibere).length,
    });
  } catch (error) {
    console.error("[cron/expiration]", error);
    return NextResponse.json({ error: "Expiration impossible." }, { status: 500 });
  }
}
