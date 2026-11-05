/**
 * Écran de chargement d'une page d'espace.
 *
 * Affiché dans le cadre, qui reste en place : l'en-tête et la navigation ne
 * disparaissent jamais pendant qu'une page se charge. Les blocs ont la forme
 * approximative du contenu à venir, pour que son arrivée ne décale rien.
 */
export default function Squelette() {
  return (
    <div className="lme-page" aria-busy="true">
      <p className="lme-sr" role="status">
        Chargement…
      </p>
      <div className="lme-squelette" style={{ width: 120, height: 14, marginBottom: 12 }} />
      <div className="lme-squelette" style={{ width: "min(380px, 75%)", height: 32, marginBottom: 28 }} />
      <div className="lme-pile">
        <div className="lme-squelette" style={{ height: 112 }} />
        <div className="lme-squelette" style={{ height: 240 }} />
      </div>
    </div>
  );
}
