import { NextResponse } from "next/server";
import { revoquerSessions, SESSION_COOKIE, utilisateurCourant } from "@/lib/auth";

/**
 * Déconnexion.
 *
 * Effacer le cookie ne suffit pas : un jeton copié ailleurs (téléphone
 * partagé, cookie volé) resterait valable jusqu'à son expiration. On
 * incrémente donc la version de session du compte, ce qui invalide TOUS les
 * jetons émis jusque-là, sur tous les appareils.
 */
export async function POST() {
  const user = await utilisateurCourant();
  if (user) await revoquerSessions(user.id);

  const reponse = NextResponse.json({ ok: true });
  reponse.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return reponse;
}
