import '@/styles/agences.css';

/**
 * Section « Nos agences » — accueil et page `/contact`.
 *
 * ── Refonte du 2026-11-14 : la présentation seule ─────────────────────────
 * La carte Google ne change pas de nature : c'est le même `iframe` en
 * chargement différé, avec le même code Plus et le même lien d'itinéraire.
 * Ce qui change est sa PLACE. Elle était posée à côté des informations : on
 * lisait l'adresse d'un côté, on cherchait le plan de l'autre. Elle coiffe
 * maintenant la fiche, comme une photo de devanture, et le code Plus se lit
 * dessus — au Sénégal, c'est lui qui situe, pas le nom de rue.
 *
 * ── Les deux agences sont devenues des DONNÉES ────────────────────────────
 * Le JSX dupliquait la fiche entière pour Mbour puis pour Thiès, numéros
 * compris. Une troisième agence demandait de recopier le bloc, et les trois
 * numéros de Thiès ne se voyaient qu'en lisant le balisage. Tout est
 * désormais dans `AGENCES`, et la fiche est écrite une fois.
 *
 * L'ordre est celui de la V1 — Mbour, puis Thiès — et `telephones` garde ses
 * trois lignes pour Thiès : le premier numéro mène la fiche, les suivants
 * s'affichent sous lui.
 *
 * Les adresses viennent d'Alexandre (2026-11-12) et n'étaient pas sur la V1 ;
 * elles situent mieux qu'un code Plus pour qui lit, et le code Plus reste là
 * pour qui navigue.
 */

type Agence = {
  ville: string;
  gerant: string;
  adresse: string;
  /** Le premier mène la fiche ; les suivants s'affichent dessous. */
  telephones: { affiche: string; numero: string }[];
  codePlus: string;
  carteSrc: string;
  itineraire: string;
};

const AGENCES: Agence[] = [
  {
    ville: 'Mbour',
    gerant: 'Olivier',
    adresse: 'Route de Saly, près du restaurant Chez Ma Siga',
    telephones: [{ affiche: '+221 70 367 75 75', numero: '+221703677575' }],
    codePlus: 'C2W7+5C',
    carteSrc: "https://maps.google.com/maps?q=C2W7%2B5C+M%27bour%2C+S%C3%A9n%C3%A9gal&output=embed&hl=fr&z=16",
    itineraire: "https://www.google.com/maps/dir/?api=1&destination=C2W7%2B5C+M%27bour%2C+S%C3%A9n%C3%A9gal",
  },
  {
    ville: 'Thiès',
    gerant: 'Lazare',
    adresse: 'Quartier Mbour 1, en face du terrain Wallydaan',
    telephones: [
      { affiche: '+221 77 232 02 35', numero: '+221772320235' },
      { affiche: '+221 70 001 91 93', numero: '+221700019193' },
      { affiche: '+221 76 372 83 40', numero: '+221763728340' },
    ],
    codePlus: 'Q3F7+7J',
    carteSrc: 'https://maps.google.com/maps?q=Q3F7%2B7J%2C+Thi%C3%A8s%2C+S%C3%A9n%C3%A9gal&output=embed&hl=fr&z=16',
    itineraire: 'https://www.google.com/maps/dir/?api=1&destination=Q3F7%2B7J%2C+Thi%C3%A8s%2C+S%C3%A9n%C3%A9gal',
  },
];

function IconeEpingle({ taille = 16 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconeCourriel() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}

type ContactInfoSectionProps = {
  /** 1 sur /contact (titre principal de la page), 2 sur l'accueil où le h1 est le hero. */
  headingLevel?: 1 | 2;
};

export function ContactInfoSection({ headingLevel = 1 }: ContactInfoSectionProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <section className="lme-agences" id="agences">
      <div className="lme-agences__bande">

        <p className="lme-agences__surtitre">Où nous trouver</p>
        <Heading className="lme-agences__titre">Deux agences, un même service</Heading>

        <div className="lme-agences__grille">
          {AGENCES.map((agence) => {
            const [principal, ...autres] = agence.telephones;

            return (
              <article className="lme-agence" key={agence.ville}>

                {/* La carte réelle, chargée seulement quand elle approche du
                    cadre visible : une carte Google pèse, et le quota de
                    bande passante ne pardonne pas un chargement pour rien. */}
                <div className="lme-agence__plan">
                  <iframe
                    src={agence.carteSrc}
                    title={`Plan de l’agence de ${agence.ville}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                  <span className="lme-agence__code">
                    <IconeEpingle taille={13} />
                    {agence.codePlus}
                  </span>
                </div>

                <div className="lme-agence__corps">
                  <h3 className="lme-agence__ville">{agence.ville}</h3>
                  <p className="lme-agence__adresse">{agence.adresse}</p>

                  <dl className="lme-agence__faits">
                    <div className="lme-agence__fait">
                      <dt>Gérant</dt>
                      <dd>{agence.gerant}</dd>
                    </div>
                    <div className="lme-agence__fait">
                      <dt>Téléphone</dt>
                      <dd>
                        <a href={`tel:${principal.numero}`}>{principal.affiche}</a>
                      </dd>
                    </div>
                    {autres.length > 0 ? (
                      <div className="lme-agence__fait">
                        <dt>Autres lignes</dt>
                        <dd>
                          <span className="lme-agence__lignes">
                            {autres.map((t) => (
                              <a key={t.numero} href={`tel:${t.numero}`}>{t.affiche}</a>
                            ))}
                          </span>
                        </dd>
                      </div>
                    ) : null}
                    <div className="lme-agence__fait">
                      <dt>Horaires</dt>
                      <dd>Lun – ven, 09:00 – 19:00</dd>
                    </div>
                  </dl>

                  <div className="lme-agence__actions">
                    <a
                      className="lme-agence__action lme-agence__action--plan"
                      href={agence.itineraire}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconeEpingle />
                      Itinéraire
                    </a>
                    <a
                      className="lme-agence__action lme-agence__action--tel"
                      href={`tel:${principal.numero}`}
                    >
                      Appeler
                    </a>
                  </div>
                </div>

              </article>
            );
          })}
        </div>

        <p className="lme-agences__courriel">
          <a href="mailto:lamotherexpress@gmail.com">
            <IconeCourriel />
            lamotherexpress@gmail.com
          </a>
        </p>

      </div>
    </section>
  );
}
