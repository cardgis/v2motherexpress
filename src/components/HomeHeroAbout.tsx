const HERO_SLIDES = [
  {
    image: "/assets/img/header1.png",
    alt: "Scooter électrique REVOO en balade au Sénégal — La Mother Express",
    title: "La liberté, ça se conduit.",
    subtitle: "Location & vente de scooters au Sénégal",
    count: "benn",
    alignment: "left",
  },
  {
    image: "/assets/img/header2.jpg",
    alt: "Partenaire officiel REVOO Sénégal — scooters électriques à Thiès et Mbour",
    title: "Partenaire officiel Revoo Sénégal",
    subtitle: "Roule électrique, roule demain.",
    count: "ñaar",
    alignment: "right",
  },
  {
    image: "/assets/img/header3.jpg",
    alt: "Location de scooter électrique au Sénégal — simple, rapide, fiable",
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
                            {index === 0 ? (
                              <h1 className="uk-h2">
                                {slide.title}
                                <br /> {slide.subtitle}
                              </h1>
                            ) : (
                              <div className="uk-h2">
                                {slide.title}
                                <br /> {slide.subtitle}
                              </div>
                            )}
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

    </>
  );
}
