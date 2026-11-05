/**
 * Surveillance du solde prépayé Dexchange.
 *
 *   npm run verif:solde
 *
 * Le compte est PRÉPAYÉ, et le SMS porte l'authentification : un solde à zéro,
 * ce n'est pas une gêne, c'est le site fermé. Plus personne ne se connecte,
 * aucun contrat ne se signe, et rien dans l'application ne le dit — l'envoi
 * échoue, c'est tout. Ce contrôle existe pour l'apprendre AVANT.
 *
 * ── Pourquoi un script et non une route de cron ────────────────────────────
 * Le module d'origine proposait une route HTTP appelée par le cron de Vercel.
 * L'hébergeur n'étant pas arrêté, un script reste appelable partout : crontab,
 * tâche planifiée Windows, Azure, OVH, et par une route HTTP le jour où elle
 * existera. Même choix que `cron:expiration`.
 *
 * ── Le code de sortie EST l'alerte ─────────────────────────────────────────
 *   0  solde suffisant
 *   1  solde sous le seuil — à recharger
 *   2  solde illisible : fournisseur injoignable, ou clé refusée
 * Un crontab envoie par courrier ce qu'un script écrit sur la sortie d'erreur :
 * la supervision est donc acquise sans dépendre de notre propre canal e-mail,
 * qui serait précisément en panne si la clé d'API était le problème.
 */

// `.env.local` UNIQUEMENT : ce script ne doit jamais hériter d'un accès de production.
import "./env-local";

import { soldeDexchange } from "../src/lib/envoi";

/**
 * 200 SMS, et non les 20 du module d'origine. Un seuil se mesure en DÉLAI DE
 * RECHARGE, pas en messages : à 20 il reste moins d'une journée d'activité,
 * ce qui ne laisse pas le temps d'alimenter un compte prépayé un week-end.
 */
const SEUIL_DEFAUT = 200;

function seuil(): number {
  const valeur = Number(process.env.SMS_BALANCE_THRESHOLD);
  return Number.isInteger(valeur) && valeur > 0 ? valeur : SEUIL_DEFAUT;
}

/**
 * `process.exitCode` et non `process.exit()` : sous Windows, couper le
 * processus pendant que libuv referme ses descripteurs déclenche une assertion
 * (« UV_HANDLE_CLOSING »), et le code de sortie devient celui d'un abandon.
 * Comme ce code EST l'alerte, il doit rester exactement celui qu'on a choisi.
 * On le pose, puis on laisse Node terminer de lui-même.
 */
async function main() {
  const driver = process.env.SMS_DRIVER ?? process.env.OTP_DRIVER ?? "console";

  if (driver !== "dexchange") {
    console.log(`\n  ⚠  SMS_DRIVER = ${driver} — le solde prépayé ne concerne que Dexchange.`);
    console.log("     Rien à surveiller ici.\n");
    return;
  }

  const restant = await soldeDexchange();
  const limite = seuil();

  if (restant === null) {
    console.error("\n  KO   solde illisible — Dexchange injoignable ou clé refusée.");
    console.error("       Une clé invalide se voit ici AVANT de se voir à la connexion.\n");
    process.exitCode = 2;
    return;
  }

  if (restant < limite) {
    console.error(`\n  ALERTE   ${restant} SMS restants, seuil ${limite}.`);
    console.error("           Recharger le compte Dexchange : sans crédit, plus aucune");
    console.error("           connexion ni signature n'est possible.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`\n  ✓ ${restant} SMS restants (seuil ${limite}).\n`);
}

main().catch((erreur) => {
  console.error(erreur);
  process.exitCode = 2;
});
