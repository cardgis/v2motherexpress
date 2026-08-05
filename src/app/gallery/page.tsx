import type { Metadata } from "next";
import { GalleryPage } from "@/components/GalleryPage";
import { HomeFooterSections } from "@/components/HomeFooterSections";

export const metadata: Metadata = {
  title: "Galerie Photos",
  description:
    "Découvrez notre univers en images : scooters électriques REVOO en action, balades au Sénégal et vie de nos agences à Thiès et Mbour.",
  alternates: {
    canonical: "/gallery",
  },
  openGraph: {
    title: "Galerie — Scooters Électriques REVOO au Sénégal",
    description:
      "Photos de nos scooters électriques REVOO : E52, B12, A10, A12, C32. Balades et vie de nos agences à Thiès et Mbour.",
    url: "/gallery",
  },
};

export default function Gallery() {
  return (
    <div className="page-wrapper">
      <main className="page-main">
        <GalleryPage />
      </main>
      <HomeFooterSections />
    </div>
  );
}
