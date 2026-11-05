import dotenv from "dotenv";
import { Pool } from "pg";

// Même priorité que prisma.config.ts : la base locale d'abord.
dotenv.config({ path: [".env.local", ".env"] });
import { randomUUID, randomBytes, scryptSync } from "crypto";

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const produits = [
  {
    slug: "revoo-a10",
    nom: "Revoo A10",
    marque: "REVOO",
    modele: "A10",
    categorie: 'ELECTRIQUE',
    moteurType: "",
    batterie: "48V 21Ah Plomb-acide",
    vitesseMaxKmh: 40,
    autonomieKm: 60,
    stockTotal: 5,
    stockDisponible: 5,
    estDisponible: true,
    imageUrl: "/assets/img/A10.png",
    images: [],
    tarification: {
      prixVenteFcfa: 410000,
      moratoireActif: false,
      moratoireAcompte: null,
      moratoireSolde: null,
      moratoireDureeEnMois: 4,
      kmInclus: 60,
      tarifKmSupplementaire: 1000,
      tarifMatinFcfa: 2000,
      tarifApresMidiFcfa: 2000,
      tarifJourneeFcfa: 3000,
      tarif24hFcfa: 4000,
      rachatMontantJournalier: 5000,
      rachatNombreJours: 730,
      rachatMontantTotal: 3650000,
    },
  },
  {
    slug: "revoo-a12",
    nom: "Revoo A12",
    marque: "REVOO",
    modele: "A12",
    categorie: 'ELECTRIQUE',
    moteurType: "",
    batterie: "60V 21Ah Plomb-acide",
    vitesseMaxKmh: 50,
    autonomieKm: 60,
    stockTotal: 5,
    stockDisponible: 5,
    estDisponible: true,
    imageUrl: "/assets/img/A12.png",
    images: [],
    tarification: {
      prixVenteFcfa: 520000,
      moratoireActif: false,
      moratoireAcompte: null,
      moratoireSolde: null,
      moratoireDureeEnMois: 4,
      kmInclus: 70,
      tarifKmSupplementaire: 1000,
      tarifMatinFcfa: 2250,
      tarifApresMidiFcfa: 2250,
      tarifJourneeFcfa: 3500,
      tarif24hFcfa: 5000,
      rachatMontantJournalier: 5000,
      rachatNombreJours: 730,
      rachatMontantTotal: 3650000,
    },
  },
  {
    slug: "revoo-c32",
    nom: "Revoo C32",
    marque: "REVOO",
    modele: "C32",
    categorie: 'ELECTRIQUE',
    moteurType: "",
    batterie: "72V 26Ah Plomb-acide",
    vitesseMaxKmh: 60,
    autonomieKm: 80,
    stockTotal: 5,
    stockDisponible: 5,
    estDisponible: true,
    imageUrl: "/assets/img/C32.png",
    images: [],
    tarification: {
      prixVenteFcfa: 650000,
      moratoireActif: false,
      moratoireAcompte: null,
      moratoireSolde: null,
      moratoireDureeEnMois: 4,
      kmInclus: 80,
      tarifKmSupplementaire: 1000,
      tarifMatinFcfa: 3000,
      tarifApresMidiFcfa: 3000,
      tarifJourneeFcfa: 5000,
      tarif24hFcfa: 6500,
      rachatMontantJournalier: 5000,
      rachatNombreJours: 730,
      rachatMontantTotal: 3650000,
    },
  },
  {
    slug: "revoo-b12",
    nom: "Revoo B12",
    marque: "REVOO",
    modele: "B12",
    categorie: 'ELECTRIQUE',
    moteurType: "",
    batterie: "",
    vitesseMaxKmh: 60,
    autonomieKm: 140,
    stockTotal: 5,
    stockDisponible: 5,
    estDisponible: true,
    imageUrl: "/assets/img/B12.png",
    images: [],
    tarification: {
      prixVenteFcfa: 860000,
      moratoireActif: true,
      moratoireAcompte: 516000,
      moratoireSolde: 344000,
      moratoireDureeEnMois: 4,
      kmInclus: 100,
      tarifKmSupplementaire: 1000,
      tarifMatinFcfa: 3500,
      tarifApresMidiFcfa: 3500,
      tarifJourneeFcfa: 7000,
      tarif24hFcfa: 10000,
      rachatMontantJournalier: 5000,
      rachatNombreJours: 730,
      rachatMontantTotal: 3650000,
    },
  },
  {
    slug: "revoo-e52",
    nom: "Revoo E52",
    marque: "REVOO",
    modele: "E52",
    categorie: 'ELECTRIQUE',
    moteurType: "",
    batterie: "96V 35Ah Graphène",
    vitesseMaxKmh: 80,
    autonomieKm: 120,
    stockTotal: 5,
    stockDisponible: 5,
    estDisponible: true,
    imageUrl: "/assets/img/E52.png",
    images: [],
    tarification: {
      prixVenteFcfa: 970000,
      moratoireActif: false,
      moratoireAcompte: null,
      moratoireSolde: null,
      moratoireDureeEnMois: 4,
      kmInclus: 100,
      tarifKmSupplementaire: 1000,
      tarifMatinFcfa: 5000,
      tarifApresMidiFcfa: 5000,
      tarifJourneeFcfa: 10000,
      tarif24hFcfa: 15000,
      rachatMontantJournalier: 5000,
      rachatNombreJours: 730,
      rachatMontantTotal: 3650000,
    },
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query('DELETE FROM "Inventory"');
    await client.query('DELETE FROM "AdminUser"');
    await client.query('DELETE FROM "Store"');
    await client.query('DELETE FROM "Location"');
    await client.query('DELETE FROM "Vente"');
    await client.query('DELETE FROM "Tarification"');
    await client.query('DELETE FROM "Produit"');
    await client.query('DELETE FROM "Accessoire"');

    const stores = [
      { id: randomUUID(), slug: "mbour", name: "La Mother Express Mbour", city: "Mbour" },
      { id: randomUUID(), slug: "thies", name: "La Mother Express Thiès", city: "Thiès" },
    ];

    for (const store of stores) {
      await client.query(
        `INSERT INTO "Store" ("id","slug","name","city","isActive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
        [store.id, store.slug, store.name, store.city, true]
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL ?? "lamotherexpress@gmail.com";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "Express.2026";
    await client.query(
      `INSERT INTO "AdminUser" ("id","email","name","passwordHash","role","isActive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
      [randomUUID(), adminEmail, "Admin principal", hashPassword(adminPassword), "ADMIN", true]
    );

    await client.query(
      `INSERT INTO "Accessoire" ("id","nom","prixAchatFcfa","tarifLocationDemi","tarifLocationJournee","tarifLocation24h","stock","estDisponible") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), "Casque", 20000, 500, 1000, 1000, 20, true]
    );

    for (const produit of produits) {
      const produitId = randomUUID();
      await client.query(
        `INSERT INTO "Produit" ("id","slug","nom","marque","modele","moteurType","batterie","categorie","annee","vitesseMaxKmh","autonomieKm","stockTotal","stockDisponible","estDisponible","imageUrl","images","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())`,
        [
          produitId,
          produit.slug,
          produit.nom,
          produit.marque,
          produit.modele,
          produit.moteurType ?? null,
          produit.batterie ?? null,
          produit.categorie,
          "annee" in produit && typeof produit.annee === "number" ? produit.annee : 2024,
          produit.vitesseMaxKmh,
          produit.autonomieKm,
          produit.stockTotal,
          produit.stockDisponible,
          produit.estDisponible,
          produit.imageUrl,
          produit.images,
        ]
      );

      if (produit.tarification) {
        await client.query(
          `INSERT INTO "Tarification" ("id","produitId","prixVenteFcfa","moratoireActif","moratoireAcompte","moratoireSolde","moratoireDureeEnMois","kmInclus","tarifKmSupplementaire","tarifMatinFcfa","tarifApresMidiFcfa","tarifJourneeFcfa","tarif24hFcfa","rachatMontantJournalier","rachatNombreJours","rachatMontantTotal","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())`,
          [
            randomUUID(),
            produitId,
            produit.tarification.prixVenteFcfa,
            produit.tarification.moratoireActif,
            produit.tarification.moratoireAcompte,
            produit.tarification.moratoireSolde,
            produit.tarification.moratoireDureeEnMois,
            produit.tarification.kmInclus,
            produit.tarification.tarifKmSupplementaire,
            produit.tarification.tarifMatinFcfa,
            produit.tarification.tarifApresMidiFcfa,
            produit.tarification.tarifJourneeFcfa,
            produit.tarification.tarif24hFcfa,
            produit.tarification.rachatMontantJournalier,
            produit.tarification.rachatNombreJours,
            produit.tarification.rachatMontantTotal,
          ]
        );
      }

      const inventoryRows = [
        { storeId: stores[0].id, totalQuantity: 3, availableQuantity: 3 },
        { storeId: stores[1].id, totalQuantity: 2, availableQuantity: 2 },
      ];

      for (const inventory of inventoryRows) {
        await client.query(
          `INSERT INTO "Inventory" ("id","produitId","storeId","totalQuantity","availableQuantity","isAvailable","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
          [randomUUID(), produitId, inventory.storeId, inventory.totalQuantity, inventory.availableQuantity, true]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`Seed completed: inserted products, stores and admin ${adminEmail}.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
