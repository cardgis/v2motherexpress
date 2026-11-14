import { OFFRES_ACCESSION } from '@/lib/offres';
import { fcfa } from '@/lib/formatters';
import '@/styles/parcours.css';

/**
 * « Questions fréquentes » — section neuve, 2026-11-14.
 *
 * Les objections d'un locataire-accédant sont concrètes : quels papiers, qui
 * paie quoi, et si j'arrête. Les laisser sans réponse, c'est les laisser
 * décider à notre place.
 *
 * ── CHAQUE RÉPONSE VIENT D'UNE RÈGLE RÉELLE DU CONTRAT ────────────────────
 * Les papiers, la redevance due 6 jours sur 7, le constat fait avec le
 * client, la signature par code SMS : ce sont les règles de `lib/contrats` et
 * du retrait, pas des promesses commerciales. Le complément de rupture est
 * même LU dans `OFFRES_ACCESSION`, pour qu'il ne puisse pas dériver.
 *
 * ── LA QUESTION QUI N'EST PAS LÀ ──────────────────────────────────────────
 * « Qui paie l'entretien et l'assurance ? » a été retirée : la réponse n'est
 * nulle part dans le contrat, et Alexandre a tranché le 2026-11-13 — si on
 * n'a pas la donnée, on ne met pas la case. Elle reviendra le jour où la
 * réponse existera.
 */

/**
 * L'offre avec engagement, celle qui porte un complément de rupture.
 *
 * Le modèle est la CLÉ de `OFFRES_ACCESSION`, pas un champ de l'offre : il
 * faut donc passer par `Object.entries` pour le garder. Avec `Object.values`
 * on perd le nom du modèle, et la phrase ne peut plus le nommer.
 */
function offreAvecEngagement() {
  for (const [modele, offres] of Object.entries(OFFRES_ACCESSION)) {
    const trouvee = offres.find((o) => o.avecEngagement && o.differentielSiRupture > 0);
    if (trouvee) return { ...trouvee, modele };
  }
  return null;
}

function IconeTelephone() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

export function HomeQuestionsSection() {
  const engagement = offreAvecEngagement();

  return (
    <section className="lme-questions" id="questions">
      <div className="lme-questions__bande">

        <div className="lme-questions__entete">
          <p className="lme-surtitre">Ce qu’on nous demande le plus</p>
          <h2 className="lme-titre-section">Questions fréquentes</h2>
        </div>

        <dl className="lme-questions__liste">

          <div className="lme-question">
            <dt>Quels papiers faut-il ?</dt>
            <dd>
              Une pièce d’identité en cours de validité : vous la photographiez dans votre
              espace, et vous présentez l’original au retrait en agence. C’est tout.
            </dd>
          </div>

          <div className="lme-question">
            <dt>La redevance est-elle due tous les jours ?</dt>
            <dd>
              Non. Elle est due <strong>6 jours sur 7</strong> : le septième jour de chaque
              semaine n’est pas facturé.
            </dd>
          </div>

          <div className="lme-question">
            <dt>Et si j’arrête avant la fin ?</dt>
            <dd>
              Sans engagement, vous arrêtez quand vous voulez.
              {engagement ? (
                <>
                  {/* « modèle A10 » et non « le A10 » : l'élision dépend de la
                      PRONONCIATION de la lettre — « l'A10 » et « l'E52 », mais
                      « le B12 » et « le C32 ». Coder cette règle serait fragile ;
                      supprimer l'article la rend sans objet, quelle que soit la
                      lettre du modèle ajouté demain. */}
                  {' '}Avec engagement — modèle {engagement.modele}, {engagement.dureeMois} mois
                  — un complément de{' '}
                  <span className="lme-nombre">{fcfa(engagement.differentielSiRupture)} par jour loué</span>{' '}
                  reste dû : c’est la contrepartie de la remise.
                </>
              ) : null}
            </dd>
          </div>

          <div className="lme-question">
            <dt>Comment l’état du scooter est-il constaté ?</dt>
            <dd>
              Un constat est fait <strong>avec vous</strong> au retrait, photos comprises, et un
              second au retour. Les deux restent dans votre espace : personne ne peut vous
              reprocher un dommage qui n’y figure pas.
            </dd>
          </div>

          <div className="lme-question">
            <dt>Puis-je signer sans venir en agence ?</dt>
            <dd>
              Oui. Vous lisez le contrat dans votre espace, vous signez du doigt, et un code reçu
              par SMS atteste que c’est bien vous. Vous ne venez que pour prendre le scooter.
            </dd>
          </div>

        </dl>

        <div className="lme-questions__appel">
          <p>Une question qui n’est pas là ? Appelez l’agence, on répond en deux minutes.</p>
          <a className="lme-questions__tel" href="tel:+221772320235">
            <IconeTelephone />
            77 232 02 35
          </a>
        </div>

      </div>
    </section>
  );
}
