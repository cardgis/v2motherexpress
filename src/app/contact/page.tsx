import type { Metadata } from "next";
import { ContactInfoSection } from "@/components/ContactInfoSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";

export const metadata: Metadata = {
  title: "Contact — La Mother Express",
  description: "Contactez nos agences à Mbour et Thiès pour louer ou acheter votre scooter.",
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
