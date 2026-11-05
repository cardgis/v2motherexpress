/**
 * Seed V2 — boutiques, gérants, véhicules et un client de test.
 *
 * Idempotent : relançable autant de fois que nécessaire sans créer de doublon.
 * Complète le seed V1 (`prisma/seed.ts`), qui doit avoir tourné avant pour que
 * les `Store` et les `Produit` existent.
 *
 *   npm run seed:v2
 */

import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Les codes servent de préfixe aux références de contrat : LME-2026-THS-0001.
 *
 * `representantNom` est le nom qui s'imprime sur chaque acte au titre du
 * Bailleur. Les valeurs proviennent des contrats signés réels fournis par le
 * client — ne pas les inventer.
 */
const BOUTIQUES = [
  {
    storeSlug: "thies",
    code: "THS",
    adresse: "Quartier Grand Standing, Thiès, Sénégal",
    telephone: "+221772320235",
    representantNom: "MENDY Lazare Evariste",
    gerant: { nom: "MENDY Lazare Evariste", telephone: "+221772320235" },
  },
  {
    storeSlug: "mbour",
    code: "MBR",
    adresse: "Route de Saly, Mbour, Sénégal",
    telephone: "+221703677575",
    representantNom: "NASSALAN Frédéric Olivier",
    gerant: { nom: "NASSALAN Frédéric Olivier", telephone: "+221703677575" },
  },
];

/** Quelques véhicules physiques pour pouvoir tester l'attribution au retrait. */
const VEHICULES = [
  { boutique: "THS", produit: "revoo-a10", chassis: "REVOO-A10-THS-0001", couleur: "Noir" },
  { boutique: "THS", produit: "revoo-a10", chassis: "REVOO-A10-THS-0002", couleur: "Rouge" },
  { boutique: "THS", produit: "revoo-b12", chassis: "REVOO-B12-THS-0001", couleur: "Blanc" },
  { boutique: "MBR", produit: "revoo-a10", chassis: "REVOO-A10-MBR-0001", couleur: "Bleu" },
  { boutique: "MBR", produit: "revoo-c32", chassis: "REVOO-C32-MBR-0001", couleur: "Gris" },
];

const CLIENT_TEST = { telephone: "+221770000000", nom: "Client de test" };

async function main() {
  for (const b of BOUTIQUES) {
    const store = await prisma.store.findUnique({ where: { slug: b.storeSlug } });
    if (!store) {
      throw new Error(
        `Store « ${b.storeSlug} » introuvable. Lancez d'abord le seed V1 : npm run seed`,
      );
    }

    const boutique = await prisma.boutique.upsert({
      where: { storeId: store.id },
      create: {
        storeId: store.id,
        code: b.code,
        adresse: b.adresse,
        telephone: b.telephone,
        representantNom: b.representantNom,
      },
      update: {
        code: b.code,
        adresse: b.adresse,
        telephone: b.telephone,
        representantNom: b.representantNom,
      },
    });

    await prisma.user.upsert({
      where: { telephone: b.gerant.telephone },
      create: {
        telephone: b.gerant.telephone,
        nomAffichage: b.gerant.nom,
        role: "GERANT",
        telVerifie: true,
        boutiqueId: boutique.id,
      },
      // Le rôle est réaffirmé : un gérant ne doit jamais retomber en CLIENT
      // parce qu'il s'est connecté avant le passage du seed.
      update: { role: "GERANT", boutiqueId: boutique.id, nomAffichage: b.gerant.nom },
    });

    console.log(`✓ Boutique ${b.code} (${store.name}) — gérant ${b.gerant.nom}`);
  }

  for (const v of VEHICULES) {
    const boutique = await prisma.boutique.findUnique({ where: { code: v.boutique } });
    const produit = await prisma.produit.findUnique({ where: { slug: v.produit } });
    if (!boutique || !produit) continue;

    await prisma.vehicule.upsert({
      where: { numeroChassis: v.chassis },
      create: {
        boutiqueId: boutique.id,
        produitId: produit.id,
        numeroChassis: v.chassis,
        couleur: v.couleur,
      },
      update: { boutiqueId: boutique.id, produitId: produit.id, couleur: v.couleur },
    });
  }
  console.log(`✓ ${VEHICULES.length} véhicules`);

  const client = await prisma.user.upsert({
    where: { telephone: CLIENT_TEST.telephone },
    create: {
      telephone: CLIENT_TEST.telephone,
      nomAffichage: CLIENT_TEST.nom,
      role: "CLIENT",
      telVerifie: true,
    },
    update: {},
  });
  console.log(`✓ Client de test ${client.telephone}`);

  console.log("\nComptes de connexion (le code OTP s'affiche dans les logs du serveur) :");
  console.log("  Client  77 000 00 00");
  console.log("  Gérant  77 232 02 35  (Thiès — Lazare)");
  console.log("  Gérant  70 367 75 75  (Mbour — Olivier)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
