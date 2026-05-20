import { Pool } from "pg";
import { randomUUID, randomBytes, scryptSync } from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const email = "lamotherexpress@gmail.com";
  const password = "Express.2026";
  const passwordHash = hashPassword(password);

  const client = await pool.connect();
  try {
    const existing = await client.query(`SELECT id FROM "AdminUser" LIMIT 1`);

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE "AdminUser" SET "email" = $1, "passwordHash" = $2, "updatedAt" = NOW()`,
        [email, passwordHash]
      );
      console.log(`Admin mis à jour : ${email}`);
    } else {
      await client.query(
        `INSERT INTO "AdminUser" ("id","email","name","passwordHash","role","isActive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
        [randomUUID(), email, "Admin", passwordHash, "ADMIN", true]
      );
      console.log(`Admin créé : ${email}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
