import { type ReactNode } from 'react';
import Link from 'next/link';
import { LIEN_RESERVER } from '@/lib/suite';
import '@/styles/pied.css';

/**
 * Pied de page et contact flottant.
 *
 * ── Refonte du 2026-11-14 : la présentation seule ─────────────────────────
 * Aucune donnée, aucun lien et aucune logique n'ont changé. Les classes du
 * thème hérité (`page-footer`, `uk-grid`, `latest-news-item`…) laissent la
 * place à des classes `lme-` dans `styles/pied.css`, comme les espaces le
 * font déjà : on cesse de reprendre un thème qu'on ne maîtrise pas.
 *
 * ── `'use client'` A ÉTÉ RETIRÉ ───────────────────────────────────────────
 * Ce composant n'avait ni état, ni effet, ni gestionnaire d'événement — et
 * `new Date().getFullYear()` se calcule très bien sur le serveur. La
 * directive envoyait donc ce composant au navigateur pour rien, sur deux
 * pages. Le quota de bande passante qui a coupé le site en septembre 2026
 * rend ce genre de poids inutile coûteux.
 *
 * ── Ce qui est conservé de la V1, délibérément ────────────────────────────
 * Le bloc flottant téléphone + WhatsApp, les six liens rapides, les trois
 * vignettes « À la une » AVEC leurs images et leurs liens, les horaires, le
 * support, et le motif des réseaux sociaux qui n'affiche que les comptes
 * réellement ouverts.
 */

/**
 * Réseaux sociaux. Une icône ne s'affiche que si l'adresse du compte est
 * renseignée : un lien qui ne mène nulle part fait plus de tort qu'aucun lien.
 * Le jour où un compte s'ouvre, il suffit de coller son adresse ici.
 */
const RESEAUX: { nom: string; url: string | null; icone: ReactNode }[] = [
  {
    nom: 'X (Twitter)',
    url: null,
    icone: <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.658l-5.214-6.817-5.963 6.817H1.684l7.73-8.84L1.25 2.25h6.828l4.713 6.231 5.453-6.231zm-1.163 17.69h1.833L7.082 4.126H5.116l11.965 15.814z" />,
  },
  {
    nom: 'Facebook',
    url: null,
    icone: <path fill="currentColor" d="M13.5 22v-8.3h2.8l.4-3.2h-3.2V8.4c0-.9.2-1.6 1.7-1.6h1.7V4c-.8-.1-1.8-.2-2.8-.2-2.8 0-4.8 1.7-4.8 4.9v1.8H6.8v3.2h2.4V22h4.3z" />,
  },
  {
    nom: 'Instagram',
    url: null,
    icone: <path fill="currentColor" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.75A4 4 0 0 0 3.75 7.75v8.5a4 4 0 0 0 4 4h8.5a4 4 0 0 0 4-4v-8.5a4 4 0 0 0-4-4h-8.5zm8.7 1.45a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zM12 7.1A4.9 4.9 0 1 1 12 16.9 4.9 4.9 0 0 1 12 7.1zm0 1.75a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3z" />,
  },
  {
    nom: 'WhatsApp',
    url: 'https://wa.me/+221772320235',
    icone: <path fill="currentColor" d="M12.04 2.003a9.94 9.94 0 0 0-8.49 15.16L2 22l4.97-1.5a9.96 9.96 0 0 0 4.88 1.25h.01A9.94 9.94 0 0 0 21.99 12.04 9.95 9.95 0 0 0 12.04 2.003zm5.8 14.11c-.24.68-1.42 1.31-1.95 1.38-.5.07-1.14.1-1.84-.12-.42-.13-.96-.31-1.66-.61-2.93-1.27-4.83-4.22-4.97-4.41-.14-.2-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.56-.36.75-.36h.54c.17 0 .41-.07.64.48.24.58.81 2.01.88 2.16.07.15.12.33.02.52-.1.19-.15.31-.3.48-.15.17-.32.38-.46.51-.15.15-.31.3-.13.62.18.32.8 1.32 1.71 2.14 1.17 1.04 2.16 1.36 2.48 1.51.32.15.5.13.69-.08.19-.2.82-.96 1.05-1.29.23-.32.47-.26.78-.15.31.1 1.96.92 2.29 1.09.33.17.55.26.63.4.08.14.08.83-.16 1.51z" />,
  },
];

/** Vignettes de 240 px : les images pleine taille du bandeau pesaient jusqu'à 1,9 Mo ici. */
const A_LA_UNE = [
  {
    image: '/assets/img/header1-240.webp',
    alt: 'Flotte REVOO disponible à la location — La Mother Express',
    titre: 'Flotte REVOO',
    detail: 'En boutique à Thiès et à Mbour',
    href: '/produits',
  },
  {
    image: '/assets/img/header2-240.webp',
    alt: 'Offres de location scooter flexibles au Sénégal',
    titre: 'Offres de location flexibles',
    detail: 'À la demi-journée, à la journée ou en accession',
    href: LIEN_RESERVER,
  },
  {
    image: '/assets/img/header3-240.webp',
    alt: 'Livraison de scooter électrique au Sénégal',
    titre: 'Livraison possible',
    detail: 'Renseignez-vous auprès de votre agence',
    href: '/contact',
  },
];

const TELEPHONE = '+221772320235';
const TELEPHONE_AFFICHE = '+221 77 232 02 35';
const WHATSAPP = 'https://wa.me/+221772320235';

function IconeTelephone({ taille = 16 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function IconeWhatsApp({ taille = 18 }: { taille?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12.04 2.003a9.94 9.94 0 0 0-8.49 15.16L2 22l4.97-1.5a9.96 9.96 0 0 0 4.88 1.25h.01A9.94 9.94 0 0 0 21.99 12.04 9.95 9.95 0 0 0 12.04 2.003zm5.8 14.11c-.24.68-1.42 1.31-1.95 1.38-.5.07-1.14.1-1.84-.12-.42-.13-.96-.31-1.66-.61-2.93-1.27-4.83-4.22-4.97-4.41-.14-.2-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.56-.36.75-.36h.54c.17 0 .41-.07.64.48.24.58.81 2.01.88 2.16.07.15.12.33.02.52-.1.19-.15.31-.3.48-.15.17-.32.38-.46.51-.15.15-.31.3-.13.62.18.32.8 1.32 1.71 2.14 1.17 1.04 2.16 1.36 2.48 1.51.32.15.5.13.69-.08.19-.2.82-.96 1.05-1.29.23-.32.47-.26.78-.15.31.1 1.96.92 2.29 1.09.33.17.55.26.63.4.08.14.08.83-.16 1.51z" />
    </svg>
  );
}

export function HomeFooterSections() {
  const year = new Date().getFullYear();
  const reseaux = RESEAUX.filter((r) => r.url);

  return (
    <>
      <footer className="lme-pied">

        {/* Étage 1 : la marque, et comment nous joindre */}
        <div className="lme-pied__bande lme-pied__haut">
          <div className="lme-pied__marque">
            <Link className="lme-pied__logo" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/img/logo-la-mother-express.svg" alt="La Mother Express" width="180" height="73" decoding="async" />
            </Link>
            <p className="lme-pied__accroche">
              Location et vente de scooters électriques au Sénégal. Partenaire officiel Revoo,
              en boutique à Thiès et à Mbour.
            </p>
            {reseaux.length > 0 ? (
              <ul className="lme-pied__reseaux" aria-label="Réseaux sociaux">
                {reseaux.map((r) => (
                  <li key={r.nom}>
                    <a
                      className="lme-pied__reseau"
                      href={r.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={r.nom}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="1em" height="1em">
                        {r.icone}
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="lme-pied__joindre">
            <h2 className="lme-pied__titre">Contactez notre support</h2>
            <div className="lme-pied__boutons">
              <a className="lme-pied__bouton lme-pied__bouton--tel" href={`tel:${TELEPHONE}`}>
                <IconeTelephone />
                {TELEPHONE_AFFICHE}
              </a>
              <a
                className="lme-pied__bouton lme-pied__bouton--whatsapp"
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconeWhatsApp />
                Écrire sur WhatsApp
              </a>
              <a className="lme-pied__courriel" href="mailto:lamotherexpress@gmail.com">
                lamotherexpress@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Étage 2 : « À la une » — vignettes et liens conservés de la V1 */}
        <div className="lme-pied__bande">
          <div className="lme-pied__une">
            <h2 className="lme-pied__titre">À la une</h2>
            <ul className="lme-pied__une-liste">
              {A_LA_UNE.map((article) => (
                <li key={article.titre}>
                  <Link className="lme-pied__une-lien" href={article.href}>
                    <span className="lme-pied__une-vignette">
                      {/* Chemin figé sur la variante 240 px, et NON
                          `responsiveImage` : celui-ci met la plus large
                          (1 920 px, 1,9 Mo) en `src` de repli, ce que le
                          commentaire d'origine cherchait justement à éviter
                          pour une vignette de 96 px. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={article.image}
                        alt={article.alt}
                        width="96"
                        height="64"
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span>
                      <span className="lme-pied__une-titre">{article.titre}</span>
                      <span className="lme-pied__une-detail">{article.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Étage 3 : la navigation complète du site */}
        <div className="lme-pied__bande lme-pied__colonnes">
          <div>
            <h2 className="lme-pied__titre">Catalogue</h2>
            <ul className="lme-pied__liste">
              <li><Link href="/produits">Tous les scooters</Link></li>
              <li><Link href="/produits">Location-accession</Link></li>
              <li><Link href="/produits">Location à la journée</Link></li>
              <li><Link href="/produits">Achat comptant</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="lme-pied__titre">L’entreprise</h2>
            <ul className="lme-pied__liste">
              <li><Link href="/about">À propos</Link></li>
              <li><Link href="/gallery">Galerie</Link></li>
              <li><Link href="/contact">Nous trouver</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="lme-pied__titre">Horaires</h2>
            {/* Ventes, service et pièces ont les mêmes horaires : un seul bloc. */}
            <ul className="lme-pied__liste">
              <li>Ventes, service et pièces</li>
              <li className="lme-pied__liste-muet">Lundi – vendredi, 09:00 – 19:00</li>
              <li className="lme-pied__liste-muet">Agences : Thiès · Mbour</li>
            </ul>
          </div>

          <div>
            <h2 className="lme-pied__titre">Mon compte</h2>
            <ul className="lme-pied__liste">
              <li><Link href={LIEN_RESERVER}>Réserver en ligne</Link></li>
              <li><Link href="/compte/connexion">Mon espace client</Link></li>
            </ul>
          </div>
        </div>

        <div className="lme-pied__bande lme-pied__bas">
          <p className="lme-pied__mentions">
            © {year} La Mother Express — Location &amp; vente de scooters. Tous droits réservés.
          </p>
        </div>

      </footer>

      {/*
        Contact flottant, repris de la V1 : le numéro reste LISIBLE SANS
        CLIQUER, et WhatsApp est à un geste. Les deux pastilles séparées
        deviennent une seule capsule.
      */}
      <div className="lme-flottant">
        <a className="lme-flottant__tel" href={`tel:${TELEPHONE}`}>
          <IconeTelephone taille={19} />
          <span>
            <span className="lme-flottant__label">Besoin d’aide ?</span>
            <span className="lme-flottant__numero">77 232 02 35</span>
          </span>
        </a>
        <a
          className="lme-flottant__whatsapp"
          href={WHATSAPP}
          aria-label="Nous écrire sur WhatsApp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconeWhatsApp taille={26} />
        </a>
      </div>
    </>
  );
}
