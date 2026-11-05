'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Tarification, ProduitHome } from "@/types";
import { money } from "@/lib/formatters";

type ProductCardProps = {
  product: ProduitHome;
  /** Déjà calculé par l'appelant à partir des stocks par boutique. */
  availabilityText: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function ProductCard({ product, availabilityText, isOpen, onOpen, onClose }: ProductCardProps) {
  const [remoteTarif, setRemoteTarif] = useState<Tarification | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/produits');
        if (!res.ok) return;
        const list: Array<{ id: string; tarification?: Tarification | null }> = await res.json();
        const p = list.find((x) => x.id === product.id);
        if (alive) setRemoteTarif(p?.tarification ?? null);
      } catch {}
    })();
    return () => { alive = false; };
  }, [isOpen, product.id]);

  const imgSrc = (product.imageUrl || "/assets/img/product-2.jpg").replace(/^assets\//, "/assets/");

  const tarif = (key: keyof Tarification) =>
    money((remoteTarif?.[key] ?? product.tarification?.[key]) as number | undefined);

  return (
    <div
      className={`product-item${isOpen ? " is-panel-open" : ""}`}
      style={{ position: "relative", overflow: "visible" }}
    >
      <div className="product-item__head">
        <div>
          <div className="product-item__name">{product.nom}</div>
          <div className="product-item__manufacturer">Powered by {product.marque}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#c79a2a", lineHeight: 1, whiteSpace: "nowrap" }}>
            Location 24h: {money(product.tarification?.tarif24hFcfa)}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 6, whiteSpace: "nowrap" }}>
            Achat: {money(product.tarification?.prixVenteFcfa)}
          </div>
        </div>
      </div>

      <div className="product-item__media uk-inline-clip uk-inline">
        <img src={imgSrc} alt={product.nom} width={800} height={600} loading="lazy" decoding="async" />
        <button
          type="button"
          className="product-item__hover-trigger"
          aria-label={`Afficher les détails de ${product.nom}`}
          onClick={onOpen}
          style={{ position: "absolute", inset: 0, background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
        >
          <span className="product-item__plus" style={{ position: "absolute", left: "50%", top: "50%", width: 72, height: 72, borderRadius: 999, background: "linear-gradient(180deg, #f4d27a 0%, #c79a2a 100%)", boxShadow: "0 16px 40px rgba(0,0,0,.28)", display: "grid", placeItems: "center", color: "#111827" }}>
            <span style={{ fontSize: 34, lineHeight: 1, fontWeight: 900, marginTop: -2 }}>+</span>
          </span>
        </button>
      </div>

      <div className="product-item__info">
        <ul className="list-info">
          <li className="list-info-item"><div className="list-info-item__title">Type</div><div className="list-info-item__value">Électrique</div></li>
          <li className="list-info-item"><div className="list-info-item__title">Marque</div><div className="list-info-item__value">{product.marque}</div></li>
        </ul>
      </div>

      <div className="product-item__specifications">
        <ul className="specifications-list">
          <li className="specifications-list-item"><div className="specifications-list-item__icon"><img src="/assets/img/icons/specifications-1.png" alt="Moteur" /></div><div className="specifications-list-item__desc"><div className="specifications-list-item__title">Moteur</div><div className="specifications-list-item__value">{product.moteurType || "-"}</div></div></li>
          <li className="specifications-list-item"><div className="specifications-list-item__icon"><img src="/assets/img/icons/specifications-2.png" alt="Vitesse" /></div><div className="specifications-list-item__desc"><div className="specifications-list-item__title">Vitesse</div><div className="specifications-list-item__value">{product.vitesseMaxKmh ? `${product.vitesseMaxKmh} km/h` : "-"}</div></div></li>
          <li className="specifications-list-item"><div className="specifications-list-item__icon"><img src="/assets/img/icons/specifications-3.png" alt="Autonomie" /></div><div className="specifications-list-item__desc"><div className="specifications-list-item__title">Autonomie</div><div className="specifications-list-item__value">{product.autonomieKm ? `${product.autonomieKm} km` : "-"}</div></div></li>
          <li className="specifications-list-item"><div className="specifications-list-item__icon"><img src="/assets/img/icons/specifications-4.png" alt="Batterie" /></div><div className="specifications-list-item__desc"><div className="specifications-list-item__title">Batterie</div><div className="specifications-list-item__value">{product.batterie || "-"}</div></div></li>
        </ul>
      </div>

      <div style={{ padding: "0 20px 16px", fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{availabilityText}</div>

      {isOpen && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(4,4,10,.88)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="product-panel">

            {/* ── IMAGE en haut, pleine largeur ── */}
            <div className="product-panel__image">
              <img src={imgSrc} alt={product.nom} />
              <div className="product-panel__image-grad" aria-hidden="true" />
              <button type="button" className="product-panel__close" aria-label="Fermer" onClick={onClose}>×</button>
              <div className="product-panel__image-info">
                <div className="product-panel__image-badge">{product.marque}</div>
                <div className="product-panel__image-avail">{availabilityText}</div>
              </div>
            </div>

            {/* ── CONTENU — flex colonne ── */}
            <div className="product-panel__content">

              {/* En-tête : nom */}
              <div className="product-panel__header">
                <div className="product-panel__eyebrow">Powered by {product.marque}</div>
                <h2 className="product-panel__title">{product.nom}</h2>
              </div>

              {/* Séparateur */}
              <div className="product-panel__sep" aria-hidden="true" />

              {/* ── 3 colonnes — toute la largeur, aucun scroll ── */}
              <div className="product-panel__cols">

                {/* Col 1 : Prix */}
                <div className="product-panel__col">
                  <div className="product-panel__section-title">Tarifs</div>
                  <div className="product-panel__prices">
                    <div className="product-panel__price-main">
                      <div className="product-panel__price-label">Location 24h</div>
                      <div className="product-panel__price-gold">{tarif("tarif24hFcfa")}</div>
                    </div>
                    <div className="product-panel__price-secondary">
                      <div className="product-panel__price-label">Prix d&apos;achat</div>
                      <div className="product-panel__price-white">{tarif("prixVenteFcfa")}</div>
                    </div>
                  </div>
                </div>

                {/* Col 2 : Spécifications */}
                <div className="product-panel__col">
                  <div className="product-panel__section-title">Spécifications</div>
                  <div className="product-panel__specs">
                    <div className="product-panel__spec">
                      <div className="product-panel__spec-label">Type</div>
                      <div className="product-panel__spec-value">Électrique</div>
                    </div>
                    <div className="product-panel__spec">
                      <div className="product-panel__spec-label">Moteur</div>
                      <div className="product-panel__spec-value">{product.moteurType || "—"}</div>
                    </div>
                    <div className="product-panel__spec">
                      <div className="product-panel__spec-label">Vitesse max</div>
                      <div className="product-panel__spec-value">{product.vitesseMaxKmh ? `${product.vitesseMaxKmh} km/h` : "—"}</div>
                    </div>
                    <div className="product-panel__spec">
                      <div className="product-panel__spec-label">Autonomie</div>
                      <div className="product-panel__spec-value">{product.autonomieKm ? `${product.autonomieKm} km` : "—"}</div>
                    </div>
                    {product.batterie && (
                      <div className="product-panel__spec" style={{ gridColumn: "1 / -1" }}>
                        <div className="product-panel__spec-label">Batterie</div>
                        <div className="product-panel__spec-value">{product.batterie}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 3 : Tarifs location + km + CTA */}
                <div className="product-panel__col product-panel__col--cta">
                  <div>
                    <div className="product-panel__section-title">Tarifs de location</div>
                    <div className="product-tariffs-grid">
                      <div className="product-panel__tariff">
                        <div className="product-panel__tariff-label">Matin</div>
                        <div className="product-panel__tariff-sub">9h – 14h</div>
                        <div className="product-panel__tariff-value">{tarif("tarifMatinFcfa")}</div>
                      </div>
                      <div className="product-panel__tariff">
                        <div className="product-panel__tariff-label">Après-midi</div>
                        <div className="product-panel__tariff-sub">14h – 19h</div>
                        <div className="product-panel__tariff-value">{tarif("tarifApresMidiFcfa")}</div>
                      </div>
                      <div className="product-panel__tariff">
                        <div className="product-panel__tariff-label">Journée</div>
                        <div className="product-panel__tariff-sub">9h – 19h</div>
                        <div className="product-panel__tariff-value">{tarif("tarifJourneeFcfa")}</div>
                      </div>
                      <div className="product-panel__tariff product-panel__tariff--highlight">
                        <div className="product-panel__tariff-label">24h ★</div>
                        <div className="product-panel__tariff-sub">Toute la journée</div>
                        <div className="product-panel__tariff-value">{tarif("tarif24hFcfa")}</div>
                      </div>
                    </div>
                  </div>

                  <div className="product-panel__km">
                    {(remoteTarif?.kmInclus ?? product.tarification?.kmInclus) != null && (
                      <span>{remoteTarif?.kmInclus ?? product.tarification?.kmInclus} km inclus</span>
                    )}
                    {(remoteTarif?.tarifKmSupplementaire ?? product.tarification?.tarifKmSupplementaire) != null && (
                      <span>{money((remoteTarif?.tarifKmSupplementaire ?? product.tarification?.tarifKmSupplementaire) as number)} / 10 km suppl.</span>
                    )}
                  </div>

                  <a
                    href={`https://wa.me/+221772320235?text=${encodeURIComponent(`Bonjour, je suis intéressé par le scooter ${product.nom}. Pouvez-vous me donner plus d'informations ?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="product-panel__cta-btn"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path fill="currentColor" d="M12.04 2.003a9.94 9.94 0 0 0-8.49 15.16L2 22l4.97-1.5a9.96 9.96 0 0 0 4.88 1.25h.01A9.94 9.94 0 0 0 21.99 12.04 9.95 9.95 0 0 0 12.04 2.003zm5.8 14.11c-.24.68-1.42 1.31-1.95 1.38-.5.07-1.14.1-1.84-.12-.42-.13-.96-.31-1.66-.61-2.93-1.27-4.83-4.22-4.97-4.41-.14-.2-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.56-.36.75-.36h.54c.17 0 .41-.07.64.48.24.58.81 2.01.88 2.16.07.15.12.33.02.52-.1.19-.15.31-.3.48-.15.17-.32.38-.46.51-.15.15-.31.3-.13.62.18.32.8 1.32 1.71 2.14 1.17 1.04 2.16 1.36 2.48 1.51.32.15.5.13.69-.08.19-.2.82-.96 1.05-1.29.23-.32.47-.26.78-.15.31.1 1.96.92 2.29 1.09.33.17.55.26.63.4.08.14.08.83-.16 1.51z" />
                    </svg>
                    Réserver via WhatsApp
                  </a>
                </div>

              </div>{/* fin .product-panel__cols */}
            </div>{/* fin .product-panel__content */}
          </div>{/* fin .product-panel */}
        </div>,
        document.body
      )}
    </div>
  );
}
