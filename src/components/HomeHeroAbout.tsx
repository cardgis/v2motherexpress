import Link from "next/link";
import { LIEN_RESERVER } from "@/lib/suite";

const HERO_SLIDES = [
  {
    // Versions WebP compressées (voir public/assets/img) : 1,9 Mo → quelques centaines de Ko.
    image: "/assets/img/header1-1920.webp",
    alt: "Scooter électrique REVOO en balade au Sénégal — La Mother Express",
    title: "La liberté, ça se conduit.",
    subtitle: "Location & vente de scooters au Sénégal",
  },
  {
    image: "/assets/img/header2-1920.webp",
    alt: "Partenaire officiel REVOO Sénégal — scooters électriques à Thiès et Mbour",
    title: "Partenaire officiel Revoo Sénégal",
    subtitle: "Roule électrique, roule demain.",
  },
  {
    image: "/assets/img/header3-1920.webp",
    alt: "Location de scooter électrique au Sénégal — simple, rapide, fiable",
    title: "Besoin d'un scooter aujourd'hui ?",
    subtitle: "Simple, rapide et fiable.",
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
                // Les diapositives suivantes répètent le message : les lecteurs
                // d'écran ne lisent que la première, porteuse du titre de la page.
                aria-hidden={index === 0 ? undefined : true}
              >
                <img
                  src={slide.image}
                  alt={index === 0 ? slide.alt : ""}
                  width="1600"
                  height="900"
                  loading={index === 0 ? "eager" : "lazy"}
                  // La première image est la plus grande de la page : le
                  // navigateur la télécharge avant le reste.
                  fetchPriority={index === 0 ? "high" : "low"}
                  decoding="async"
                  className="hero-slider__image"
                />
                <div className="uk-position-center uk-position-small">
                  <div className="uk-container">
                    <div className="uk-grid" data-uk-grid>
                      <div className="uk-width-3-5@m">
                        <div className="slideshow-item__decor">DemRek</div>
                        <div className="slideshow-item__content">
                          <div className="slideshow-item__title">
                            {index === 0 ? (
                              <h1 className="uk-h2">
                                {slide.title}
                                <span className="hero-sous-titre">{slide.subtitle}</span>
                              </h1>
                            ) : (
                              <div className="uk-h2">
                                {slide.title}
                                <span className="hero-sous-titre">{slide.subtitle}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="uk-width-2-5@m uk-visible@l"></div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Boutons communs aux trois diapositives : présents une seule fois,
              ils restent atteignables au clavier quelle que soit l'image affichée. */}
          <div className="hero-actions">
            <div className="uk-container">
              <div className="hero-actions__groupe">
                <Link href={LIEN_RESERVER} className="hero-actions__bouton hero-actions__bouton--principal">
                  Réserver en ligne
                </Link>
                <Link href="/produits" className="hero-actions__bouton hero-actions__bouton--secondaire">
                  Voir les modèles
                </Link>
              </div>
            </div>
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
