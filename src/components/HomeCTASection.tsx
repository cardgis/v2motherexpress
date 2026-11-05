import Link from "next/link";
import { LIEN_RESERVER } from "@/lib/suite";
import { quantite } from "@/lib/formatters";

/** Le nombre de modèles vient du catalogue : il suit les ajouts et retraits de l'administration. */
export function HomeCTASection({ nombreModeles }: { nombreModeles: number }) {
  return (
    <section className="section-cta-catalogue">
      <div className="cta-catalogue__inner">

        <div className="cta-catalogue__eyebrow" data-reveal>
          Mobilité électrique au Sénégal
        </div>

        <h2 className="cta-catalogue__title" data-reveal>
          Trouvez le scooter<br />
          <span className="cta-catalogue__title--gold">fait pour vous</span>
        </h2>

        <p className="cta-catalogue__desc" data-reveal>
          De la petite balade urbaine aux longues distances — nos <strong>{quantite(nombreModeles, "modèle")} REVOO</strong>{" "}couvrent
          tous les usages. Comparez les autonomies, les tarifs de location et les prix d&apos;achat
          en un seul coup d&apos;œil.
        </p>

        <div className="cta-catalogue__action" data-reveal>
          <Link href="/produits" className="cta-catalogue__btn">
            <span>{nombreModeles > 1 ? `Voir nos ${nombreModeles} modèles de scooters` : "Voir le catalogue"}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link href={LIEN_RESERVER} className="cta-catalogue__btn cta-catalogue__btn--contour">
            <span>Réserver en ligne</span>
          </Link>
        </div>

        {/* Décor particules */}
        <div className="cta-catalogue__particles" aria-hidden="true">
          <div className="cta-catalogue__particle cta-catalogue__particle--1" />
          <div className="cta-catalogue__particle cta-catalogue__particle--2" />
          <div className="cta-catalogue__particle cta-catalogue__particle--3" />
        </div>

      </div>
    </section>
  );
}
