'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Video = {
  src: string;
  title: string;
  /** Démarre sans le son (l'utilisateur peut le réactiver via les contrôles). Défaut : true. */
  muted?: boolean;
};

const VIDEOS: Video[] = [
  {
    src: "/assets/videos/WhatsApp_Video_2026-08-03_at_18_09_51.mp4",
    title: "Nos scooters électriques en action",
    muted: false,
  },
  {
    src: "/assets/videos/landscape_video-1.mp4",
    title: "Revoo en action",
  },
  {
    src: "/assets/videos/landscape_WhatsApp_Video_2026-06-01_at_12_58_16.mp4",
    title: "Balade au Sénégal",
  },
  {
    src: "/assets/videos/landscape_WhatsApp_Video_2026-06-01_at_12_58_24.mp4",
    title: "La Mother Express",
  },
];

function Chevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direction === "prev" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

export function HomeVideosSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  /**
   * Les vidéos (jusqu'à 9 Mo chacune) ne commencent à se charger qu'à
   * l'approche de leur section. Sans cela, un visiteur qui ne descend pas
   * jusqu'en bas les téléchargeait quand même : 16 Mo sur un forfait mobile.
   */
  const [proche, setProche] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || proche) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setProche(true);
          observateur.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [proche]);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [sync]);

  /** Décale d'exactement une carte : l'écart entre deux items inclut déjà le gap. */
  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const [first, second] = Array.from(el.children) as HTMLElement[];
    const step = second ? second.offsetLeft - first.offsetLeft : el.clientWidth;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * step, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="section-videos" ref={sectionRef}>
      <div className="uk-section-large uk-container">
        <div className="section-title uk-text-center" data-reveal>
          <span>La Mother Express en mouvement</span>
          <h2 className="uk-h2">Nos vidéos</h2>
          <span className="section-title-bar" />
        </div>
        <div className="section-content">
          {/* data-reveal sur le conteneur et non sur chaque carte : une carte hors
              du cadre visible du carrousel n'intersecte jamais le viewport et
              resterait bloquée à opacity 0. */}
          <div className="videos-carousel" data-reveal>
            <button
              type="button"
              className="videos-carousel__arrow videos-carousel__arrow--prev"
              onClick={() => scrollByCard(-1)}
              disabled={atStart}
              aria-label="Vidéos précédentes"
            >
              <Chevron direction="prev" />
            </button>

            <div className="videos-carousel__track" ref={trackRef}>
              {VIDEOS.map((video) => (
                <div className="videos-carousel__item" key={video.src}>
                  <div className="video-card">
                    <div className="video-card__embed">
                      <video
                        src={video.src}
                        controls
                        muted={video.muted ?? true}
                        preload={proche ? "metadata" : "none"}
                        playsInline
                      />
                    </div>
                    <div className="video-card__title">{video.title}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="videos-carousel__arrow videos-carousel__arrow--next"
              onClick={() => scrollByCard(1)}
              disabled={atEnd}
              aria-label="Vidéos suivantes"
            >
              <Chevron direction="next" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
