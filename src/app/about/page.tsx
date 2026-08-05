import type { Metadata } from "next";
import { AboutContent } from "@/components/AboutContent";
import { HomeFooterSections } from "@/components/HomeFooterSections";

export const metadata: Metadata = {
  title: "Notre Histoire",
  description:
    "La Mother Express, c'est une femme, une table, et l'envie d'aller plus loin — sur deux roues électriques au Sénégal. Découvrez notre histoire et notre mission pour une mobilité durable.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "Notre Histoire — La Mother Express",
    description:
      "Une entreprise née au Sénégal pour rendre la mobilité électrique accessible à tous. Partenaire officiel REVOO à Thiès et Mbour.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <div className="page-wrapper">
      <main className="page-main">
        <AboutContent />
      </main>
      <HomeFooterSections />
    </div>
  );
}
