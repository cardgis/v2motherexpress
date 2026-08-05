import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";
import { getHomeProductsData } from "@/lib/home-data";

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
  const { produits, inventoriesByProductId } = await getHomeProductsData();

  return <HomePageContent produits={produits} inventoriesByProductId={inventoriesByProductId} />;
}
