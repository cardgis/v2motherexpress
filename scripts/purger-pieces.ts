/**
 * Purge des pièces d'identité des dossiers clos.
 *
 *   npm run cron:purge              efface réellement
 *   npm run cron:purge -- --apercu  montre ce qu'il ferait, sans rien toucher
 *
 * À appeler une fois par jour. Sur un hébergeur qui ne déclenche que par HTTP,
 * c'est `/api/cron/purge` qui appelle la même fonction.
 *
 * Ce qui est effacé : l'IMAGE de la pièce. Ce qui reste : son type, sa taille,
 * sa date de dépôt et son SHA-256 — de quoi prouver qu'on a vérifié, et même
 * de confirmer plus tard qu'une pièce présentée est bien celle qu'on a vue.
 */

// `.env.local` UNIQUEMENT : ce script SUPPRIME des données.
import "./env-local";

import { purgerPieces, delaiHeures } from "../src/lib/purge";
import { prisma } from "../src/lib/prisma";

async function main() {
  const apercu = process.argv.includes("--apercu");
  const heures = delaiHeures();

  console.log(
    `\nPurge des pièces d'identité — délai de ${heures} h après clôture${apercu ? " (APERÇU)" : ""}\n`,
  );

  const pieces = await purgerPieces({ apercu });

  if (pieces.length === 0) {
    console.log("  Aucune pièce concernée : tous les clients ont un dossier en cours,\n");
    console.log("  ou leurs pièces sont déjà purgées.\n");
    return;
  }

  const effacees = pieces.filter((p) => p.effacee);
  const programmees = pieces.filter((p) => !p.effacee);

  if (effacees.length > 0) {
    console.log(`  ${effacees.length} pièce(s) ${apercu ? "à effacer" : "effacée(s)"} :`);
    for (const p of effacees) console.log(`    ${p.type.padEnd(14)} client ${p.customerId}`);
  }

  if (programmees.length > 0) {
    console.log(`\n  ${programmees.length} pièce(s) programmée(s), pas encore mûre(s) :`);
    for (const p of programmees) {
      console.log(`    ${p.type.padEnd(14)} effacement le ${p.purgeApres.toISOString().slice(0, 16).replace("T", " ")}`);
    }
  }

  console.log(
    apercu
      ? "\n  APERÇU : rien n'a été touché. Relancez sans --apercu pour appliquer.\n"
      : "\n  Terminé.\n",
  );
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
