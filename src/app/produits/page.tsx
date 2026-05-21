import ProductExplorer from "@/components/ProductExplorer";
import { HomeFooterSections } from "@/components/HomeFooterSections";
import { getAllProductsData } from "@/lib/home-data";

export const dynamic = 'force-dynamic';

export default async function ProduitsPage() {
  const { produits, inventoriesByProductId } = await getAllProductsData();

  return (
    <div className="page-home">
      <main className="page-main">
        <ProductExplorer produits={produits} inventoriesByProductId={inventoriesByProductId} />
      </main>
      <HomeFooterSections />
    </div>
  );
}
