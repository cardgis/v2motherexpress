import Link from 'next/link';
import { LIEN_RESERVER } from '@/lib/suite';
import { responsiveImage } from '@/lib/img';
import '@/styles/heros.css';

/**
 * Bandeau d'accueil.
 *
 * ── LE DIAPORAMA EST INVERSÉ (2026-11-14) ─────────────────────────────────
 * La V1 faisait défiler trois SLOGANS — « La liberté, ça se conduit. »,
 * « Partenaire officiel Revoo Sénégal », « Besoin d'un scooter aujourd'hui ? »
 * — plus « DemRek » en filigrane sur chacune. Quatre messages pour un
 * visiteur qui n'en retenait aucun, et aucun prix nulle part.
 *
 * Alexandre a validé le principe : on garde un diaporama, mais c'est le
 * MESSAGE qui ne bouge plus et les IMAGES qui respirent. Le titre, le tarif
 * d'entrée et les deux boutons restent sous les yeux en permanence. Le fondu
 * est en CSS pur — aucun JavaScript, et il s'annule pour qui a demandé moins
 * d'animations.
 *
 * ── CE QUI EST GARDÉ DE LA V1, ET POURQUOI ────────────────────────────────
 * La première image en `eager` et `fetchPriority="high"` : c'est la plus
 * grande de la page, celle qui décide du LCP. Les deux autres en `lazy` et
 * `low`. Perdre ce réglage aurait abîmé la vitesse perçue sans rien dire.
 *
 * Les boutons rendus UNE SEULE FOIS, hors des diapositives : ils restent
 * atteignables au clavier quelle que soit l'image affichée. Le raisonnement
 * d'origine était juste.
 *
 * Les particules dorées, ralenties et atténuées : elles donnent sa chaleur au
 * bandeau, et ce fond sombre les porte mieux qu'une photo claire.
 *
 * « Dem rek » est conservé mais PROMU : une seule occurrence, en sur-titre,
 * là où une signature de marque a du poids — au lieu d'un filigrane répété
 * qui ne disait rien à qui ne le connaît pas.
 *
 * ── CE QUI EST ABANDONNÉ, DÉLIBÉRÉMENT ───────────────────────────────────
 * Les flèches `data-uk-slidenav` : sans le JavaScript du thème, elles ne
 * faisaient rien. Des indicateurs qui disent OÙ l'on est valent mieux que des
 * flèches qui ne mènent nulle part. Et l'indicateur de défilement, qui n'a de
 * sens que sur un bandeau occupant toute la hauteur.
 */

/**
 * Les trois mêmes images que la V1 — mais désignées par leur ORIGINAL.
 *
 * La V1 écrivait `/assets/img/header1-1920.webp` et passait ce chemin à
 * `responsiveImage`. Or cette fonction cherche l'original dans le manifeste :
 * lui donner une variante échoue en silence, et elle rendait donc un `<img>`
 * nu, sans `srcset`. Chaque visiteur téléchargeait les trois images en
 * 1920 px — environ 270 Ko — y compris sur un téléphone de 390 px de large.
 *
 * Avec le chemin original, le manifeste rend tout l'éventail (400 px et plus)
 * et le navigateur choisit selon `sizes="100vw"`. Sur un téléphone, le
 * bandeau passe de ~270 Ko à quelques dizaines de kilo-octets. C'est le même
 * réglage que la V1 voulait, et qui ne s'appliquait pas.
 */
const IMAGES = [
  {
    src: '/assets/img/header1.png',
    alt: 'Scooter électrique REVOO en balade au Sénégal — La Mother Express',
  },
  { src: '/assets/img/header2.jpg', alt: '' },
  { src: '/assets/img/header3.jpg', alt: '' },
] as const;

function IconeFleche() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function HomeHeroAbout() {
  return (
    <section className="lme-heros">

      {/* Les images sont décoratives à partir de la deuxième : une seule porte
          le texte alternatif, les autres ne disent rien de plus. */}
      <div className="lme-heros__fond" aria-hidden="true">
        {IMAGES.map((image, i) => (
          <img
            key={image.src}
            {...responsiveImage(image.src, '100vw')}
            alt={i === 0 ? image.alt : ''}
            width="1920"
            height="1080"
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'low'}
            decoding="async"
            className={`lme-heros__image lme-heros__image--${i + 1}`}
          />
        ))}
      </div>

      <div className="lme-heros__voile" aria-hidden="true" />
      <div className="lme-heros__ourlet" aria-hidden="true" />

      <div className="lme-heros__particules" aria-hidden="true">
        <span className="lme-heros__particule" />
        <span className="lme-heros__particule" />
        <span className="lme-heros__particule" />
        <span className="lme-heros__particule" />
        <span className="lme-heros__particule" />
      </div>

      <div className="lme-heros__bande">
        <div className="lme-heros__texte">

          <p className="lme-heros__pastille">
            <span className="lme-heros__signature">Dem rek</span>
            <span className="lme-heros__separateur" aria-hidden="true">·</span>
            Partenaire officiel Revoo · Thiès &amp; Mbour
          </p>

          <h1 className="lme-heros__titre">
            Roulez aujourd’hui.<br />
            Le scooter devient <em>le vôtre</em>.
          </h1>

          <p className="lme-heros__accroche">
            Location à la journée, ou location-accession : vous payez une redevance par jour,
            6 jours sur 7 — et à la fin du contrat, le scooter vous appartient.
          </p>

          <div className="lme-heros__rangee">
            {/* Rendus une seule fois, hors des images : atteignables au
                clavier quelle que soit la diapositive affichée. */}
            <div className="lme-heros__boutons">
              <Link href={LIEN_RESERVER} className="lme-heros__bouton lme-heros__bouton--principal">
                Réserver en ligne
                <IconeFleche />
              </Link>
              <Link href="/produits" className="lme-heros__bouton lme-heros__bouton--secondaire">
                Voir les 5 modèles
              </Link>
            </div>

            <div className="lme-heros__prix">
              <p className="lme-heros__montant">
                3 000 F<span> / jour</span>
              </p>
              <p className="lme-heros__condition">sans engagement — modèle A10</p>
            </div>
          </div>

          <dl className="lme-heros__faits">
            <div>
              <dt>140 km</dt>
              <dd>d’autonomie au mieux</dd>
            </div>
            <div>
              <dt>5 modèles</dt>
              <dd>au catalogue</dd>
            </div>
            <div>
              <dt>0 F</dt>
              <dd>de carburant, jamais</dd>
            </div>
          </dl>

          <div className="lme-heros__points" aria-hidden="true">
            <span className="lme-heros__point lme-heros__point--1" />
            <span className="lme-heros__point lme-heros__point--2" />
            <span className="lme-heros__point lme-heros__point--3" />
          </div>

        </div>
      </div>
    </section>
  );
}
