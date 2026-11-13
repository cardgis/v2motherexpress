import { SITE_URL } from "@/lib/site";
import type { ProduitHome } from "@/types";

/**
 * Balisage JSON-LD du catalogue — `ItemList` de `Product`.
 *
 * CE QUI MANQUAIT. `layout.tsx` déclare déjà un `LocalBusiness` complet, avec
 * les deux agences, les téléphones, les horaires et les cartes. Mais aucun
 * PRODUIT n'était balisé, et c'est le balisage produit qui fait apparaître un
 * prix dans un résultat de recherche. Sans lui, Google sait que l'entreprise
 * existe et ignore ce qu'elle vend.
 *
 * AUCUNE DISPONIBILITÉ N'EST DÉCLARÉE, et c'est délibéré. `schema.org` offre
 * `offers.availability`, que tout le monde remplit par réflexe — mais
 * `home-data.ts` interdit depuis le 2026-11-06 d'annoncer une disponibilité,
 * les lignes d'inventaire ayant été inventées par le script d'amorçage.
 * Déclarer `InStock` à Google serait la même faute, en pire : écrite dans un
 * format qu'il indexe et ressort pendant des semaines.
 *
 * Le prix déclaré est le PRIX D'ACHAT. C'est le seul qui se laisse exprimer
 * en une `Offer` : les tarifs de location (demi-journée, journée, 24 h) et la
 * redevance d'accession sont des durées, pas des prix unitaires, et les
 * tordre en `Offer` produirait un prix faux dans les résultats.
 *
 * Ce module ne touche à AUCUNE logique : il lit des lignes déjà chargées pour
 * l'affichage et rend un objet. Rien ne s'exécute à l'écriture.
 */

/** Un champ technique ne devient une propriété que s'il est RENSEIGNÉ. */
function proprietes(p: ProduitHome) {
  const liste: Array<{ "@type": "PropertyValue"; name: string; value: string }> = [];
  const ajouter = (name: string, value: string | number | null | undefined, unite = "") => {
    const brut = typeof value === "string" ? value.trim() : value;
    if (brut === null || brut === undefined || brut === "" || brut === 0) return;
    liste.push({ "@type": "PropertyValue", name, value: `${brut}${unite}` });
  };
  // `moteurType` est vide pour les cinq modèles en base (constaté le
  // 2026-11-13) : il ne sortira donc pas, plutôt qu'une propriété creuse.
  ajouter("Moteur", p.moteurType);
  ajouter("Vitesse maximale", p.vitesseMaxKmh, " km/h");
  ajouter("Autonomie", p.autonomieKm, " km");
  ajouter("Batterie", p.batterie);
  ajouter("Kilomètres inclus", p.tarification?.kmInclus, " km");
  return liste;
}

function produitSchema(p: ProduitHome, position: number) {
  const prix = p.tarification?.prixVenteFcfa ?? null;
  const proprietesTechniques = proprietes(p);

  return {
    "@type": "ListItem" as const,
    position,
    item: {
      "@type": "Product" as const,
      "@id": `${SITE_URL}/produits#${p.slug}`,
      name: p.nom,
      brand: { "@type": "Brand" as const, name: p.marque },
      category: "Scooter électrique",
      url: `${SITE_URL}/produits`,
      ...(p.imageUrl && { image: `${SITE_URL}${p.imageUrl}` }),
      ...(proprietesTechniques.length > 0 && { additionalProperty: proprietesTechniques }),
      // Pas d'`availability` : voir l'en-tête de ce fichier.
      ...(prix !== null && {
        offers: {
          "@type": "Offer" as const,
          price: prix,
          priceCurrency: "XOF",
          url: `${SITE_URL}/produits`,
          seller: { "@id": `${SITE_URL}/#business` },
        },
      }),
    },
  };
}

/**
 * `ItemList` des produits passés, dans l'ordre reçu.
 *
 * L'ordre compte : sur l'accueil, c'est celui de `BEST_SELLER_SLUGS`, donc la
 * sélection de la boutique, et `position` le dit à Google.
 */
export function schemaCatalogue(produits: ProduitHome[], nom: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nom,
    numberOfItems: produits.length,
    itemListElement: produits.map((p, i) => produitSchema(p, i + 1)),
  };
}

/** Le `<script>` à poser dans une page. Sérialisé une seule fois, ici. */
export function jsonLd(schema: object) {
  // `</script>` dans une chaîne fermerait la balise : on neutralise le chevron.
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
