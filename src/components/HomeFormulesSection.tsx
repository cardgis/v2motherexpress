import Link from 'next/link';
import { LIEN_RESERVER } from '@/lib/suite';
import { OFFRES_ACCESSION } from '@/lib/offres';
import { fcfa } from '@/lib/formatters';
import type { BornesTarifs } from '@/lib/home-data';
import '@/styles/formules.css';

/**
 * « Trois façons de rouler » — le moment de décision qui manquait.
 *
 * Un visiteur devant cinq modèles et trois formules ne sait pas par où
 * commencer. Cette section répond AVANT le choix du modèle : combien de temps
 * en avez-vous besoin, et voulez-vous finir par le posséder ?
 *
 * ── TOUS LES CHIFFRES SONT CALCULÉS, AUCUN N'EST ÉCRIT EN DUR ─────────────
 * Les trois prix d'entrée sont les minimums réels du catalogue : la plus
 * petite demi-journée, la plus petite redevance d'accession, le plus petit
 * prix d'achat. Ils suivent donc `Tarification` et `OFFRES_ACCESSION` sans
 * qu'on y pense, et le jour où l'administration ajoute un modèle moins cher,
 * la page le dit d'elle-même.
 *
 * `produits` est le catalogue complet, déjà chargé par la page.
 */

function IconeFleche() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function HomeFormulesSection({ bornes }: { bornes: BornesTarifs }) {
  const demiJournee = bornes.demiJourneeMin;
  const journee = bornes.journeeMin;
  const vingtQuatre = bornes.vingtQuatreMin;
  const achat = bornes.achatMin;
  const achatMax = bornes.achatMax;

  const redevances = Object.values(OFFRES_ACCESSION).flat();
  const accession = redevances.length > 0 ? Math.min(...redevances.map((o) => o.redevanceJournaliere)) : null;
  const durees = redevances.map((o) => o.dureeMois);
  const dureeMin = durees.length > 0 ? Math.min(...durees) : null;
  const dureeMax = durees.length > 0 ? Math.max(...durees) : null;

  return (
    <section className="lme-formules" id="formules">
      <div className="lme-formules__bande">

        <div className="lme-formules__entete">
          <p className="lme-formules__surtitre">Avant de choisir un modèle</p>
          <h2 className="lme-formules__titre">Trois façons de rouler</h2>
          <p className="lme-formules__accroche">
            La bonne formule dépend d’une seule chose : combien de temps vous en avez besoin,
            et si vous voulez finir par le posséder.
          </p>
        </div>

        <div className="lme-formules__grille">

          <article className="lme-formule">
            <p className="lme-formule__pour">Un besoin ponctuel</p>
            <h3 className="lme-formule__nom">Location à la journée</h3>
            <p className="lme-formule__texte">
              Vous avez besoin d’un scooter quelques heures, quelques jours, le temps d’un
              déplacement.
            </p>
            {demiJournee !== null ? (
              <p className="lme-formule__prix">
                <strong>{fcfa(demiJournee)}</strong>
                <span>la demi-journée</span>
              </p>
            ) : null}
            <dl className="lme-formule__faits">
              <div><dt>Durée</dt><dd>D’un jour à un mois</dd></div>
              {journee !== null && vingtQuatre !== null ? (
                <div><dt>Journée / 24 h</dt><dd>{fcfa(journee)} / {fcfa(vingtQuatre)}</dd></div>
              ) : null}
              <div><dt>Au terme</dt><dd className="lme-formule__neutre">Vous le rendez</dd></div>
            </dl>
            <Link href={LIEN_RESERVER} className="lme-formule__bouton">Louer à la journée</Link>
          </article>

          <article className="lme-formule lme-formule--phare">
            <p className="lme-formule__sceau">Le plus choisi</p>
            <h3 className="lme-formule__nom">Location-accession</h3>
            <p className="lme-formule__texte">
              Vous voulez qu’il soit à vous, mais vous n’avez pas la somme d’un coup.
              Vous payez en roulant.
            </p>
            {accession !== null ? (
              <p className="lme-formule__prix">
                <strong>{fcfa(accession)}</strong>
                <span>par jour</span>
              </p>
            ) : null}
            <dl className="lme-formule__faits">
              {dureeMin !== null && dureeMax !== null ? (
                <div><dt>Durée</dt><dd>{dureeMin} à {dureeMax} mois</dd></div>
              ) : null}
              <div><dt>Apport</dt><dd>Aucun</dd></div>
              <div><dt>Au terme</dt><dd className="lme-formule__gain">Il est à vous</dd></div>
            </dl>
            <Link href="#accession" className="lme-formule__bouton lme-formule__bouton--or">
              Comprendre l’accession
              <IconeFleche />
            </Link>
          </article>

          <article className="lme-formule">
            <p className="lme-formule__pour">Vous avez la somme</p>
            <h3 className="lme-formule__nom">Achat comptant</h3>
            <p className="lme-formule__texte">
              Le scooter est à vous le jour même, sans échéance à suivre et sans durée à
              respecter.
            </p>
            {achat !== null ? (
              <p className="lme-formule__prix">
                <strong>{fcfa(achat)}</strong>
                <span>le modèle d’entrée</span>
              </p>
            ) : null}
            <dl className="lme-formule__faits">
              {achatMax !== null ? (
                <div><dt>Jusqu’à</dt><dd>{fcfa(achatMax)}</dd></div>
              ) : null}
              <div><dt>Échéances</dt><dd>Paiement échelonné possible</dd></div>
              <div><dt>Au terme</dt><dd className="lme-formule__gain">À vous tout de suite</dd></div>
            </dl>
            <Link href="/produits" className="lme-formule__bouton">Voir les prix</Link>
          </article>

        </div>
      </div>
    </section>
  );
}
