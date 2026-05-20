import { HomeHeroAbout } from "@/components/HomeHeroAbout";
import { HomeMiddleSections } from "@/components/HomeMiddleSections";
import { HomeProductsSection } from "@/components/HomeProductsSection";
import { HomeVideosSection } from "@/components/HomeVideosSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { ContactInfoSection } from "@/components/ContactInfoSection";
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
        <HomeProductsSection produits={produits} inventoriesByProductId={inventoriesByProductId} />
        <ContactInfoSection />
        <HomeVideosSection />
        <HomeMiddleSections />
      </main>
      <HomeFooterSections />
    </div>
  );
}
