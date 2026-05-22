const VIDEOS = [
  {
    src: "/assets/videos/video-1.mp4",
    title: "Revoo en action",
  },
] as const;

export function HomeVideosSection() {
  return (
    <div className="section-videos">
      <div className="uk-section-large uk-container">
        <div
          className="section-title uk-text-center"
          data-reveal
        >
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
                  <div className="video-card__embed">
                    <video
                      src={video.src}
                      controls
                      muted
                      preload="metadata"
                      playsInline
                    />
                  </div>
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
