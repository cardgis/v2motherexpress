'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { responsiveImage } from '@/lib/img';

// Vignettes : 3 colonnes desktop (dont certaines sur 2), 2 en tablette, 1 en mobile.
const THUMB_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 66vw';

const IMAGES = [
  { thumb: '/assets/img/header1.png',  full: '/assets/img/header1.png',  span: 2, alt: 'Scooter électrique REVOO en balade au Sénégal — La Mother Express' },
  { thumb: '/assets/img/header2.jpg',  full: '/assets/img/header2.jpg',  span: 1, alt: 'Partenaire officiel REVOO Sénégal — flotte de scooters électriques' },
  { thumb: '/assets/img/header3.jpg',  full: '/assets/img/header3.jpg',  span: 1, alt: 'Location de scooter électrique à Thiès et Mbour — La Mother Express' },
  { thumb: '/assets/img/E52.png',      full: '/assets/img/E52.png',      span: 2, alt: 'Scooter électrique REVOO E52 — disponible à la location et à la vente au Sénégal' },
  { thumb: '/assets/img/gallery1.png',  full: '/assets/img/gallery1.png',  span: 2, alt: 'La Mother Express — scooters électriques REVOO au Sénégal' },
  { thumb: '/assets/img/gallery2.png',  full: '/assets/img/gallery2.png',  span: 1, alt: 'La Mother Express — agence de location de scooters électriques' },
  { thumb: '/assets/img/A12.png',      full: '/assets/img/A12.png',      span: 2, alt: 'Scooter électrique REVOO A12 — performant et silencieux' },
  { thumb: '/assets/img/C32.png',      full: '/assets/img/C32.png',      span: 1, alt: 'Scooter électrique REVOO C32 — haut de gamme, location Thiès et Mbour' },
];

export function GalleryPage() {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const close = useCallback(() => setLightbox(null), []);
  const prev = useCallback(() => setLightbox(i => i === null ? null : (i - 1 + IMAGES.length) % IMAGES.length), []);
  const next = useCallback(() => setLightbox(i => i === null ? null : (i + 1) % IMAGES.length), []);

  useEffect(() => {
    if (lightbox === null) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, close, prev, next]);

  return (
    <>
      {/* ── Hero ── */}
      <section className="gallery-hero">
        <div className="gallery-hero__bg" aria-hidden="true" />
        <div className="gallery-hero__content">
          <p className="gallery-hero__eyebrow">La Mother Express</p>
          <h1 className="gallery-hero__title">
            <span className="gallery-hero__line">Notre</span>
            <span className="gallery-hero__line gallery-hero__line--gold">Univers</span>
          </h1>
          <p className="gallery-hero__sub">
            Scooters électriques, balades et instants de vie capturés au Sénégal.
          </p>
          <div className="gallery-hero__scroll" aria-hidden="true"><span /></div>
        </div>
        <div className="gallery-hero__count" aria-hidden="true">{IMAGES.length} photos</div>
      </section>

      {/* ── Grid ── */}
      <section className="gallery-section">
        <div className="gallery-grid">
          {IMAGES.map((img, i) => (
            <button
              key={img.thumb}
              type="button"
              className="gallery-item"
              style={{ gridColumn: `span ${img.span}`, '--delay': `${i * 0.07}s` } as React.CSSProperties}
              onClick={() => setLightbox(i)}
              aria-label={`Voir la photo ${i + 1}`}
            >
              <img
                {...responsiveImage(img.thumb, THUMB_SIZES)}
                alt={img.alt}
                loading={i < 3 ? 'eager' : 'lazy'}
                decoding="async"
              />
              <div className="gallery-item__overlay" aria-hidden="true">
                <div className="gallery-item__icon">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <span className="gallery-item__num">{String(i + 1).padStart(2, '0')}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Lightbox ── */}
      {lightbox !== null && createPortal(
        <div
          className="gallery-lightbox"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          role="dialog"
          aria-modal
          aria-label="Lightbox galerie"
        >
          <button className="gallery-lightbox__close" onClick={close} aria-label="Fermer">×</button>

          <button className="gallery-lightbox__nav gallery-lightbox__nav--prev" onClick={prev} aria-label="Photo précédente">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="gallery-lightbox__stage">
            <img
              key={lightbox}
              {...responsiveImage(IMAGES[lightbox].full, '100vw')}
              alt={IMAGES[lightbox].alt}
              className="gallery-lightbox__img"
            />
          </div>

          <button className="gallery-lightbox__nav gallery-lightbox__nav--next" onClick={next} aria-label="Photo suivante">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div className="gallery-lightbox__counter">
            <span className="gallery-lightbox__current">{String(lightbox + 1).padStart(2, '0')}</span>
            <span className="gallery-lightbox__sep" aria-hidden="true">/</span>
            <span>{String(IMAGES.length).padStart(2, '0')}</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
