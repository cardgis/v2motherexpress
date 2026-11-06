/**
 * Client Prisma unique par processus.
 *
 * ── Pool de connexions ─────────────────────────────────────────────────────
 * PostgreSQL limite le nombre de connexions simultanées (souvent 100 sur une
 * offre managée). Chaque instance du serveur ouvre au plus
 * DATABASE_POOL_MAX connexions : avec 10 par instance, on peut faire tourner
 * plusieurs instances sans saturer la base. En serverless, baisser à 1-3 et
 * passer par le pooler du fournisseur (PgBouncer, Neon pooler).
 */

import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Rend la vérification TLS EXPLICITE dans l'adresse de connexion.
 *
 * Neon fournit `sslmode=require`, et `pg` le traite aujourd'hui comme
 * `verify-full` — le certificat du serveur est réellement vérifié. Mais il
 * prévient, à chaque démarrage, que sa prochaine version majeure adoptera la
 * sémantique de libpq : `require` voudra alors dire « chiffrer SANS vérifier
 * le certificat ». Un simple `npm update` dégraderait donc la connexion qui
 * porte les pièces d'identité, sans qu'aucun test ne le signale — le trafic
 * resterait chiffré, mais plus authentifié, ce qui ouvre la porte à un
 * interlocuteur qui se ferait passer pour la base.
 *
 * On réécrit donc le paramètre pour dire ce qu'on veut vraiment. Par
 * remplacement de chaîne et non par `new URL()`, qui ré-encoderait le mot de
 * passe et pourrait corrompre l'adresse.
 *
 * Les adresses SANS `sslmode` ne sont pas touchées : la base de développement
 * tourne en clair sur localhost, et lui imposer une vérification de
 * certificat la rendrait injoignable.
 */
function tlsExplicite(url: string | undefined): string | undefined {
  return url?.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/i, "$1verify-full");
}

function creerClient(): PrismaClient {
  const max = Number(process.env.DATABASE_POOL_MAX ?? 10);

  const pool = new Pool({
    connectionString: tlsExplicite(process.env.DATABASE_URL),
    max: Number.isInteger(max) && max > 0 ? max : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// En développement, le rechargement à chaud réévalue ce module : sans ce
// cache global, chaque sauvegarde ouvrirait un nouveau pool.
export const prisma = globalPourPrisma.prisma ?? creerClient();

if (process.env.NODE_ENV !== "production") {
  globalPourPrisma.prisma = prisma;
}
