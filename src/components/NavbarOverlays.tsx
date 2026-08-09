'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

type NavbarOverlaysProps = {
  menuOpen: boolean;
  searchOpen: boolean;
  onCloseMenu: () => void;
  onCloseSearch: () => void;
};

export function NavbarOverlays({ menuOpen, searchOpen, onCloseMenu, onCloseSearch }: NavbarOverlaysProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  return (
    <>
      <div
        id="nav-menu"
        className={`navbar-overlay navbar-overlay--menu${menuOpen ? ' is-open' : ''}`}
        onClick={(e) => {
          if (!(e.target as Element).closest('.navbar-overlay__panel--menu')) onCloseMenu();
        }}
      >
        <div className="navbar-overlay__panel navbar-overlay__panel--menu">
          <div className="navbar-overlay__header">
            <div className="logo">
              <Link className="logo__link" href="/" onClick={onCloseMenu}>
                <div className="logo__icon">
                  <img src="/assets/img/logo-la-mother-express.svg" alt="La Mother Express" width="180" height="120" decoding="async" />
                </div>
                <div className="logo__text">La Mother Express</div>
              </Link>
            </div>
            <button className="navbar-overlay__close" type="button" onClick={onCloseMenu} aria-label="Fermer le menu">
              ×
            </button>
          </div>
          <div className="navbar-overlay__content">
            <nav aria-label="Navigation mobile">
              <ul className="navbar-overlay__nav uk-nav uk-nav-default uk-nav-parent-icon">
                <li><Link href="/" onClick={onCloseMenu}>Accueil</Link></li>
                <li><Link href="/produits" onClick={onCloseMenu}>Catalogue motos</Link></li>
                <li><Link href="/about" onClick={onCloseMenu}>À PROPOS</Link></li>
                <li><Link href="/gallery" onClick={onCloseMenu}>GALERIE</Link></li>
                <li><Link href="/" onClick={onCloseMenu}>Louer / Acheter</Link></li>
                <li><Link href="/contact" onClick={onCloseMenu}>NOUS TROUVER</Link></li>
              </ul>
            </nav>
            <div className="support navbar-overlay__support">
              <a className="support__link" href="tel:+221 77 232 02 35 " aria-label="Appeler le support">
                <div className="support__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false" width="1em" height="1em">
                    <path fill="currentColor" d="M12 3a7.5 7.5 0 0 0-7.5 7.5V13A2.5 2.5 0 0 0 7 15.5h1.25a1.25 1.25 0 0 0 1.25-1.25V9.75A1.25 1.25 0 0 0 8.25 8.5H7.3A4.7 4.7 0 0 1 12 4.5a4.7 4.7 0 0 1 4.7 4h-.95a1.25 1.25 0 0 0-1.25 1.25v4.5A1.25 1.25 0 0 0 15.75 15.5H17a2.5 2.5 0 0 0 2.5-2.5v-.5A7.5 7.5 0 0 0 12 3zm-7.5 12.25A2.25 2.25 0 0 0 6.75 17.5H8v2a1 1 0 0 0 1 1h3.25a1 1 0 0 0 0-2H10v-1.5h2.5a1 1 0 0 0 0-2H4.5zm15 0H16a1 1 0 0 0 0 2h2.5V21a1 1 0 0 0 2 0v-2.25a2.25 2.25 0 0 0-2.25-2.25z" />
                  </svg>
                </div>
                <div className="support__desc">
                  <div className="support__label">Besoin d&apos;aide ?</div>
                  <div className="support__phone">+221 77 232 02 35 </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div
        id="nav-search"
        className={`navbar-overlay navbar-overlay--search${searchOpen ? ' is-open' : ''}`}
        style={{ zIndex: 1300 }}
        onClick={(e) => {
          if (!(e.target as Element).closest('.navbar-overlay__panel--search')) onCloseSearch();
        }}
      >
        <div className="navbar-overlay__panel navbar-overlay__panel--search uk-card uk-card-default">
          <div className="navbar-overlay__search-top">
            <div>
              <p className="navbar-overlay__eyebrow">Recherche rapide</p>
              <p className="navbar-overlay__title">Trouvez un scooter, un service ou une adresse</p>
            </div>
            <button className="navbar-overlay__close" type="button" onClick={onCloseSearch} aria-label="Fermer la recherche">
              ×
            </button>
          </div>
          <form className="navbar-search-form uk-search uk-search-large">
            <span className="navbar-search-form__icon" aria-hidden="true">⌕</span>
            <input
              ref={searchInputRef}
              className="uk-search-input navbar-search-form__input"
              type="search"
              placeholder="Rechercher un scooter, une marque, un service..."
            />
          </form>
          <div className="navbar-overlay__quick-links" aria-label="Raccourcis de recherche">
            <Link href="/produits" onClick={onCloseSearch}>Catalogue motos</Link>
            <Link href="/about" onClick={onCloseSearch}>À PROPOS</Link>
            <Link href="/" onClick={onCloseSearch}>LOUER/ACHETER</Link>
            <Link href="/contact" onClick={onCloseSearch}>NOUS TROUVER</Link>
          </div>
          <div className="navbar-overlay__hint">
            Astuce : utilisez des mots-clés simples comme marque, modèle ou ville.
          </div>
        </div>
      </div>
    </>
  );
}
