import type { CSSProperties } from "react";
import { Check } from "lucide-react";

/**
 * Indicateur d'avancement d'un parcours en plusieurs étapes.
 *
 * Les étapes déjà franchies deviennent cliquables si `onAller` est fourni ;
 * les suivantes ne le sont jamais — on n'avance pas sans passer par les
 * contrôles de l'étape courante.
 *
 * Sur téléphone, quatre libellés ne tiennent pas côte à côte : seules les
 * barres restent, et un résumé « Étape 3 sur 4 — Coordonnées » les nomme.
 */
export function Etapes({
  libelles,
  courante,
  onAller,
  nom = "Étapes",
}: {
  libelles: string[];
  /** Numéro de l'étape en cours, à partir de 1. */
  courante: number;
  onAller?: (etape: number) => void;
  nom?: string;
}) {
  return (
    <div className="lme-etapes-cadre">
      <ol
        className="lme-etapes"
        aria-label={nom}
        style={{ "--lme-nb-etapes": libelles.length } as CSSProperties}
      >
        {libelles.map((libelle, i) => {
          const numero = i + 1;
          const etat = numero < courante ? "fait" : numero === courante ? "courant" : "a-venir";

          const contenu = (
            <>
              <span className="lme-etape__barre" aria-hidden />
              <span className="lme-etape__libelle">
                {etat === "fait" ? <Check size={14} aria-hidden /> : <span aria-hidden>{numero}.</span>}
                {libelle}
              </span>
              <span className="lme-sr">
                {`Étape ${numero}, ${libelle}${etat === "fait" ? " — terminée" : etat === "courant" ? " — en cours" : " — à venir"}`}
              </span>
            </>
          );

          return (
            <li key={libelle} aria-current={etat === "courant" ? "step" : undefined}>
              {onAller && etat === "fait" ? (
                <button type="button" className="lme-etape" data-etat={etat} onClick={() => onAller(numero)}>
                  {contenu}
                </button>
              ) : (
                <div className="lme-etape" data-etat={etat}>
                  {contenu}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="lme-etapes__resume" aria-hidden>
        Étape {courante} sur {libelles.length} — <strong>{libelles[courante - 1]}</strong>
      </p>
    </div>
  );
}
