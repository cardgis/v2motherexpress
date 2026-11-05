/** Barre d'avancement : dorée en cours, verte une fois complète. */
export function Progression({ valeur, libelle }: { valeur: number; libelle: string }) {
  const borne = Math.max(0, Math.min(100, Math.round(valeur)));

  return (
    <div className="lme-progression" data-complet={borne >= 100 ? "" : undefined}>
      <div className="lme-rangee lme-rangee--entre lme-petit">
        <span className="lme-gras">{libelle}</span>
        <span className="lme-texte-2">{borne} %</span>
      </div>
      <div
        className="lme-progression__piste"
        role="progressbar"
        aria-label={libelle}
        aria-valuenow={borne}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="lme-progression__barre" style={{ width: `${borne}%` }} />
      </div>
    </div>
  );
}
