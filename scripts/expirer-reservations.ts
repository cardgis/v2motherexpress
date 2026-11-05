/**
 * Cron : libère les motos des réservations jamais retirées.
 *
 *   npm run cron:expiration              agit
 *   npm run cron:expiration -- --apercu  montre sans rien écrire
 *
 * À appeler une fois par jour. Chez un hébergeur qui ne déclenche que par HTTP
 * (Vercel Cron), il faudra une route d'API protégée par un secret appelant
 * `expirerReservations()` — la logique, elle, ne change pas.
 *
 * Contrairement à `purger-donnees-test`, ce script AGIT par défaut : un cron
 * qui ne ferait rien sans option serait un piège.
 */

// `.env.local` UNIQUEMENT.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { expirerReservations } from "../src/lib/expiration";
import { dateFr } from "../src/lib/formatters";

async function main() {
  const apercu = process.argv.includes("--apercu");

  const expirees = await expirerReservations({ apercu });

  if (expirees.length === 0) {
    console.log("\nAucune réservation à expirer.\n");
  } else {
    console.log(`\n${apercu ? "À EXPIRER (aperçu, rien n'est écrit)" : "EXPIRÉES"} : ${expirees.length}\n`);
    for (const e of expirees) {
      const moto = e.vehiculeLibere ? `moto ${e.vehiculeLibere} rendue au stock` : "aucune moto attribuée";
      console.log(`  ${e.reference} — délai dépassé le ${dateFr(e.expireLe)} — ${moto}`);
    }
    console.log("");
  }

  await prisma.$disconnect();
}

main().catch(async (erreur) => {
  console.error(erreur);
  await prisma.$disconnect();
  process.exit(1);
});
