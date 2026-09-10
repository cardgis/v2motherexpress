"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProduitHome, InventoryHome } from "@/types";
import { money } from "@/lib/formatters";
import { responsiveImage } from "@/lib/img";

type Props = {
  produits: ProduitHome[];
  inventoriesByProductId: Record<string, InventoryHome[]>;
  variant?: "page" | "section";
};

const SpeedIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 12 15.5 8.5M8 12h.01M12 8v.01M16 12h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const RangeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const BatteryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="8" width="15" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M21 11v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="m11 9.5-2 3h2.5l-2 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronLeft = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProductExplorer({ produits, inventoriesByProductId, variant = "page" }: Props) {
  const [index, setIndex] = useState(0);
  const total = produits.length;

  const go = useCallback((i: number) => setIndex(((i % total) + total) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  if (total === 0) return null;

  const p = produits[index];
  const pad = (n: number) => String(n).padStart(2, "0");

  const imgSrc = (p.imageUrl || "/assets/img/product-2.jpg").replace(/^assets\//, "/assets/");

  const inventories = inventoriesByProductId[p.id] ?? [];
  const availableStores = inventories
    .filter((inv) => inv.isAvailable && inv.availableQuantity > 0)
    .map((inv) => inv.store?.name)
    .filter((n): n is string => Boolean(n));
  const availabilityText = !p.estDisponible
    ? "Indisponible"
    : availableStores.length
      ? `Disponible — ${availableStores.join(" · ")}`
      : "Disponible";

  const waRent = `https://wa.me/+221772320235?text=${encodeURIComponent(`Bonjour, je souhaite louer le scooter ${p.nom}. Pouvez-vous me donner les disponibilités ?`)}`;
  const waBuy = `https://wa.me/+221772320235?text=${encodeURIComponent(`Bonjour, je suis intéressé par l'achat du scooter ${p.nom}. Pouvez-vous me donner plus d'informations ?`)}`;

  const rentLabel = p.tarification?.tarif24hFcfa
    ? `Location 24h : ${money(p.tarification.tarif24hFcfa)}`
    : "Location disponible";
  const buyLabel = p.tarification?.prixVenteFcfa
    ? `Achat : ${money(p.tarification.prixVenteFcfa)}`
    : "Prix sur demande";

  return (
    <section className="lme-explorer">
      <div className="lme-explorer__inner">
        <header className="lme-explorer__head">
          <span className="lme-explorer__eyebrow">La Mother Express</span>
          {variant === "section" ? (
            <h2 className="lme-explorer__title">Nos Best-Sellers</h2>
          ) : (
            <>
              <h1 className="lme-explorer__title lme-explorer__title--page">
                Location et vente de scooters électriques au Sénégal
              </h1>
              <p className="lme-explorer__sub">
                Notre flotte REVOO, disponible à Thiès et à Mbour.
              </p>
            </>
          )}
        </header>

        <nav className="lme-tabs" role="tablist" aria-label="Modèles">
          {produits.map((x, i) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={i === index}
              className={`lme-tab${i === index ? " is-active" : ""}`}
              onClick={() => go(i)}
            >
              {x.nom}
            </button>
          ))}
        </nav>

        <div className="lme-stage">
          <div className="lme-viewport">
            <div className="lme-stage__glow" />
            <span className="lme-stage__watermark">{p.nom}</span>
            <span className="lme-stage__badge">{p.nom}</span>
            <span className="lme-stage__count">
              <b>{pad(index + 1)}</b> / {pad(total)}
            </span>
            <span className={`lme-stage__avail${!p.estDisponible ? " is-unavailable" : ""}`}>
              {availabilityText}
            </span>

            {/* key force le re-mount → relance l'animation */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={p.id}
              {...responsiveImage(imgSrc, "(max-width: 900px) 100vw, 60vw")}
              alt={`Scooter électrique ${p.nom}`}
              className="lme-stage__moto is-anim"
            />

            <button className="lme-arrow lme-arrow--prev" onClick={() => go(index - 1)} aria-label="Modèle précédent">
              <ChevronLeft />
            </button>
            <button className="lme-arrow lme-arrow--next" onClick={() => go(index + 1)} aria-label="Modèle suivant">
              <ChevronRight />
            </button>
          </div>

          <div className="lme-info">
            <div className="lme-info__left">
              <p className="lme-info__tagline">Powered by {p.marque}</p>
              <ul className="lme-specs">
                <li className="lme-spec">
                  <span className="lme-spec__icon"><SpeedIcon /></span>
                  <span className="lme-spec__text">
                    <span className="lme-spec__label">Vitesse max</span>
                    <span className="lme-spec__value">{p.vitesseMaxKmh ? `${p.vitesseMaxKmh} km/h` : "—"}</span>
                  </span>
                </li>
                <li className="lme-spec">
                  <span className="lme-spec__icon"><RangeIcon /></span>
                  <span className="lme-spec__text">
                    <span className="lme-spec__label">Autonomie</span>
                    <span className="lme-spec__value">{p.autonomieKm ? `${p.autonomieKm} km` : "—"}</span>
                  </span>
                </li>
                <li className="lme-spec">
                  <span className="lme-spec__icon"><BatteryIcon /></span>
                  <span className="lme-spec__text">
                    <span className="lme-spec__label">Batterie</span>
                    <span className="lme-spec__value">{p.batterie || "—"}</span>
                  </span>
                </li>
              </ul>
            </div>

            <div className="lme-info__right">
              <div className="lme-prices">
                <span className="lme-price--rent">{rentLabel}</span>
                <span className="lme-price--buy">{buyLabel}</span>
              </div>
              <div className="lme-actions">
                <a className="lme-btn lme-btn--primary" href={waRent} target="_blank" rel="noopener noreferrer">
                  Louer <ArrowIcon />
                </a>
                <a className="lme-btn lme-btn--ghost" href={waBuy} target="_blank" rel="noopener noreferrer">
                  Acheter <ArrowIcon />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="lme-dots">
          {produits.map((x, i) => (
            <button
              key={x.id}
              className={`lme-dot${i === index ? " is-active" : ""}`}
              onClick={() => go(i)}
              aria-label={`Aller au modèle ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <style>{`
        .lme-explorer {
          --bg: #ffffff; --bg-soft: #f7f7f7; --ink: #111111; --muted: #6b6b6b;
          --line: rgba(0,0,0,0.09); --accent: #e8a534; --accent-deep: #c9772a;
          font-family: var(--font-body, "Inter", system-ui, sans-serif);
          background: #ffffff;
          color: var(--ink);
          padding: clamp(40px, 6vw, 80px) 20px;
          ${variant === "page" ? "min-height: 100vh;" : ""}
        }
        .lme-explorer__inner { max-width: 1180px; margin: 0 auto; }
        .lme-explorer__head { text-align: center; margin-bottom: 28px; }
        .lme-explorer__eyebrow { display: inline-block; font-size: 0.72rem; letter-spacing: 0.28em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
        .lme-explorer__title { font-family: "Oswald", sans-serif; font-size: clamp(1.9rem, 4.5vw, 3.1rem); font-weight: 700; letter-spacing: -0.02em; margin: 0; color: #111111; }
        /* Titre de page : plus long que "Nos Best-Sellers", on borne la largeur pour garder 2 lignes max */
        .lme-explorer__title--page { font-size: clamp(1.7rem, 3.6vw, 2.6rem); max-width: 20ch; margin-inline: auto; }
        .lme-explorer__sub { font-size: clamp(0.95rem, 1.6vw, 1.05rem); color: #555555; margin: 12px auto 0; max-width: 46ch; }

        .lme-tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 28px; }
        .lme-tab { appearance: none; cursor: pointer; background: transparent; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 9px 20px; font-size: 0.9rem; font-weight: 600; transition: color .25s, border-color .25s, background .25s, box-shadow .25s; }
        .lme-tab:hover { color: var(--ink); border-color: rgba(0,0,0,0.28); }
        .lme-tab.is-active { color: #1a1206; background: linear-gradient(135deg, var(--accent), var(--accent-deep)); border-color: transparent; box-shadow: 0 8px 24px -8px rgba(232,165,52,0.55); }

        .lme-stage { position: relative; background: #ffffff; border: 1px solid var(--line); border-radius: 28px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.06); }
        .lme-viewport { position: relative; width: 100%; height: clamp(360px, 52vw, 560px); display: flex; align-items: center; justify-content: center; background: #ffffff; }
        .lme-stage__glow { display: none; }
        .lme-stage__watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: "Oswald", sans-serif; font-size: clamp(5rem, 18vw, 14rem); font-weight: 800; color: rgba(0,0,0,0.04); letter-spacing: -0.05em; pointer-events: none; user-select: none; white-space: nowrap; }
        .lme-stage__moto { position: relative; z-index: 1; max-width: 95%; max-height: 95%; width: 95%; object-fit: contain; }
        .lme-stage__moto.is-anim { animation: lme-pop .55s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes lme-pop { from { opacity: 0; transform: scale(.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .lme-stage__badge { position: absolute; top: 22px; left: 26px; z-index: 3; font-family: "Oswald", sans-serif; font-size: clamp(1.4rem, 3.5vw, 2.2rem); font-weight: 700; letter-spacing: -0.01em; color: #111111; }
        .lme-stage__count { position: absolute; top: 30px; right: 28px; z-index: 3; font-size: 0.85rem; color: var(--muted); font-weight: 600; }
        .lme-stage__count b { color: var(--accent); }
        .lme-stage__avail { position: absolute; bottom: 22px; left: 26px; z-index: 3; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #16a34a; background: rgba(22,163,74,0.10); border: 1px solid rgba(22,163,74,0.25); border-radius: 999px; padding: 4px 12px; }
        .lme-stage__avail.is-unavailable { color: #dc2626; background: rgba(220,38,38,0.08); border-color: rgba(220,38,38,0.22); }

        .lme-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 4; cursor: pointer; width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.05); border: 1px solid var(--line); color: #111111; transition: background .25s, border-color .25s, transform .15s, color .25s; }
        .lme-arrow:hover { background: linear-gradient(135deg, var(--accent), var(--accent-deep)); color: #1a1206; border-color: transparent; }
        .lme-arrow:active { transform: translateY(-50%) scale(.92); }
        .lme-arrow--prev { left: 18px; }
        .lme-arrow--next { right: 18px; }

        .lme-info { border-top: 1px solid var(--line); padding: clamp(22px, 3.5vw, 36px) clamp(22px, 4vw, 48px); display: grid; grid-template-columns: 1fr auto; gap: 28px; align-items: center; background: #ffffff; }
        .lme-info__left { min-width: 0; }
        .lme-info__tagline { font-family: "Oswald", sans-serif; font-size: clamp(1.2rem, 2.6vw, 1.7rem); font-weight: 600; margin: 0 0 18px; color: #111111; }
        .lme-specs { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 26px 40px; }
        .lme-spec { display: flex; align-items: center; gap: 12px; }
        .lme-spec__icon { color: var(--accent); width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(232,165,52,0.10); border: 1px solid rgba(232,165,52,0.30); flex-shrink: 0; }
        .lme-spec__text { display: flex; flex-direction: column; }
        .lme-spec__label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); }
        .lme-spec__value { font-size: 1.1rem; font-weight: 700; line-height: 1.2; color: #111111; }

        .lme-info__right { display: flex; flex-direction: column; gap: 14px; align-items: flex-end; }
        .lme-prices { display: flex; flex-direction: column; gap: 2px; text-align: right; }
        .lme-price--rent { color: var(--accent-deep); font-weight: 700; font-size: 1.05rem; }
        .lme-price--buy { color: var(--muted); font-weight: 600; font-size: 0.88rem; }

        .lme-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
        .lme-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 999px; font-size: 0.92rem; font-weight: 600; text-decoration: none; transition: transform .15s, background .25s, color .25s, border-color .25s, box-shadow .25s; }
        .lme-btn svg { transition: transform .2s; }
        .lme-btn:hover svg { transform: translateX(3px); }
        .lme-btn--primary { background: linear-gradient(135deg, var(--accent), var(--accent-deep)); color: #1a1206; box-shadow: 0 10px 26px -10px rgba(232,165,52,0.5); }
        .lme-btn--primary:hover { transform: translateY(-2px); }
        .lme-btn--ghost { background: transparent; color: #111111; border: 1px solid rgba(0,0,0,0.22); }
        .lme-btn--ghost:hover { border-color: var(--accent); color: var(--accent-deep); }

        .lme-dots { display: flex; justify-content: center; gap: 8px; margin-top: 22px; }
        .lme-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(0,0,0,0.15); cursor: pointer; border: none; transition: background .25s, width .25s; }
        .lme-dot.is-active { background: var(--accent); width: 22px; border-radius: 999px; }

        @media (max-width: 860px) {
          .lme-info { grid-template-columns: 1fr; }
          .lme-info__right { align-items: stretch; }
          .lme-prices { text-align: left; }
          .lme-actions { justify-content: flex-start; }
          .lme-arrow { width: 44px; height: 44px; }
          .lme-arrow--prev { left: 10px; }
          .lme-arrow--next { right: 10px; }
          .lme-stage__moto { max-width: 96%; width: 96%; }
        }
      `}</style>
    </section>
  );
}
