'use client';

import { useState } from 'react';
import '@/styles/videos.css';

/**
 * Section « Nos vidéos ».
 *
 * ── CE QUI CHANGE VRAIMENT : LE POIDS ─────────────────────────────────────
 * L'ancien carrousel montait QUATRE éléments `<video>` et les préchargeait
 * dès que la section approchait du cadre visible, via un observateur
 * d'intersection. Un visiteur qui descendait jusqu'en bas sans rien regarder
 * téléchargeait donc les métadonnées de quatre vidéos, dont une de 9,7 Mo.
 * Le quota de bande passante Vercel a déjà coupé ce site une fois, en
 * septembre 2026 : ce genre de téléchargement pour rien se paie.
 *
 * Désormais : trois vignettes IMAGE (34 à 91 Ko), et la vidéo n'est MONTÉE
 * qu'au clic. L'observateur d'intersection disparaît — il n'a plus rien à
 * observer, puisque plus rien ne se précharge. On ne télécharge que ce qu'on
 * a demandé à voir.
 *
 * ── Pourquoi ce composant reste un composant client ───────────────────────
 * Contrairement au pied de page, celui-ci a une vraie raison : il garde en
 * état la vignette sur laquelle on a cliqué. C'est le seul état de la page.
 *
 * ── La quatrième vidéo ────────────────────────────────────────────────────
 * « La Mother Express » (9,7 Mo) n'est pas reprise : Alexandre a demandé
 * trois vidéos. Avec la lecture au clic, son poids ne coûterait plus rien
 * tant que personne ne la lance — l'ajouter est une ligne dans `VIDEOS`.
 *
 * ── Les vignettes ─────────────────────────────────────────────────────────
 * Ce sont des photos existantes du site, pas des images extraites des
 * vidéos. L'idéal serait une image de la première seconde de chacune ; faute
 * d'outil d'extraction sur le poste, ces photos tiennent la place et restent
 * cohérentes avec le reste de la page.
 */

type Video = {
  src: string;
  titre: string;
  /** Vignette affichée tant que la vidéo n'est pas lancée. */
  vignette: string;
  alt: string;
  /** Démarre sans le son ? Faux pour la vidéo de présentation. */
  muet: boolean;
};

const VIDEOS: Video[] = [
  {
    src: '/assets/videos/WhatsApp_Video_2026-08-03_at_18_09_51.mp4',
    titre: 'Nos scooters électriques en action',
    vignette: '/assets/img/gallery1-768.webp',
    alt: 'Scooters électriques Revoo de La Mother Express',
    muet: false,
  },
  {
    src: '/assets/videos/landscape_video-1.mp4',
    titre: 'Revoo en action',
    vignette: '/assets/img/gallery2-768.webp',
    alt: 'Scooter Revoo en situation au Sénégal',
    muet: true,
  },
  {
    src: '/assets/videos/landscape_WhatsApp_Video_2026-06-01_at_12_58_16.mp4',
    titre: 'Balade au Sénégal',
    vignette: '/assets/img/chezlamother-1200.webp',
    alt: 'Balade en scooter électrique au Sénégal',
    muet: true,
  },
];

function IconeLecture() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" style={{ marginLeft: 3 }}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconeFleche() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function HomeVideosSection() {
  /** La vidéo lancée, s'il y en a une. Seul état de la section. */
  const [lancee, setLancee] = useState<string | null>(null);

  return (
    <section className="lme-videos" id="videos">
      <div className="lme-videos__bande">

        <div className="lme-videos__entete">
          <div>
            <p className="lme-videos__surtitre">La Mother Express en mouvement</p>
            <h2 className="lme-videos__titre">Nos vidéos</h2>
          </div>
          <p className="lme-videos__accroche">
            Nos scooters en situation, filmés au Sénégal. Rien de mis en scène.
          </p>
        </div>

        <div className="lme-videos__grille">
          {VIDEOS.map((video) => {
            const enLecture = lancee === video.src;

            return (
              <article className="lme-video" key={video.src}>
                {enLecture ? (
                  <span className="lme-video__cadre">
                    {/*
                      Montée seulement après le clic : avant, ce nœud n'existe
                      pas, donc le navigateur n'a rien à télécharger.
                      `autoPlay` est légitime ici — c'est une lecture demandée.
                    */}
                    <video
                      src={video.src}
                      title={video.titre}
                      controls
                      autoPlay
                      muted={video.muet}
                      playsInline
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    className="lme-video__declencheur"
                    onClick={() => setLancee(video.src)}
                    aria-label={`Lire la vidéo : ${video.titre}`}
                  >
                    <span className="lme-video__cadre">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={video.vignette}
                        alt={video.alt}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="lme-video__voile" />
                      <span className="lme-video__lecture">
                        <IconeLecture />
                      </span>
                    </span>
                  </button>
                )}

                <span className="lme-video__pied">
                  <span className="lme-video__nom">{video.titre}</span>
                  {enLecture ? null : (
                    <span className="lme-video__appel">
                      Lire la vidéo
                      <IconeFleche />
                    </span>
                  )}
                </span>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}
