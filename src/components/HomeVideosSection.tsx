const VIDEOS = [
  {
    src: "/assets/videos/video-1.mp4",
    title: "Revoo en action",
    coming: false,
  },
  {
    src: "/assets/videos/video-2.mp4",
    title: "Balade au Sénégal",
    coming: true,
  },
  {
    src: "/assets/videos/video-3.mp4",
    title: "La Mother Express",
    coming: true,
  },
  {
    src: "/assets/videos/video-4.mp4",
    title: "Nos scooters électriques",
    coming: true,
  },
];

export function HomeVideosSection() {
  return (
    <div className="section-videos">
      <div className="uk-section-large uk-container">
        <div className="section-title uk-text-center" data-reveal>
          <span>La Mother Express en mouvement</span>
          <h3 className="uk-h2">Nos vidéos</h3>
          <span className="section-title-bar" />
        </div>
        <div className="section-content">
          <div className="uk-grid uk-grid-medium uk-child-width-1-2@s" data-uk-grid>
            {VIDEOS.map((video, index) => (
              <div
                key={video.src}
                data-reveal
                style={{ '--reveal-delay': `${index * 0.10}s` } as React.CSSProperties}
              >
                <div className="video-card">
                  {video.coming ? (
                    <div className="video-card__coming">
                      <div className="video-card__coming-icon" aria-hidden="true">
                        <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="24" cy="24" r="20" />
                          <polyline points="24 14 24 24 30 30" />
                        </svg>
                      </div>
                      <span className="video-card__coming-label">Bientôt disponible</span>
                    </div>
                  ) : (
                    <div className="video-card__embed">
                      <video
                        src={video.src}
                        controls
                        muted
                        preload="metadata"
                        playsInline
                      />
                    </div>
                  )}
                  <div className="video-card__title">{video.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
