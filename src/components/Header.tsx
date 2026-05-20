'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SearchButton } from "./SearchButton";
import { OffcanvasButton } from "./OffcanvasButton";
import { NavbarOverlays } from "./NavbarOverlays";

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollToCatalogueRef = useRef(false);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // After navigating to '/', scroll to #catalogue if the click requested it
  useEffect(() => {
    if (pathname !== '/' || !scrollToCatalogueRef.current) return;
    scrollToCatalogueRef.current = false;
    requestAnimationFrame(() => {
      document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCatalogueClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault();
      document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      scrollToCatalogueRef.current = true;
    }
  };

  if (pathname.startsWith('/admin')) return null;

  const isTransparent = pathname !== '/contact';
  const headerClass = isTransparent ? "page-header page-header-transparent" : "page-header";

  return (
    <>
      <header className={headerClass}>
        <div className="page-header__inner">
          <div className="page-header__left">
            <div className="logo"><Link className="logo__link" href="/">
                <div className="logo__icon"><img src="/assets/img/logo-la-mother-express.svg" alt="La Mother Express" width="300" height="200" decoding="async" /></div>
                <div className="logo__text"></div>
              </Link></div>
          </div>
          <div className="page-header__center">
            <nav className="page-nav" data-uk-navbar>
              <ul className="uk-navbar-nav">
                <li><Link href="/" onClick={handleCatalogueClick}>CATALOGUE SCOOTERS</Link></li>
                <li><Link href="/about">À PROPOS</Link></li>
                <li><Link href="/gallery">GALERIE</Link></li>
                <li><Link href="/">LOUER/ACHETER</Link></li>
                <li><Link href="/contact">NOUS TROUVER</Link></li>
              </ul>
            </nav>
          </div>
          <div className="page-header__right">
            <SearchButton onClick={() => setSearchOpen(true)} />
            <OffcanvasButton onClick={() => setMenuOpen(true)} />
          </div>
        </div>
      </header>
      <NavbarOverlays
        menuOpen={menuOpen}
        searchOpen={searchOpen}
        onCloseMenu={() => setMenuOpen(false)}
        onCloseSearch={() => setSearchOpen(false)}
        onCatalogueClick={handleCatalogueClick}
      />
    </>
  );
}

export default Header;
