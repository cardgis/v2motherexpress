import { responsiveImage } from "@/lib/img";

const OFFERS = [
  { model: "A10", price: "3 000 FCFA/jour", gift: "Scooter offert après 14 mois de location" },
  { model: "B12", price: "5 000 FCFA/jour", gift: "Scooter offert après 24 mois de location" },
] as const;

export function HomePromoSection() {
  return (
    <section className="section-promo">
      <div className="promo__inner">

        <div className="promo__text" data-reveal>
          <div className="promo__eyebrow">Promotion en cours</div>
          <h2 className="promo__title">
            Offre <span className="promo__title--gold">du moment</span>
          </h2>
          <p className="promo__desc">
            Location de scooters pour <strong>professionnels &amp; entreprises</strong>, 6 jours sur 7.
            Roulez aujourd’hui, le scooter devient le vôtre à la fin du contrat.
          </p>

          <ul className="promo__offers">
            {OFFERS.map((offer) => (
              <li key={offer.model} className="promo__offer">
                <span className="promo__offer-head">
                  <strong>{offer.model}</strong> · {offer.price}
                </span>
                <span className="promo__offer-gift">{offer.gift}</span>
              </li>
            ))}
          </ul>

          <a className="promo__btn" href="tel:+221772320235">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
            <span>+221 77 232 02 35</span>
          </a>
        </div>

        <div className="promo__media" data-reveal>
          <img
            {...responsiveImage("/assets/img/promo-location-scooters.jpg", "(max-width: 859px) calc(100vw - 40px), 700px")}
            alt="Location de scooters pour professionnels et entreprises : A10 à 3000 FCFA/jour, B12 à 5000 FCFA/jour, scooter offert en fin de location"
            width="1280"
            height="720"
            loading="lazy"
            decoding="async"
            className="promo__image"
          />
        </div>

      </div>
    </section>
  );
}
