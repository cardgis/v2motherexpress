import { HomeHeroAbout } from "@/components/HomeHeroAbout";
import ProductExplorer from "@/components/ProductExplorer";
import { HomeVideosSection } from "@/components/HomeVideosSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { ContactInfoSection } from "@/components/ContactInfoSection";
import { HomeCTASection } from "@/components/HomeCTASection";
import { HomePromoSection } from "@/components/HomePromoSection";
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
        <HomePromoSection />
        <ProductExplorer produits={produits} inventoriesByProductId={inventoriesByProductId} variant="section" />
        <HomeCTASection />
        <ContactInfoSection headingLevel={2} />
        <HomeVideosSection />
      </main>
      <HomeFooterSections />
    </div>
  );
}
