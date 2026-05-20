import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, getAdminSessionByToken, parseCookieValue } from "@/lib/admin-auth";
import ProductAdminPanel from "@/components/ProductAdminPanel";

export default async function AdminCataloguePage() {
  const headersList = await headers();

  const adminToken = parseCookieValue(headersList.get("cookie"), ADMIN_SESSION_COOKIE);
  const admin = await getAdminSessionByToken(adminToken);

  if (!admin) {
    redirect("/admin/login");
  }

  const [produits, stores] = await Promise.all([
    prisma.produit.findMany({
      include: {
        tarification: true,
        inventories: {
          include: {
            store: true,
          },
          orderBy: {
            store: {
              name: "asc",
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { slug: "asc" }],
    }),
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="page-wrapper">
      <main className="page-main">
        <div className="uk-section-large uk-container">
          <div className="section-title uk-text-center">
            <h3 className="uk-h2">Gestion du catalogue scooters</h3>
          </div>

          <div className="section-content">
            <div className="uk-text-center uk-margin-medium-bottom">
              <p>Ajouter, modifier, supprimer et gérer le stock des produits directement depuis cette page.</p>
            </div>

            <ProductAdminPanel initialProducts={produits} stores={stores} />
          </div>
        </div>
      </main>
    </div>
  );
}
