import type { Metadata } from "next";
import { ContactInfoSection } from "@/components/ContactInfoSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";

export const metadata: Metadata = {
  title: "Contact · Agences Thiès & Mbour",
  description:
    "Trouvez nos agences à Thiès et Mbour. Appelez-nous, envoyez un email ou venez directement. La Mother Express — votre location de scooter électrique au Sénégal.",
  openGraph: {
    title: "Nos Agences — Thiès & Mbour | La Mother Express",
    description:
      "Agence Thiès : +221 77 232 02 35. Agence Mbour : +221 70 367 75 75. Horaires : Lundi–Vendredi 9h–19h.",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="page-wrapper">
      <main className="page-main">
        <ContactInfoSection />
      </main>
      <HomeFooterSections />
    </div>
  );
}
