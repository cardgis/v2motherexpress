/**
 * Environnement des scripts de vérification — À IMPORTER EN PREMIER.
 *
 *   import "./env-local";
 *
 * ── Pourquoi un module à part ──────────────────────────────────────────────
 * Dans un module ES, tous les `import` sont évalués AVANT le code du fichier.
 * Un `dotenv.config()` écrit entre deux imports s'exécute donc trop tard :
 * `src/lib/prisma.ts` a déjà créé son pool sans `DATABASE_URL`. Placé dans
 * son propre module et importé en tête, le chargement passe avant tout le
 * reste.
 *
 * ── Pourquoi `.env.local` seulement ────────────────────────────────────────
 * `.env` pointe sur la base de PRODUCTION. Un script qui retomberait dessus
 * parce que `.env.local` manque écrirait sur le site en ligne : on préfère
 * qu'il échoue.
 */

import dotenv from "dotenv";

const resultat = dotenv.config({ path: ".env.local" });

if (resultat.error || !process.env.DATABASE_URL) {
  throw new Error(
    "Scripts : .env.local introuvable ou sans DATABASE_URL. Ces scripts ne tournent " +
      "que sur la base locale (voir docs/tester-en-local.md).",
  );
}
