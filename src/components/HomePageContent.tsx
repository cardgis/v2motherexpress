import { HomeHeroAbout } from "@/components/HomeHeroAbout";
import ProductExplorer from "@/components/ProductExplorer";
import { HomeVideosSection } from "@/components/HomeVideosSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { ContactInfoSection } from "@/components/ContactInfoSection";
import { HomeCTASection } from "@/components/HomeCTASection";
import { HomePromoSection } from "@/components/HomePromoSection";
import { ScrollReveal } from "@/components/ScrollReveal";
import type { InventoryHome, ProduitHome } from "@/types";
import "@/styles/accueil.css";

type HomePageContentProps = {
  produits: ProduitHome[];
  inventoriesByProductId: Record<string, InventoryHome[]>;
  /** Modèles actifs au catalogue, annoncés par la section d'appel. */
  nombreModeles: number;
};

export function HomePageContent({ produits, inventoriesByProductId, nombreModeles }: HomePageContentProps) {
  return (
    <div className="page-home">
      <ScrollReveal />
      <main className="page-main">
        <HomeHeroAbout />
        <HomePromoSection />
        <ProductExplorer produits={produits} inventoriesByProductId={inventoriesByProductId} variant="section" />
        <HomeCTASection nombreModeles={nombreModeles} />
        <ContactInfoSection headingLevel={2} />
        <HomeVideosSection />
      </main>
      <HomeFooterSections />
    </div>
  );
}
