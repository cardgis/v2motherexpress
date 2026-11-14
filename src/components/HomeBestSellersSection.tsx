import Link from 'next/link';
import { LIEN_RESERVER } from '@/lib/suite';
import { fcfa } from '@/lib/formatters';
import type { ProduitHome } from '@/types';
import '@/styles/best.css';

/**
 * « Nos best-sellers » — les trois modèles mis en avant, juste après le
 * bandeau, comme en V1.
 *
 * ── POURQUOI UNE SECTION NEUVE, ET NON UN RESTYLAGE DE `ProductExplorer` ──
 * `ProductExplorer` et `ProductCard` portent le bug d'interactivité SPA
 * documenté en tête de `CLAUDE.md` : un script du thème y écrasait les
 * classes gérées par React, et la correction tient à ce que TOUT y passe par
 * l'état React. Les restyler demanderait d'entrer dans ce mécanisme pour un
 * gain purement visuel — et le fichier prévient explicitement contre ce genre
 * d'aller-retour.
 *
 * La section d'accueil est donc une composante SERVEUR, sans état, sans
 * script, qui affiche trois cartes. `ProductExplorer` reste intact et
 * continue de servir `/produits`, où son panneau de détail et son carrousel
 * ont toute leur utilité.
 *
 * ── CE QUI VIENT D'OÙ ─────────────────────────────────────────────────────
 * Les spécifications et le tarif 24 h viennent de `produits`, déjà chargé par
 * la page avec la sélection et l'ORDRE de `BEST_SELLER_SLUGS`. La redevance
 * d'accession vient de `OFFRES_ACCESSION`, par modèle.
 *
 * L'étiquette d'usage est le seul texte éditorial, et elle n'est pas
 * décorative : chaque modèle est nommé par ce qui le distingue réellement
 * dans ses chiffres — l'autonomie du B12, la vitesse de l'E52, le prix
 * d'entrée de l'A10. Un modèle sans étiquette s'affiche sans étiquette plutôt
 * qu'avec une phrase inventée.
 *
 * ── AUCUN PRIX COMPTANT, AUCUNE DISPONIBILITÉ ─────────────────────────────
 * Le total d'un scooter sous « 5 500 F / jour » annule l'effet du premier
 * chiffre (Alexandre, 2026-11-14) : les totaux vivent dans la fiche produit.
 * Et aucune mention de stock, que `home-data.ts` interdit depuis le
 * 2026-11-06.
 */

/** Ce qui distingue chaque modèle, d'après ses propres chiffres. */
const USAGES: Record<string, string> = {
  'revoo-e52': 'Pour la route',
  'revoo-b12': 'Pour la livraison',
  'revoo-a10': 'Pour la ville',
};

function IconeVitesse() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M13.4 12.6 19 7" />
      <path d="M4 20a9 9 0 1 1 16 0" />
    </svg>
  );
}

function IconeAutonomie() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <path d="M22 11v2" />
      <path d="M6 11v2" />
      <path d="M10 11v2" />
    </svg>
  );
}

function IconeFleche({ taille = 16 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function HomeBestSellersSection({ produits }: { produits: ProduitHome[] }) {
  if (produits.length === 0) return null;

  return (
    <section className="lme-best" id="best">
      <div className="lme-best__bande">

        <div className="lme-best__entete">
          <div>
            <p className="lme-best__surtitre">Nos best-sellers</p>
            <h2 className="lme-best__titre">Les trois plus demandés</h2>
            <p className="lme-best__accroche">
              Trois usages, trois réponses. Si vous hésitez, la vôtre est probablement là.
            </p>
          </div>
          <Link href="/produits" className="lme-best__tout">
            Tout le catalogue
            <IconeFleche />
          </Link>
        </div>

        <div className="lme-best__grille">
          {produits.map((produit, i) => {
            const usage = USAGES[produit.slug];
            const vingtQuatre = produit.tarification?.tarif24hFcfa;
            const journee = produit.tarification?.tarifJourneeFcfa;

            return (
              <article className="lme-bs" key={produit.id}>

                <div className="lme-bs__visuel">
                  {produit.imageUrl ? (
                    /*
                      `alt=""` : l'image est DÉCORATIVE ici, parce que le nom
                      du modèle est écrit juste en dessous, en titre. Avec
                      `alt="Revoo B12"` un lecteur d'écran annonçait « Revoo
                      B12 » deux fois de suite — défaut repéré par Alexandre
                      le 2026-11-14, en copiant le texte de la page.
                      Sur `/produits`, où la fiche sert à identifier un modèle,
                      l'alternative garde tout son sens : c'est le contexte
                      qui décide, pas l'image.
                    */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={produit.imageUrl}
                      alt=""
                      width="320"
                      height="240"
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  ) : null}
                  <span className="lme-bs__rang" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="lme-bs__corps">
                  <div>
                    {usage ? <p className="lme-bs__usage">{usage}</p> : null}
                    <h3 className="lme-bs__nom">{produit.nom}</h3>
                  </div>

                  <ul className="lme-bs__specs">
                    {produit.vitesseMaxKmh ? (
                      <li className="lme-bs__spec">
                        <IconeVitesse />
                        {produit.vitesseMaxKmh} km/h
                      </li>
                    ) : null}
                    {produit.autonomieKm ? (
                      <li className="lme-bs__spec">
                        <IconeAutonomie />
                        {produit.autonomieKm} km
                      </li>
                    ) : null}
                  </ul>

                  <div>
                    {/*
                      DONNÉES DE BASE, pas la redevance d_accession (Alexandre,
                      2026-11-14) : « les prix en promo on a mis sur une section
                      avec une image, les autres données restent ceux de base ».
                      Les tarifs d_accession vivent donc dans la section
                      accession, qui porte l_image, et la carte annonce la
                      location — un chiffre modeste et sans condition.
                    */}
                    {vingtQuatre ? (
                      <p className="lme-bs__prix">
                        <strong>{fcfa(vingtQuatre)}</strong>
                        <span>les 24 heures</span>
                      </p>
                    ) : null}
                    {journee ? (
                      <p className="lme-bs__second">Journée : {fcfa(journee)}</p>
                    ) : null}
                  </div>

                  <div className="lme-bs__actions">
                    <Link href={LIEN_RESERVER} className="lme-bs__reserver">
                      Réserver
                      <IconeFleche />
                    </Link>
                    <Link href="/produits" className="lme-bs__fiche">
                      La fiche
                      <IconeFleche taille={14} />
                    </Link>
                  </div>
                </div>

              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}
