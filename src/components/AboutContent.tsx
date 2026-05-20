import { AboutReveal } from './AboutReveal';

function Particles() {
  return (
    <div className="about-particles" aria-hidden="true">
      <span className="about-particle about-particle--1" />
      <span className="about-particle about-particle--2" />
      <span className="about-particle about-particle--3" />
      <span className="about-particle about-particle--4" />
      <span className="about-particle about-particle--5" />
      <span className="about-particle about-particle--6" />
      <span className="about-particle about-particle--7" />
    </div>
  );
}

export function AboutContent() {
  return (
    <article className="about-story">
      <AboutReveal />

      {/* ── HERO ───────────────────────────────────── */}
      <div className="about-hero">
        <div className="about-hero__glow" aria-hidden="true" />
        <Particles />
        <p className="about-eyebrow">Notre Histoire</p>
        <h1 className="about-hero__title">
          <span className="about-hero__line about-hero__line--1">La Mother,</span>
          <span className="about-hero__line about-hero__line--2">c'est avant tout</span>
          <span className="about-hero__line about-hero__line--3">
            <span className="about-hero__em">une femme.</span>
          </span>
        </h1>
        <div className="about-hero__scroll" aria-hidden="true">
          <span />
        </div>
      </div>

      {/* ── SPLIT: texte gauche + image droite ─────── */}
      <div className="about-split">
        <div className="about-split__text">
          <div className="about-ornament" data-reveal aria-hidden="true">◆</div>

          <p className="about-body" data-reveal data-reveal-delay="80">
            Celle dont le nom nourrit, rassemble, et fait avancer. Ici au Sénégal,
            on l'appelle <strong>La Mother</strong> — pas par hasard. C'est elle qui tient
            la maison, qui connaît chaque visage, qui sert avec le cœur. C'est
            autour d'elle que tout commence.
          </p>

          <div className="about-separator" data-reveal data-reveal-delay="120" aria-hidden="true" />

          <p className="about-body" data-reveal data-reveal-delay="80">
            L'aventure a d'abord pris la forme d'une table. <strong>Chez La Mother</strong>, un
            restaurant où l'on mange comme à la maison — avec les saveurs du
            terroir, la chaleur du foyer, et cette générosité qui ne se commande
            pas. Un lieu où Thiès se retrouve autour d'un plat, d'un
            sourire, d'une histoire partagée.
          </p>
        </div>

        <figure className="about-split__image" data-reveal data-reveal-delay="160">
          <img
            src="/assets/img/chezlamother.jpg"
            alt="Chez La Mother — cuisine sénégalaise traditionnelle"
            width={840}
            height={840}
            loading="lazy"
            decoding="async"
          />
        </figure>
      </div>

      {/* ── CORPS (suite) ──────────────────────────── */}
      <div className="about-content">

        {/* ── PULL QUOTE ── */}
        <div className="about-pullquote" data-reveal>
          <span>Puis est venue l'envie<br />d'aller plus loin.</span>
          <em>Littéralement.</em>
        </div>

        <p className="about-body" data-reveal data-reveal-delay="80">
          La Mother Express, c'est le même esprit — familial, ancré, sincère —
          mais sur deux roues. Une extension naturelle, portée par la même
          conviction : entreprendre ici, pour les gens d'ici, avec ce que la
          terre et l'époque offrent de meilleur. Aujourd'hui, cette époque,
          c'est l'électrique. <strong>Propre. Silencieux. Économique.</strong> Et
          résolument sénégalais dans sa manière d'être vécu.
        </p>

        {/* ── HIGHLIGHT REVOO ── */}
        <div className="about-highlight" data-reveal>
          <div className="about-highlight__bar" aria-hidden="true" />
          <p>
            Avec <strong>REVOO</strong> comme partenaire, on ne vend pas juste un
            scooter. On propose une nouvelle façon de circuler à Mbour, à
            Thiès — et demain, ailleurs.
          </p>
        </div>

        {/* ── CLOSING ── */}
        <div className="about-closing" data-reveal>
          <div className="about-ornament" aria-hidden="true">◆</div>
          <p className="about-closing__duo">
            <span className="about-closing__name">Olivier</span>
            <span className="about-closing__sep">·</span>
            <span className="about-closing__name">Lazare</span>
          </p>
          <p className="about-closing__roles">
            Olivier tient la route à Mbour. Lazare à Thiès.
          </p>
          <p className="about-closing__tagline">
            Deux gérants, une même famille, une même vision.
          </p>
        </div>

      </div>
    </article>
  );
}
