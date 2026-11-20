import { HomeHeroAbout } from "@/components/HomeHeroAbout";
import { HomeBestSellersSection } from "@/components/HomeBestSellersSection";
import { HomeGrilleSection } from "@/components/HomeGrilleSection";
import { HomeFormulesSection } from "@/components/HomeFormulesSection";
import { HomeAccessionSection } from "@/components/HomeAccessionSection";
import { HomeParcoursSection } from "@/components/HomeParcoursSection";
import { HomeQuestionsSection } from "@/components/HomeQuestionsSection";
import { HomeVideosSection } from "@/components/HomeVideosSection";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { ContactInfoSection } from "@/components/ContactInfoSection";
import { HomeCTASection } from "@/components/HomeCTASection";
import { ScrollReveal } from "@/components/ScrollReveal";
import type { ProduitHome } from "@/types";
import type { BornesTarifs, LigneGrille } from "@/lib/home-data";

type HomePageContentProps = {
  produits: ProduitHome[];
  /** Modèles actifs au catalogue, annoncés par la section d'appel. */
  nombreModeles: number;
  /** Bornes de prix du catalogue complet, pour les « à partir de ». */
  bornes: BornesTarifs;
  /** La grille de location, lue en base : quatre créneaux par modèle. */
  grille: LigneGrille[];
};

/**
 * Enchaînement des sections de l'accueil.
 *
 * ── L'ORDRE EST CELUI QU'ALEXANDRE A FIXÉ SUR LA MAQUETTE ─────────────────
 * Best-sellers → formules → accession → comment réserver → modèles →
 * questions → agences → vidéos. Il a notamment avancé « Comment réserver »
 * avant les modèles, en déplaçant les planches lui-même le 2026-11-13.
 *
 * « Comment réserver » est posée AVANT les modèles, comme il l'a voulu, et
 * « Questions fréquentes » juste avant les agences : on répond aux objections,
 * puis on dit où venir.
 *
 * `ProductExplorer` quitte l’accueil : il porte le bug d’interactivité SPA
 * documenté dans CLAUDE.md, et le restyler demanderait d’entrer dans son état
 * React pour un gain purement visuel. Une section serveur sans état le
 * remplace ici ; lui continue de servir `/produits`, où son panneau de détail
 * et son carrousel ont toute leur utilité.
 *
 * `HomePromoSection` a disparu : « Promotion en cours / Offre du moment »
 * présentait en promotion ce qui est le modèle économique de la maison.
 * `HomeAccessionSection` prend sa place et son sujet.
 */
export function HomePageContent({ produits, nombreModeles, bornes, grille }: HomePageContentProps) {
  return (
    <div className="page-home">
      <ScrollReveal />
      <main className="page-main">
        <HomeHeroAbout nombreModeles={nombreModeles} bornes={bornes} />
        <HomeBestSellersSection produits={produits} />
        {/* Juste après les trois plus demandés (Alexandre, 2026-11-20) : on
            vient d'y voir trois prix 24 h, c'est le moment où l'on se demande
            « et pour une demi-journée ? ». La réponse est la ligne suivante. */}
        <HomeGrilleSection lignes={grille} />
        <HomeFormulesSection bornes={bornes} />
        <HomeAccessionSection />
        <HomeParcoursSection />
        <HomeQuestionsSection />
        <HomeCTASection nombreModeles={nombreModeles} />
        <ContactInfoSection headingLevel={2} />
        <HomeVideosSection />
      </main>
      <HomeFooterSections />
    </div>
  );
}
