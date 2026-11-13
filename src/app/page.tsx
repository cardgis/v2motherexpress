import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";
import { getHomeProductsData } from "@/lib/home-data";
import { jsonLd, schemaCatalogue } from "@/lib/seo/catalogue";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Location & Vente de Scooters Électriques REVOO au Sénégal",
  description:
    "Louez ou achetez un scooter électrique REVOO dès aujourd'hui. Agences à Thiès et Mbour. Autonomie jusqu'à 140 km, livraison possible. Réservez en quelques minutes.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "La Mother Express — Scooters Électriques REVOO, Thiès & Mbour",
    description:
      "Louez ou achetez un scooter électrique REVOO. Disponible à Thiès et Mbour. Réservez via WhatsApp en quelques minutes.",
    url: "/",
  },
};

export default async function Home() {
  const { produits, nombreModeles } = await getHomeProductsData();

  return (
    <>
      {/*
        Balisage des produits mis en avant. `layout.tsx` déclare déjà
        l'entreprise et ses deux agences ; celui-ci dit ce qu'elle VEND, avec
        les prix — c'est ce qui les fait apparaître dans un résultat de
        recherche. Aucune disponibilité n'est déclarée : voir
        `lib/seo/catalogue.ts`. Rien d'autre ne change sur la page.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(schemaCatalogue(produits, "Nos best-sellers")),
        }}
      />
      <HomePageContent
        produits={produits}
        nombreModeles={nombreModeles}
      />
    </>
  );
}
