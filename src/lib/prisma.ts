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

function creerClient(): PrismaClient {
  const max = Number(process.env.DATABASE_POOL_MAX ?? 10);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
