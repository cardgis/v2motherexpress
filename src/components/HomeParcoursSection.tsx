import Link from 'next/link';
import { LIEN_RESERVER } from '@/lib/suite';
import '@/styles/parcours.css';

/**
 * « Comment réserver » — section neuve, 2026-11-14.
 *
 * La vitrine montrait ce qu'on vend et à quel prix, jamais COMMENT on
 * l'obtient. Or le parcours est ce que la V2 a de singulier : le dossier se
 * dépose depuis un téléphone, le contrat se lit et se signe en ligne, et un
 * code reçu par SMS atteste de la signature. Sept mois de travail qui ne se
 * voyaient nulle part.
 *
 * Les quatre étapes décrivent le parcours RÉEL — celui de
 * `lib/contrats/signature.ts` et du retrait en agence — et non un parcours
 * idéalisé. Si l'enchaînement change dans le code, ce texte doit changer
 * avec lui.
 */

const ETAPES = [
  {
    rang: '01',
    titre: 'Choisissez votre scooter et votre formule',
    texte:
      'À la journée, en location-accession, ou à l’achat. Le montant s’affiche avant que vous validiez.',
  },
  {
    rang: '02',
    titre: 'Déposez votre dossier',
    texte:
      'Vos coordonnées et une photo de votre pièce d’identité. L’agence vérifie, et vous êtes prévenu.',
  },
  {
    rang: '03',
    titre: 'Signez votre contrat en ligne',
    texte:
      'Vous le lisez, vous signez du doigt, et un code reçu par SMS atteste que c’est bien vous.',
  },
  {
    rang: '04',
    titre: 'Retirez le scooter en agence',
    texte:
      'Présentez votre code de retrait et l’original de votre pièce. L’état des lieux est fait avec vous.',
  },
] as const;

function IconeFleche() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function HomeParcoursSection() {
  return (
    <section className="lme-parcours" id="reserver">
      <div className="lme-parcours__bande">

        <div className="lme-parcours__intro">
          <p className="lme-surtitre">En quatre étapes</p>
          <h2 className="lme-titre-section">Réserver prend quelques minutes</h2>
          <p className="lme-parcours__accroche">
            Tout se passe en ligne, jusqu’à la signature. Vous ne venez en agence que pour
            repartir avec le scooter.
          </p>
          <Link href={LIEN_RESERVER} className="lme-parcours__bouton">
            Commencer ma réservation
            <IconeFleche />
          </Link>
        </div>

        <ol className="lme-parcours__etapes">
          {ETAPES.map((etape) => (
            <li className="lme-parcours__etape" key={etape.rang}>
              <span className="lme-parcours__rang" aria-hidden="true">{etape.rang}</span>
              <div>
                <h3 className="lme-parcours__titre">{etape.titre}</h3>
                <p className="lme-parcours__texte">{etape.texte}</p>
              </div>
            </li>
          ))}
        </ol>

      </div>
    </section>
  );
}
