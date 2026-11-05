/**
 * Génère les secrets de production, dans un FICHIER et non à l'écran.
 *
 *   npm run generer:secrets
 *
 * ── Pourquoi un fichier ────────────────────────────────────────────────────
 * Un secret affiché dans un terminal finit dans un historique, un journal, une
 * capture d'écran ou une conversation. Celui-ci est écrit dans un fichier
 * ignoré par git, que vous ouvrez pour copier les valeurs dans le tableau de
 * bord Vercel. Rien ne s'affiche ici que des noms de variables.
 *
 * ── Pourquoi il REFUSE d'écraser ───────────────────────────────────────────
 * `STORAGE_CLES_CHIFFREMENT` chiffre les pièces d'identité. Régénérer ce
 * fichier après une mise en service, puis recopier la nouvelle clé, rendrait
 * ILLISIBLE tout ce qui a déjà été stocké. Le refus d'écrasement est donc le
 * garde-fou principal de ce script, pas une politesse.
 */

import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const FICHIER = "secrets-production.txt";

/** Trousseau de chiffrement : « identifiant:base64 », clé de 32 octets. */
function trousseau(): string {
  const annee = new Date().getFullYear();
  return `prod${annee}a:${randomBytes(32).toString("base64")}`;
}

const secrets: { nom: string; valeur: string; note: string }[] = [
  {
    nom: "AUTH_SECRET",
    valeur: randomBytes(32).toString("hex"),
    note: "signe les sessions ET hache les codes OTP ; le changer déconnecte tout le monde",
  },
  {
    nom: "STORAGE_CLES_CHIFFREMENT",
    valeur: trousseau(),
    note: "IRRÉVERSIBLE une fois en service — à sauvegarder hors ligne AVANT tout usage",
  },
  {
    nom: "STORAGE_PATH_SALT",
    valeur: randomBytes(16).toString("hex"),
    note: "obligatoire avec le pilote vercel : sans lui les blobs deviennent énumérables",
  },
  {
    nom: "CRON_SECRET",
    valeur: randomBytes(24).toString("hex"),
    note: "protège /api/cron/expiration, qui se désactive sans lui",
  },
];

function main() {
  if (existsSync(FICHIER)) {
    console.error(`\n  REFUS   ${FICHIER} existe déjà.`);
    console.error("          Le régénérer puis recopier la nouvelle clé de chiffrement");
    console.error("          rendrait illisibles les pièces déjà stockées. Pour repartir");
    console.error("          de zéro en toute conscience, supprimez le fichier à la main.\n");
    process.exitCode = 1;
    return;
  }

  const lignes = [
    "Secrets de production — La Mother Express V2",
    `Générés le ${new Date().toISOString().slice(0, 10)}`,
    "",
    "À coller dans Vercel : Project Settings > Environment Variables,",
    "environnement Production. Ce fichier est ignoré par git.",
    "",
    "SAUVEGARDEZ STORAGE_CLES_CHIFFREMENT HORS LIGNE : la perdre, c'est perdre",
    "toutes les pièces d'identité et tous les contrats déjà chiffrés.",
    "",
    ...secrets.flatMap((s) => [`# ${s.note}`, `${s.nom}="${s.valeur}"`, ""]),
  ];

  writeFileSync(FICHIER, lignes.join("\n"), { encoding: "utf8", mode: 0o600 });

  console.log(`\n  ✓ ${secrets.length} secrets écrits dans ${FICHIER}`);
  for (const s of secrets) console.log(`      ${s.nom}`);
  console.log("\n  Aucune valeur n'a été affichée. Ouvrez le fichier pour les copier,");
  console.log("  et sauvegardez le trousseau de chiffrement hors ligne.\n");
}

main();
