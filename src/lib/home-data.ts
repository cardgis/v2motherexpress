import { prisma } from "@/lib/prisma";

export async function getHomeProductsData() {
  const [produits, inventories] = await Promise.all([
    prisma.produit.findMany({
      include: { tarification: true },
      orderBy: [{ createdAt: "desc" }, { slug: "asc" }],
      take: 3,
    }),
    prisma.inventory.findMany({
      include: { store: true },
      orderBy: [{ produitId: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const inventoriesByProductId = inventories.reduce<Record<string, typeof inventories>>((acc, inventory) => {
    if (!acc[inventory.produitId]) acc[inventory.produitId] = [];
    acc[inventory.produitId].push(inventory);
    return acc;
  }, {});

  return { produits, inventoriesByProductId };
}

export async function getAllProductsData() {
  const [produits, inventories] = await Promise.all([
    prisma.produit.findMany({
      include: { tarification: true },
      orderBy: [{ createdAt: "desc" }, { slug: "asc" }],
    }),
    prisma.inventory.findMany({
      include: { store: true },
      orderBy: [{ produitId: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const inventoriesByProductId = inventories.reduce<Record<string, typeof inventories>>((acc, inventory) => {
    if (!acc[inventory.produitId]) acc[inventory.produitId] = [];
    acc[inventory.produitId].push(inventory);
    return acc;
  }, {});

  return { produits, inventoriesByProductId };
}
