import type { Metadata } from "next";
import { AboutContent } from "@/components/AboutContent";
import { HomeFooterSections } from "@/components/HomeFooterSections";

export const metadata: Metadata = {
  title: "Notre Histoire — La Mother Express",
  description: "La Mother Express, c'est une femme, une table, et l'envie d'aller plus loin — sur deux roues électriques au Sénégal.",
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
