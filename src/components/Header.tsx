'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { LIEN_RESERVER } from '@/lib/suite';
import { OffcanvasButton } from "./OffcanvasButton";
import { NavbarOverlays } from "./NavbarOverlays";
import "@/styles/vitrine-acces.css";

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cheminAffiche, setCheminAffiche] = useState(pathname);

  // Les menus se referment à chaque changement de page. L'état est ajusté
  // pendant le rendu plutôt que dans un effet : React applique la fermeture
  // dans le même passage, sans afficher un instant le menu encore ouvert.
  if (pathname !== cheminAffiche) {
    setCheminAffiche(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Les espaces client, gérant et signature ont leur propre en-tête, dans le
  // flux de la page. Cet en-tête-ci, transparent et positionné en absolu
  // par-dessus le contenu, y masquait les titres.
  if (pathname.startsWith('/admin') || /^\/(compte|gerant|signer)(\/|$)/.test(pathname)) return null;

  const isTransparent = pathname !== '/contact' && pathname !== '/produits';
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
                <li><Link href="/produits">CATALOGUE SCOOTERS</Link></li>
                <li><Link href="/about">À PROPOS</Link></li>
                <li><Link href="/gallery">GALERIE</Link></li>
                <li><Link href="/contact">NOUS TROUVER</Link></li>
              </ul>
            </nav>
          </div>
          <div className="page-header__right">
            {/* Accès client, visibles à toutes les largeurs : ce sont les deux
                seules actions qui font entrer le visiteur dans le parcours.
                « Mon espace » mène à la connexion, qui renvoie directement
                dans l'espace si la session est déjà ouverte. */}
            <div className="entete-acces">
              <Link href="/compte/connexion" className="entete-acces__compte">
                <UserRound size={20} aria-hidden />
                <span className="entete-acces__libelle">Mon espace</span>
              </Link>
              <Link href={LIEN_RESERVER} className="entete-acces__reserver">
                Réserver
              </Link>
            </div>
            <OffcanvasButton onClick={() => setMenuOpen(true)} />
          </div>
        </div>
      </header>
      <NavbarOverlays menuOpen={menuOpen} onCloseMenu={() => setMenuOpen(false)} />
    </>
  );
}

export default Header;
