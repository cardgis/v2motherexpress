import { prisma } from "@/lib/prisma";

const BEST_SELLER_SLUGS = ["revoo-e52", "revoo-b12", "revoo-a10"];

export async function getHomeProductsData() {
  const [produits, inventories, nombreModeles] = await Promise.all([
    prisma.produit.findMany({
      where: { slug: { in: BEST_SELLER_SLUGS } },
      include: { tarification: true },
    }),
    prisma.inventory.findMany({
      include: { store: true },
      orderBy: [{ produitId: "asc" }, { createdAt: "asc" }],
    }),
    // Nombre réel de modèles au catalogue : l'accueil n'en montre qu'une
    // sélection, le texte d'appel annonce la gamme complète.
    prisma.produit.count({ where: { estActif: true } }),
  ]);

  const ordered = BEST_SELLER_SLUGS
    .map((s) => produits.find((p) => p.slug === s))
    .filter((p): p is typeof produits[0] => Boolean(p));

  const inventoriesByProductId = inventories.reduce<Record<string, typeof inventories>>((acc, inventory) => {
    if (!acc[inventory.produitId]) acc[inventory.produitId] = [];
    acc[inventory.produitId].push(inventory);
    return acc;
  }, {});

  return { produits: ordered, inventoriesByProductId, nombreModeles };
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
