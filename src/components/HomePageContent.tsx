import { HomeHeroAbout } from "@/components/HomeHeroAbout";
import ProductExplorer from "@/components/ProductExplorer";
import { HomeVideosSection } from "@/components/HomeVideosSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { ContactInfoSection } from "@/components/ContactInfoSection";
import { HomeCTASection } from "@/components/HomeCTASection";
import { ScrollReveal } from "@/components/ScrollReveal";

type HomePageContentProps = {
  produits: Array<any>;
  inventoriesByProductId: Record<string, Array<any>>;
};

export function HomePageContent({ produits, inventoriesByProductId }: HomePageContentProps) {
  return (
    <div className="page-home">
      <ScrollReveal />
      <main className="page-main">
        <HomeHeroAbout />
        <ProductExplorer produits={produits} inventoriesByProductId={inventoriesByProductId} variant="section" />
        <ContactInfoSection />
        <HomeVideosSection />
        <HomeCTASection />
      </main>
      <HomeFooterSections />
    </div>
  );
}
