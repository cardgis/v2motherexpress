'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductCard } from "./ProductCard";
import type { ProduitHome, InventoryHome } from "@/types";

type HomeProductsSectionProps = {
  produits: ProduitHome[];
  inventoriesByProductId: Record<string, InventoryHome[]>;
};

export function HomeProductsSection({ produits, inventoriesByProductId }: HomeProductsSectionProps) {
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const router = useRouter();

  // Recharge les données dès que l'onglet reprend le focus (ex: retour depuis l'admin)
  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [router]);

  // Bloque le scroll de la page quand un panel est ouvert
  useEffect(() => {
    document.body.style.overflow = openProductId ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [openProductId]);

  return (
    <div id="catalogue" className="section-products">
      <div className="uk-section-large uk-container">
        <div
          className="section-title uk-text-center"
          data-reveal
        >
          <span>Emmener les balades à un niveau supérieur</span>
          <h3 className="uk-h2">Notre flotte REVOO</h3>
          <span className="section-title-bar" />
        </div>
        <div className="section-content">
          <div
            className="uk-text-center uk-margin-medium-bottom"
            data-reveal
            style={{ '--reveal-delay': '0.12s' } as React.CSSProperties}
          >
            <p>Des scooters électriques adaptés à chaque besoin, du modèle urbain au véhicule sportif.<br /> Location flexible ou achat avec financement disponible à Dakar, Mbour et Thiès.</p>
          </div>
          <div className="products-card-grid">
            {produits.map((product, index) => {
              const productInventories = inventoriesByProductId[product.id] ?? [];
              const availableStores = productInventories
                .filter((inventory) => inventory.isAvailable && inventory.availableQuantity > 0)
                .map((inventory) => inventory.store?.name)
                .filter((name): name is string => Boolean(name));

              const availabilityText = !product.estDisponible
                ? "Indisponible"
                : availableStores.length
                  ? `Disponible à ${availableStores.join(" · ")}`
                  : "Disponible";

              return (
                <div
                  key={product.id}
                  data-reveal
                  style={{ '--reveal-delay': `${Math.min(index * 0.12, 0.48)}s` } as React.CSSProperties}
                >
                  <ProductCard
                    product={product}
                    availabilityText={availabilityText}
                    inventories={productInventories}
                    isOpen={openProductId === product.id}
                    onOpen={() => setOpenProductId(product.id)}
                    onClose={() => setOpenProductId(null)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
