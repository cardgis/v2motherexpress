import { HomeHeroAbout } from "@/components/HomeHeroAbout";
import ProductExplorer from "@/components/ProductExplorer";
import { HomeFormulesSection } from "@/components/HomeFormulesSection";
import { HomeAccessionSection } from "@/components/HomeAccessionSection";
import { HomeVideosSection } from "@/components/HomeVideosSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { ContactInfoSection } from "@/components/ContactInfoSection";
import { HomeCTASection } from "@/components/HomeCTASection";
import { ScrollReveal } from "@/components/ScrollReveal";
import type { ProduitHome } from "@/types";
import type { BornesTarifs } from "@/lib/home-data";
import "@/styles/accueil.css";

type HomePageContentProps = {
  produits: ProduitHome[];
  /** Modèles actifs au catalogue, annoncés par la section d'appel. */
  nombreModeles: number;
  /** Bornes de prix du catalogue complet, pour les « à partir de ». */
  bornes: BornesTarifs;
};

/**
 * Enchaînement des sections de l'accueil.
 *
 * ── L'ORDRE EST CELUI QU'ALEXANDRE A FIXÉ SUR LA MAQUETTE ─────────────────
 * Best-sellers → formules → accession → comment réserver → modèles →
 * questions → agences → vidéos. Il a notamment avancé « Comment réserver »
 * avant les modèles, en déplaçant les planches lui-même le 2026-11-13.
 *
 * Les sections « Comment réserver » et « Questions fréquentes » n'existent pas
 * encore : elles s'inséreront à leur place, entre l'accession et les agences.
 *
 * `HomePromoSection` a disparu : « Promotion en cours / Offre du moment »
 * présentait en promotion ce qui est le modèle économique de la maison.
 * `HomeAccessionSection` prend sa place et son sujet.
 */
export function HomePageContent({ produits, nombreModeles, bornes }: HomePageContentProps) {
  return (
    <div className="page-home">
      <ScrollReveal />
      <main className="page-main">
        <HomeHeroAbout />
        <ProductExplorer produits={produits} variant="section" />
        <HomeFormulesSection bornes={bornes} />
        <HomeAccessionSection />
        <HomeCTASection nombreModeles={nombreModeles} />
        <ContactInfoSection headingLevel={2} />
        <HomeVideosSection />
      </main>
      <HomeFooterSections />
    </div>
  );
}
