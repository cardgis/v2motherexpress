'use client';

import { useEffect } from 'react';

export function HomeFooterSections() {
  const year = new Date().getFullYear();

  useEffect(() => {
    (window as Window & { FontAwesome?: { dom?: { i2svg?: () => void } } }).FontAwesome?.dom?.i2svg?.();
  }, []);

  return (
    <>
      <footer className="page-footer">
        <div className="page-footer__top">
          <div className="uk-container">
            <div className="uk-grid uk-grid-small uk-child-width-1-4@l uk-child-width-1-2@s" data-uk-grid>
              <div>
                <div className="uk-margin-medium">
                  <div className="logo">
                    <a className="logo__link" href="/">
                      <div className="logo__icon"><img src="/assets/img/logo-la-mother-express.svg" alt="La Mother Express" width="180" height="120" decoding="async" /></div>
                      <div className="logo__text">La Mother Express</div>
                    </a>
                  </div>
                </div>
                <div className="uk-margin-medium">
                  <p>Location et vente de scooters au Sénégal — flotte électrique, livrés où vous êtes.</p>
                </div>
                <div className="uk-margin-medium">
                  <div className="support">
                    <a className="support__link" href="tel:+221 77 232 02 35 ">
                      <div className="support__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false" width="1em" height="1em">
                          <path fill="currentColor" d="M12 3a7.5 7.5 0 0 0-7.5 7.5V13A2.5 2.5 0 0 0 7 15.5h1.25a1.25 1.25 0 0 0 1.25-1.25V9.75A1.25 1.25 0 0 0 8.25 8.5H7.3A4.7 4.7 0 0 1 12 4.5a4.7 4.7 0 0 1 4.7 4h-.95a1.25 1.25 0 0 0-1.25 1.25v4.5A1.25 1.25 0 0 0 15.75 15.5H17a2.5 2.5 0 0 0 2.5-2.5v-.5A7.5 7.5 0 0 0 12 3zm-7.5 12.25A2.25 2.25 0 0 0 6.75 17.5H8v2a1 1 0 0 0 1 1h3.25a1 1 0 0 0 0-2H10v-1.5h2.5a1 1 0 0 0 0-2H4.5zm15 0H16a1 1 0 0 0 0 2h2.5V21a1 1 0 0 0 2 0v-2.25a2.25 2.25 0 0 0-2.25-2.25z" />
                        </svg>
                      </div>
                      <div className="support__desc">
                        <div className="support__label">Contactez notre support</div>
                        <div className="support__phone">+221 77 232 02 35 </div>
                      </div>
                    </a>
                  </div>
                </div>
                <div className="uk-margin-medium">
                  <div className="social" aria-label="Réseaux sociaux">
                    <ul className="social-list">
                      <li className="social-list__item">
                        <a className="social-list__link" href="#" aria-label="Twitter">
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="1em" height="1em">
                            <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.658l-5.214-6.817-5.963 6.817H1.684l7.73-8.84L1.25 2.25h6.828l4.713 6.231 5.453-6.231zm-1.163 17.69h1.833L7.082 4.126H5.116l11.965 15.814z" />
                          </svg>
                        </a>
                      </li>
                      <li className="social-list__item">
                        <a className="social-list__link" href="#" aria-label="Facebook">
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="1em" height="1em">
                            <path fill="currentColor" d="M13.5 22v-8.3h2.8l.4-3.2h-3.2V8.4c0-.9.2-1.6 1.7-1.6h1.7V4c-.8-.1-1.8-.2-2.8-.2-2.8 0-4.8 1.7-4.8 4.9v1.8H6.8v3.2h2.4V22h4.3z" />
                          </svg>
                        </a>
                      </li>
                      <li className="social-list__item">
                        <a className="social-list__link" href="#" aria-label="Instagram">
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="1em" height="1em">
                            <path fill="currentColor" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.75A4 4 0 0 0 3.75 7.75v8.5a4 4 0 0 0 4 4h8.5a4 4 0 0 0 4-4v-8.5a4 4 0 0 0-4-4h-8.5zm8.7 1.45a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zM12 7.1A4.9 4.9 0 1 1 12 16.9 4.9 4.9 0 0 1 12 7.1zm0 1.75a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3z" />
                          </svg>
                        </a>
                      </li>
                      <li className="social-list__item"><a className="social-list__link" href="#" aria-label="WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="1em" height="1em"><path fill="currentColor" d="M12.04 2.003a9.94 9.94 0 0 0-8.49 15.16L2 22l4.97-1.5a9.96 9.96 0 0 0 4.88 1.25h.01A9.94 9.94 0 0 0 21.99 12.04 9.95 9.95 0 0 0 12.04 2.003zm5.8 14.11c-.24.68-1.42 1.31-1.95 1.38-.5.07-1.14.1-1.84-.12-.42-.13-.96-.31-1.66-.61-2.93-1.27-4.83-4.22-4.97-4.41-.14-.2-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.56-.36.75-.36h.54c.17 0 .41-.07.64.48.24.58.81 2.01.88 2.16.07.15.12.33.02.52-.1.19-.15.31-.3.48-.15.17-.32.38-.46.51-.15.15-.31.3-.13.62.18.32.8 1.32 1.71 2.14 1.17 1.04 2.16 1.36 2.48 1.51.32.15.5.13.69-.08.19-.2.82-.96 1.05-1.29.23-.32.47-.26.78-.15.31.1 1.96.92 2.29 1.09.33.17.55.26.63.4.08.14.08.83-.16 1.51z"/></svg></a></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <div className="page-footer__column page-footer__menu">
                  <div className="uk-h4">Liens rapides</div>
                  <ul className="list-decor">
                    <li><a href="/produits">CATALOGUE SCOOTERS</a></li>
                    <li><a href="/about">À PROPOS</a></li>
                    <li><a href="/gallery">GALERIE</a></li>
                    <li><a href="/">LOUER/ACHETER</a></li>
                    <li><a href="/contact">NOUS TROUVER</a></li>
                  </ul>
                </div>
              </div>
              <div>
                <div className="page-footer__column page-footer__news">
                  <div className="uk-h4">À la une</div>
                  <ul className="latest-news-list">
                    <li>
                      <div className="latest-news-item">
                        <div className="latest-news-item__thumb"><img src="/assets/img/header1.png" alt="Flotte REVOO disponible à la location — La Mother Express" width="120" height="80" loading="lazy" /></div>
                        <div className="latest-news-item__info"><span className="latest-news-item__title">Flotte REVOO disponible</span><div className="latest-news-item__date">Dernière mise à jour</div></div>
                      </div>
                    </li>
                    <li>
                      <div className="latest-news-item">
                        <div className="latest-news-item__thumb"><img src="/assets/img/header2.jpg" alt="Offres de location scooter flexibles au Sénégal" width="120" height="80" loading="lazy" /></div>
                        <div className="latest-news-item__info"><span className="latest-news-item__title">Offres de location flexibles</span><div className="latest-news-item__date">Dernière mise à jour</div></div>
                      </div>
                    </li>
                    <li>
                      <div className="latest-news-item">
                        <div className="latest-news-item__thumb"><img src="/assets/img/header3.jpg" alt="Livraison de scooter électrique partout au Sénégal" width="120" height="80" loading="lazy" /></div>
                        <div className="latest-news-item__info"><span className="latest-news-item__title">Livraison possible</span><div className="latest-news-item__date">Dernière mise à jour</div></div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <div className="page-footer__column page-footer__info">
                  <div className="uk-h4">Horaires</div>
                  <ul className="info-list">
                    <li><div className="info-list-item"><div className="info-list-item__title">Ventes</div><div className="info-list-item__value">Lundi - Vendredi: <br /> 09:00 — 19:00</div></div></li>
                    <li><div className="info-list-item"><div className="info-list-item__title">Service</div><div className="info-list-item__value">Lundi - Vendredi: <br /> 09:00 — 19:00</div></div></li>
                    <li><div className="info-list-item"><div className="info-list-item__title">Boutique pièces</div><div className="info-list-item__value">Lundi - Vendredi: <br /> 09:00 — 19:00</div></div></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-footer__bottom">
          <div className="uk-container">
            <div className="uk-text-center footer-copyright">© {year} La Mother Express - Location & Vente de Scooters. Tous droits réservés.</div>
          </div>
        </div>

      </footer>

      <div className="floating-contact">
        <a className="floating-contact__phone" href="tel:+221 77 232 02 35 ">+221 77 232 02 35 </a>
        <a className="floating-contact__whatsapp" href="https://wa.me/+221772320235" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20"><path fill="currentColor" d="M12.04 2.003a9.94 9.94 0 0 0-8.49 15.16L2 22l4.97-1.5a9.96 9.96 0 0 0 4.88 1.25h.01A9.94 9.94 0 0 0 21.99 12.04 9.95 9.95 0 0 0 12.04 2.003zm5.8 14.11c-.24.68-1.42 1.31-1.95 1.38-.5.07-1.14.1-1.84-.12-.42-.13-.96-.31-1.66-.61-2.93-1.27-4.83-4.22-4.97-4.41-.14-.2-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.56-.36.75-.36h.54c.17 0 .41-.07.64.48.24.58.81 2.01.88 2.16.07.15.12.33.02.52-.1.19-.15.31-.3.48-.15.17-.32.38-.46.51-.15.15-.31.3-.13.62.18.32.8 1.32 1.71 2.14 1.17 1.04 2.16 1.36 2.48 1.51.32.15.5.13.69-.08.19-.2.82-.96 1.05-1.29.23-.32.47-.26.78-.15.31.1 1.96.92 2.29 1.09.33.17.55.26.63.4.08.14.08.83-.16 1.51z"/></svg>
        </a>
      </div>
    </>
  );
}