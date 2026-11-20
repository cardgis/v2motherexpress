import Link from 'next/link';
import { LIEN_RESERVER } from '@/lib/suite';
import { fcfa } from '@/lib/formatters';
import type { LigneGrille } from '@/lib/home-data';
import '@/styles/grille.css';

/**
 * « Tarifs de location » — la grille officielle, en clair.
 *
 * ── Pourquoi elle revient, après avoir été retirée ────────────────────────
 * Le 2026-11-19, Alexandre avait tranché : « la location, ce sera 24 h, on ne
 * fait pas 4 heures, 2 heures ». Les créneaux avaient donc disparu de
 * l'accueil. Le 2026-11-20 il a fourni la grille officielle — quatre créneaux
 * par modèle — et décidé de les reproposer. Cette section est la forme que
 * prend cette décision : les créneaux ne reviennent pas semés dans les
 * cartes, ils tiennent en UN endroit, où on vient les consulter.
 *
 * Les trois cartes de best-sellers gardent donc leur seul prix 24 h. Un
 * chiffre pour donner envie, un tableau pour décider : c'est la même raison
 * qui avait fait retirer « Journée : 7 000 » de dessous « 10 000 les 24 h ».
 *
 * ── TOUS LES MONTANTS VIENNENT DE LA BASE ─────────────────────────────────
 * `grilleLocation()` lit `Tarification`. Aucun chiffre n'est écrit ici — la
 * grille officielle a été portée en base, et c'est elle que la page relit. Un
 * tarif qui change ne se change qu'à un endroit.
 *
 * ── Deux choses du tableau papier qui N'Y SONT PAS ────────────────────────
 * Le numéro de téléphone, parce que l'accueil le donne déjà trois fois — dans
 * les agences, dans la capsule flottante et dans le pied. Et le tarif des
 * casques, qu'Alexandre a écarté : un accessoire à 500 F n'a pas sa place
 * dans la grille qui doit faire choisir un scooter.
 *
 * ── Le kilométrage, sorti du tableau ──────────────────────────────────────
 * La colonne « tarif km supplémentaire » valait 1 000 F / 10 km pour les six
 * lignes. Une colonne qui répète six fois la même valeur n'informe pas, elle
 * encombre : elle est devenue une phrase sous le tableau. Si un modèle s'en
 * écartait un jour, la phrase le dirait — elle est calculée, pas écrite.
 */

/**
 * Le C32 lithium ne vient PAS du catalogue, et c'est volontaire.
 *
 * Alexandre, 2026-11-20 : « c'est un modèle qui viendra après, pour l'instant
 * on l'affiche sur la grille ». Il figure donc au tableau des tarifs, et
 * nulle part ailleurs — ni dans le catalogue, ni dans la réservation, ni dans
 * le compte des modèles. Lui créer une fiche produit le rendrait réservable,
 * pour une moto qui n'existe pas encore en boutique.
 *
 * La mention « bientôt » n'est pas une promesse de disponibilité — celles-là
 * sont interdites depuis le 2026-11-06 (voir `home-data.ts`) : c'est
 * l'inverse, elle dit que ce modèle n'est pas encore là.
 */
const A_VENIR: LigneGrille[] = [
  {
    slug: 'revoo-c32-lithium',
    nom: 'C32 lithium',
    kmInclus: 100,
    kmSupplementaire: 1000,
    matin: 3500,
    apresMidi: 3500,
    journee: 7000,
    vingtQuatre: 9000,
    aVenir: true,
  },
];

const CRENEAUX = [
  { cle: 'matin', libelle: '8h – 13h', detail: 'La matinée' },
  { cle: 'apresMidi', libelle: '14h – 19h', detail: "L'après-midi" },
  { cle: 'journee', libelle: '8h – 19h', detail: 'La journée' },
  { cle: 'vingtQuatre', libelle: '24 h', detail: 'Un jour entier' },
] as const;

export function HomeGrilleSection({ lignes }: { lignes: LigneGrille[] }) {
  if (lignes.length === 0) return null;

  const toutes = [...lignes, ...A_VENIR];

  // Le forfait kilométrique est le même partout — on le dit une fois. S'il
  // divergeait un jour, la phrase cesserait d'être affirmative.
  const forfaits = new Set(lignes.map((l) => l.kmSupplementaire));
  const forfaitUnique = forfaits.size === 1 ? [...forfaits][0]! : null;

  return (
    <section className="lme-grille" id="tarifs">
      <div className="lme-grille__bande">

        <div className="lme-grille__entete">
          <p className="lme-grille__surtitre">Location à la journée</p>
          <h2 className="lme-grille__titre">La grille, sans surprise</h2>
          <p className="lme-grille__accroche">
            Quatre durées, six modèles. Le prix que vous lisez ici est celui que vous payez
            au comptoir.
          </p>
        </div>

        <div className="lme-grille__cadre">
          <table className="lme-grille__table">
            <caption className="lme-grille__legende">
              Tarifs de location par modèle et par créneau, en francs CFA.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="lme-grille__modele">Modèle</th>
                <th scope="col" className="lme-grille__km">Km inclus</th>
                {CRENEAUX.map((c) => (
                  <th key={c.cle} scope="col">
                    <span className="lme-grille__creneau">{c.libelle}</span>
                    <span className="lme-grille__detail">{c.detail}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {toutes.map((ligne) => (
                <tr key={ligne.slug} className={ligne.aVenir ? 'lme-grille__ligne--avenir' : undefined}>
                  <th scope="row" className="lme-grille__modele">
                    {ligne.nom}
                    {ligne.aVenir ? <span className="lme-grille__bientot">bientôt</span> : null}
                  </th>
                  <td className="lme-grille__km">{ligne.kmInclus} km</td>
                  {CRENEAUX.map((c) => (
                    <td key={c.cle} className={c.cle === 'vingtQuatre' ? 'lme-grille__phare' : undefined}>
                      {fcfa(ligne[c.cle])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lme-grille__pied">
          {forfaitUnique !== null ? (
            <p className="lme-grille__note">
              Au-delà du forfait, <strong>{fcfa(forfaitUnique)} par tranche de 10 km</strong>.
              Le casque est disponible en boutique.
            </p>
          ) : null}
          <Link href={LIEN_RESERVER} className="lme-grille__bouton">
            Réserver un scooter
          </Link>
        </div>

      </div>
    </section>
  );
}
