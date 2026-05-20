import { HomePageContent } from "@/components/HomePageContent";
import { getHomeProductsData } from "@/lib/home-data";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { produits, inventoriesByProductId } = await getHomeProductsData();

  return <HomePageContent produits={produits} inventoriesByProductId={inventoriesByProductId} />;
}
