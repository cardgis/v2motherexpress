import { prisma } from "@/lib/prisma";

const BEST_SELLER_SLUGS = ["revoo-e52", "revoo-b12", "revoo-a10"];

/**
 * Données du catalogue pour la vitrine.
 *
 * ── La disponibilité n'est plus affichée (2026-11-06) ──────────────────────
 * Ces fonctions interrogeaient `Inventory` pour annoncer « Disponible à Thiès
 * · Mbour ». Deux raisons de l'avoir retiré, et la seconde est la vraie.
 *
 * D'abord parce que c'était faux : ces lignes d'inventaire viennent du script
 * d'amorçage, qui les a inventées. Elles nommaient des boutiques héritées du
 * site V1, sans rapport avec la flotte que les gérants entretiennent.
 *
 * Ensuite parce que c'est `Vehicule` qui détient la vérité — il porte
 * `boutiqueId`, `produitId` et `statut`, avec les index qu'il faut. Le jour où
 * la flotte réelle sera saisie, la disponibilité se recomposera à partir
 * d'elle : une seule source, celle que le métier met à jour.
 *
 * En attendant, la vitrine présente le catalogue sans rien promettre, et c'est
 * la réservation puis le retrait qui tranchent. Une analyse complète de
 * `Inventory` avec jointure disparaît au passage, à chaque affichage.
 */
/**
 * Bornes de prix du catalogue COMPLET.
 *
 * La section « Trois façons de rouler » annonce des « à partir de ». Les
 * calculer sur les trois best-sellers donnerait un chiffre juste par hasard —
 * parce que l'A10 et l'E52 s'y trouvent aujourd'hui — et faux le jour où la
 * sélection change. Un agrégat sur toute la `Tarification` répond exactement,
 * en une requête et sans charger les lignes.
 */
async function bornesTarifs() {
  const r = await prisma.tarification.aggregate({
    where: { produit: { estActif: true } },
    _min: {
      tarifMatinFcfa: true,
      tarifJourneeFcfa: true,
      tarif24hFcfa: true,
      prixVenteFcfa: true,
    },
    _max: { prixVenteFcfa: true },
  });

  return {
    demiJourneeMin: r._min.tarifMatinFcfa,
    journeeMin: r._min.tarifJourneeFcfa,
    vingtQuatreMin: r._min.tarif24hFcfa,
    achatMin: r._min.prixVenteFcfa,
    achatMax: r._max.prixVenteFcfa,
  };
}

export type BornesTarifs = Awaited<ReturnType<typeof bornesTarifs>>;

export async function getHomeProductsData() {
  const [produits, nombreModeles, bornes] = await Promise.all([
    prisma.produit.findMany({
      where: { slug: { in: BEST_SELLER_SLUGS } },
      include: { tarification: true },
    }),
    // Nombre réel de modèles au catalogue : l'accueil n'en montre qu'une
    // sélection, le texte d'appel annonce la gamme complète.
    prisma.produit.count({ where: { estActif: true } }),
    bornesTarifs(),
  ]);

  const ordered = BEST_SELLER_SLUGS
    .map((s) => produits.find((p) => p.slug === s))
    .filter((p): p is typeof produits[0] => Boolean(p));

  return { produits: ordered, nombreModeles, bornes };
}

export async function getAllProductsData() {
  const produits = await prisma.produit.findMany({
    include: { tarification: true },
    orderBy: [{ createdAt: "desc" }, { slug: "asc" }],
  });

  return { produits };
}
