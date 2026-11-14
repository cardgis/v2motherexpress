import Link from 'next/link';
import { LIEN_RESERVER } from '@/lib/suite';
import { OFFRES_ACCESSION } from '@/lib/offres';
import { fcfa } from '@/lib/formatters';
import { responsiveImage } from '@/lib/img';
import '@/styles/offres.css';

/**
 * Location-accession — remplace « Promotion en cours / Offre du moment ».
 *
 * ── LE CADRAGE ÉTAIT LE PROBLÈME ──────────────────────────────────────────
 * Présenter en PROMOTION ce qui est le modèle économique de la maison le fait
 * passer pour une offre passagère. C'est au contraire le seul argument que
 * personne d'autre n'a : on paie en roulant, et à la fin le scooter est à
 * soi. La section devient donc le pivot de la page, et non une parenthèse.
 *
 * ── LES CHIFFRES SONT LUS DANS LE CODE, PLUS RECOPIÉS ─────────────────────
 * L'ancienne version écrivait « A10 · 3 000 FCFA/jour » et « B12 · 5 000 »
 * en dur dans le composant. Ils se trouvaient être justes, mais rien ne le
 * garantissait : changer une redevance dans `OFFRES_ACCESSION` laissait la
 * page d'accueil mentir.
 *
 * La formule mise en avant est désormais CALCULÉE — la redevance la plus
 * basse de toutes les offres — et sa durée, son engagement et son
 * complément de rupture viennent de la même source. Modifier `lib/offres.ts`
 * met la page à jour.
 *
 * ── L'IMAGE ───────────────────────────────────────────────────────────────
 * Même fichier, mais plafonné à 400 px au lieu de 700 (demande d'Alexandre,
 * 2026-11-14) et posé dans un cadre. Son texte alternatif est raccourci :
 * l'ancien récitait les prix, qui sont déjà dans la page et qui vieilliront —
 * une alternative décrit ce qu'on voit, elle ne répète pas le texte voisin.
 */

/** La redevance la plus basse, toutes offres confondues. */
function formuleEntree() {
  const toutes = Object.entries(OFFRES_ACCESSION).flatMap(([modele, offres]) =>
    offres.map((o) => ({ ...o, modele })),
  );
  return toutes.reduce((basse, o) =>
    o.redevanceJournaliere < basse.redevanceJournaliere ? o : basse,
  );
}

function IconeCoche() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconeFleche() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function HomeAccessionSection() {
  const entree = formuleEntree();

  return (
    <section className="lme-offres" id="accession">
      <div className="lme-offres__bande">

        <div className="lme-offres__entete">
          <div className="lme-offres__intro">
            <p className="lme-offres__surtitre">La formule qui change tout</p>
            <h2 className="lme-offres__titre">La location-accession, en clair</h2>
            <p className="lme-offres__accroche">
              Vous ne louez pas pour rien : chaque jour payé vous rapproche de la propriété.
              Aucun apport, aucune banque — une redevance quotidienne, et le scooter est à vous
              au terme du contrat.
            </p>
          </div>

          <div className="lme-offres__visuel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...responsiveImage('/assets/img/promo-location-scooters.jpg', '(max-width: 859px) calc(100vw - 52px), 400px')}
              alt="Scooters électriques Revoo alignés devant une agence La Mother Express"
              width="400"
              height="225"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <ol className="lme-offres__etapes">
          <li className="lme-etape">
            <span className="lme-etape__rang">1</span>
            <h3 className="lme-etape__titre">Vous choisissez</h3>
            <p className="lme-etape__texte">
              Un modèle, une durée, votre agence de retrait. Tout se fait depuis votre téléphone.
            </p>
          </li>
          <li className="lme-etape">
            <span className="lme-etape__rang">2</span>
            <h3 className="lme-etape__titre">Vous roulez</h3>
            <p className="lme-etape__texte">
              Une redevance par jour, due 6 jours sur 7. Le septième jour de la semaine n’est
              pas facturé.
            </p>
          </li>
          <li className="lme-etape lme-etape--terme">
            <span className="lme-etape__rang">3</span>
            <h3 className="lme-etape__titre">Le scooter est à vous</h3>
            <p className="lme-etape__texte">
              Au terme du contrat, la propriété vous est transférée. Rien de plus à payer.
            </p>
          </li>
        </ol>

        <article className="lme-entree">
          <div className="lme-entree__offre">
            <p className="lme-entree__sceau">La formule la moins chère</p>
            <h3 className="lme-entree__modele">Revoo {entree.modele}</h3>
            <p className="lme-entree__duree">
              {entree.dureeMois} mois{entree.avecEngagement ? ' fermes' : ' sans engagement'}, puis il est à vous
            </p>
            <p className="lme-entree__montant">
              <strong>{fcfa(entree.redevanceJournaliere)}</strong>
              <span>/ jour</span>
            </p>
          </div>

          <ul className="lme-entree__points">
            <li className="lme-entree__point">
              <IconeCoche />
              Dû 6 jours sur 7 seulement
            </li>
            <li className="lme-entree__point">
              <IconeCoche />
              Aucun apport, aucune banque
            </li>
            <li className="lme-entree__point">
              <IconeCoche />
              Propriété transférée au terme
            </li>
          </ul>

          <div className="lme-entree__actions">
            <Link href={LIEN_RESERVER} className="lme-entree__bouton">
              Choisir cette formule
              <IconeFleche />
            </Link>
            <Link href="/produits" className="lme-entree__lien">
              Voir les autres modèles
            </Link>
          </div>
        </article>

        {/* Le complément de rupture vient de l'offre elle-même : si la remise
            liée à l'engagement change, cette phrase change avec elle. */}
        {entree.avecEngagement && entree.differentielSiRupture > 0 ? (
          <p className="lme-offres__note">
            Avec engagement, un arrêt anticipé de votre fait rend dû un complément de{' '}
            {fcfa(entree.differentielSiRupture)} par jour loué — c’est la contrepartie de la
            remise. Sans engagement, aucun complément n’est dû.
          </p>
        ) : null}

      </div>
    </section>
  );
}
