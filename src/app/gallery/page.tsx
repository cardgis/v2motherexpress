import type { Metadata } from "next";
import { GalleryPage } from "@/components/GalleryPage";
import { HomeFooterSections } from "@/components/HomeFooterSections";

export const metadata: Metadata = {
  title: "Galerie — La Mother Express",
  description: "Découvrez notre univers en images : scooters électriques, balades et vie de l'agence au Sénégal.",
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
