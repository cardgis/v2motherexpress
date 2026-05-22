const HERO_SLIDES = [
  {
    image: "/assets/img/header1.png",
    alt: "La Mother Express - balade 1",
    title: "La liberté, ça se conduit.",
    subtitle: "Location & vente de scooters au Sénégal",
    count: "benn",
    alignment: "left",
  },
  {
    image: "/assets/img/header2.jpg",
    alt: "La Mother Express - balade 2",
    title: "Partenaire officiel Revoo Sénégal",
    subtitle: "Roule électrique, roule demain.",
    count: "ñaar",
    alignment: "right",
  },
  {
    image: "/assets/img/header3.jpg",
    alt: "La Mother Express - balade 3",
    title: "Besoin d'un scooter aujourd'hui ?",
    subtitle: "Simple, rapide et fiable.",
    count: "ñett",
    alignment: "left",
  },
] as const;

export function HomeHeroAbout() {
  return (
    <>
      <div className="section-hero">
        <div className="hero-slider">
          <div className="hero-slider__stage">
            {HERO_SLIDES.map((slide, index) => (
              <article
                key={slide.image}
                className={`slideshow-item hero-slider__slide hero-slider__slide--${index + 1}`}
              >
                <img
                  src={slide.image}
                  alt={slide.alt}
                  width="1600"
                  height="900"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="hero-slider__image"
                />
                <div className="uk-position-center uk-position-small">
                  <div className="uk-container">
                    <div className="uk-grid" data-uk-grid>
                      {slide.alignment === "right" && <div className="uk-width-2-5@m uk-visible@l"></div>}
                      <div className="uk-width-3-5@m">
                        <div className="slideshow-item__decor">DemRek</div>
                        <div className="slideshow-item__content">
                          <div className="slideshow-item__title">
                            <div className="uk-h2">
                              {slide.title}
                              <br /> {slide.subtitle}
                            </div>
                          </div>
                        </div>
                      </div>
                      {slide.alignment === "left" && <div className="uk-width-2-5@m uk-visible@l"></div>}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="slideshow-nav" aria-label="Navigation du slider">
            <div className="slideshow-nav__arrow" aria-hidden="true">
              <span data-uk-slidenav-previous></span>
            </div>
            <div className="slideshow-nav__arrow" aria-hidden="true">
              <span data-uk-slidenav-next></span>
            </div>
          </div>
        </div>

        {/* Vignette bas pour lisibilité du texte */}
        <div className="hero-overlay" aria-hidden="true" />

        {/* Particules dorées flottantes */}
        <div className="hero-particles" aria-hidden="true">
          <div className="hero-particle hero-particle--1" />
          <div className="hero-particle hero-particle--2" />
          <div className="hero-particle hero-particle--3" />
          <div className="hero-particle hero-particle--4" />
          <div className="hero-particle hero-particle--5" />
          <div className="hero-particle hero-particle--6" />
        </div>

        {/* Indicateur de défilement */}
        <div className="hero-scroll-cue" aria-hidden="true">
          <div className="hero-scroll-cue__dot" />
          <div className="hero-scroll-cue__line" />
        </div>
      </div>

      <div className="section-about" id="section-about">
        <div className="uk-section-large uk-container">
          <div className="uk-grid uk-grid-collapse" data-uk-grid>
            <div className="uk-width-1-3@m">
              <img
                className="section-about__img"
                src="/assets/img/img-about.jpg"
                alt="img-about"
              />
            </div>
            <div className="uk-width-2-3@m">
              <div className="section-about__content">
                <div className="section-title" data-reveal>
                  <span>Emmener les balades a un niveau superieur</span>
                  <h3 className="uk-h2">Électrique, écologique<br /> et accessible</h3>
                  <span className="section-title-bar" />
                </div>
                <div className="section-content">
                  <p data-reveal style={{ '--reveal-delay': '0.1s' } as React.CSSProperties}>
                    Découvrez nos scooters électriques REVOO, conçues pour les routes sénégalaises.
                    Performantes, silencieuses et faciles à entretenir, elles offrent une mobilité durable
                    à un prix compétitif avec des options de location ou d'achat adaptées à votre budget.
                  </p>
                  <div className="uk-margin-medium">
                    <div className="uk-grid uk-child-width-1-2@s" data-uk-grid>
                      <div data-reveal style={{ '--reveal-delay': '0s' } as React.CSSProperties}>
                        <div className="block-icon">
                          <div className="block-icon__icon">
                            <svg className="block-icon__img" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M40 12h-16c-2.2 0-4 1.8-4 4v28c0 2.2 1.8 4 4 4h16c2.2 0 4-1.8 4-4V16c0-2.2-1.8-4-4-4zm-8 2h8v2h-8v-2zm4 34c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm8-6H28V20h16v22z"/><path fill="#c79a2a" d="M32 28h4v8h-4z"/></svg>
                          </div>
                          <div className="block-icon__desc">
                            <div className="block-icon__title">Technologie Électrique</div>
                            <div className="block-icon__text">Moteurs sophistiqués avec une haute performance et une autonomie jusqu'à 140 km.</div>
                          </div>
                        </div>
                      </div>
                      <div data-reveal style={{ '--reveal-delay': '0.1s' } as React.CSSProperties}>
                        <div className="block-icon">
                          <div className="block-icon__icon">
                            <svg className="block-icon__img" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M48 16c-4.4 0-8 3.6-8 8v16h-8V12c0-4.4-3.6-8-8-8s-8 3.6-8 8v24H8V24c0-4.4-3.6-8-8-8s-8 3.6-8 8v20c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12V24c0-4.4-3.6-8-8-8z" transform="translate(8) scale(0.75)"/><circle cx="32" cy="12" r="6" fill="#c79a2a"/></svg>
                          </div>
                          <div className="block-icon__desc">
                            <div className="block-icon__title">Design Ergonomique</div>
                            <div className="block-icon__text">Confortable et pratique, optimisée pour une conduite agréable en tous terrains urbains et semi-ruraux.</div>
                          </div>
                        </div>
                      </div>
                      <div data-reveal style={{ '--reveal-delay': '0.2s' } as React.CSSProperties}>
                        <div className="block-icon">
                          <div className="block-icon__icon">
                            <svg className="block-icon__img" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M32 8c-13.3 0-24 10.7-24 24s10.7 24 24 24 24-10.7 24-24-10.7-24-24-24zm0 44c-11 0-20-9-20-20s9-20 20-20 20 9 20 20-9 20-20 20z"/><path fill="#c79a2a" d="M28 32l-4 4 8 8 16-16-4-4-12 12z"/></svg>
                          </div>
                          <div className="block-icon__desc">
                            <div className="block-icon__title">Fiabilité Reconnue</div>
                            <div className="block-icon__text">Marque de référence en Afrique de l'Ouest, REVOO garantit durabilité et service après-vente fiable.</div>
                          </div>
                        </div>
                      </div>
                      <div data-reveal style={{ '--reveal-delay': '0.3s' } as React.CSSProperties}>
                        <div className="block-icon">
                          <div className="block-icon__icon">
                            <svg className="block-icon__img" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="20" r="12" fill="currentColor"/><path fill="currentColor" d="M44 36H20c-2.2 0-4 1.8-4 4v16c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4V40c0-2.2-1.8-4-4-4zm-12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/><path fill="#c79a2a" d="M32 48c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg>
                          </div>
                          <div className="block-icon__desc">
                            <div className="block-icon__title">Économie Garantie</div>
                            <div className="block-icon__text">Coûts d'exploitation minimaux : électricité bon marché, maintenance réduite, zéro pollution.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="section-about__gallery" data-reveal style={{ '--reveal-delay': '0.15s' } as React.CSSProperties}>
                    <div className="uk-grid uk-grid-small uk-child-width-1-2@s" data-uk-grid>
                      <div><img className="uk-width-1-1" src="/assets/img/about-gallery-1.jpg" alt="about-gallery" width="800" height="600" loading="lazy" /></div>
                      <div><img className="uk-width-1-1" src="/assets/img/about-gallery-2.jpg" alt="about-gallery" width="800" height="600" loading="lazy" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
