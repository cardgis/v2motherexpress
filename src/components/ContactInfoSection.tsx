function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}


function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}


function NavIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
    </svg>
  );
}

function MapEmbed({ src, title, directionsUrl }: { src: string; title: string; directionsUrl: string }) {
  return (
    <div className="contact-map-wrapper">
      <div className="contact-map-embed">
        <iframe
          src={src}
          title={title}
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        className="contact-directions-btn"
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <NavIcon />
        Y aller
      </a>
    </div>
  );
}

export function ContactInfoSection() {
  return (
    <section className="section-contact-info">
      <div className="contact-info-container">

        <div className="contact-info-header">
          <p className="contact-eyebrow">Où nous trouver</p>
          <h1 className="contact-heading">Nos agences</h1>
        </div>

        <div className="contact-branches-grid">

          {/* — Mbour — */}
          <div className="contact-branch">
            <div className="contact-branch__city">MBOUR</div>
            <div className="contact-branch__manager">
              <span className="contact-branch__role">Gérant</span>
              <span className="contact-branch__name">Olivier</span>
            </div>
            <div className="contact-branch__phones">
              <a className="contact-branch__phone" href="tel:+221703677575">
                <PhoneIcon />
                +221 70 367 75 75
              </a>
            </div>
            <MapEmbed
              src="https://maps.google.com/maps?q=C2W7%2B5C+M%27bour%2C+S%C3%A9n%C3%A9gal&output=embed&hl=fr&z=16"
              title="La Mother Express Mbour"
              directionsUrl="https://www.google.com/maps/dir/?api=1&destination=C2W7%2B5C+M%27bour%2C+S%C3%A9n%C3%A9gal"
            />
          </div>

          {/* — Thiès — */}
          <div className="contact-branch">
            <div className="contact-branch__city">THIÈS</div>
            <div className="contact-branch__manager">
              <span className="contact-branch__role">Gérant</span>
              <span className="contact-branch__name">Lazare</span>
            </div>
            <div className="contact-branch__phones">
              <a className="contact-branch__phone" href="tel:+221772320235">
                <PhoneIcon />
                +221 77 232 02 35
              </a>
              <a className="contact-branch__phone" href="tel:+221700019193">
                <PhoneIcon />
                +221 70 001 91 93
              </a>
              <a className="contact-branch__phone" href="tel:+221763728340">
                <PhoneIcon />
                +221 76 372 83 40
              </a>
            </div>
            <MapEmbed
              src="https://maps.google.com/maps?q=Q3F7%2B7J%2C+Thi%C3%A8s%2C+S%C3%A9n%C3%A9gal&output=embed&hl=fr&z=16"
              title="La Mother Express Thiès"
              directionsUrl="https://www.google.com/maps/dir/?api=1&destination=Q3F7%2B7J%2C+Thi%C3%A8s%2C+S%C3%A9n%C3%A9gal"
            />
          </div>

        </div>

        {/* Email partagé */}
        <div className="contact-email-shared">
          <a className="contact-email-link" href="mailto:lamotherexpress@gmail.com">
            <MailIcon />
            lamotherexpress@gmail.com
          </a>
        </div>

      </div>
    </section>
  );
}
