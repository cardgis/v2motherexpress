import type { Metadata } from "next";
import ProductExplorer from "@/components/ProductExplorer";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { getAllProductsData } from "@/lib/home-data";
import { jsonLd, schemaCatalogue } from "@/lib/seo/catalogue";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Catalogue Scooters Électriques REVOO",
  description:
    "Découvrez toute la gamme de scooters électriques REVOO disponibles à la location et à la vente au Sénégal : E52, B12, A10, A12, C32. Tarifs, autonomie et caractéristiques techniques.",
  alternates: {
    canonical: "/produits",
  },
  openGraph: {
    title: "Catalogue REVOO — Scooters Électriques à Louer ou Acheter au Sénégal",
    description:
      "Gamme complète REVOO : E52, B12, A10, A12, C32. Location à la journée ou achat. Thiès & Mbour.",
    url: "/produits",
  },
};

export default async function ProduitsPage() {
  const { produits } = await getAllProductsData();

  return (
    <div className="page-home">
      {/* Même balisage que l'accueil, sur la gamme complète cette fois. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(schemaCatalogue(produits, "Catalogue REVOO")),
        }}
      />
      <main className="page-main">
        <ProductExplorer produits={produits} />
      </main>
      <HomeFooterSections />
    </div>
  );
}
