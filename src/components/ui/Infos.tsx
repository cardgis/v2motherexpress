import type { ReactNode } from "react";

/** Grille de paires libellé / valeur (fiche client, pièce, véhicule). */
export function Infos({ children }: { children: ReactNode }) {
  return <dl className="lme-infos">{children}</dl>;
}

export function Info({
  libelle,
  valeur,
  fort = false,
}: {
  libelle: ReactNode;
  valeur: ReactNode;
  /** Valeur mise en évidence : celle que l'on confronte à un document. */
  fort?: boolean;
}) {
  return (
    <div className={fort ? "lme-info lme-info--fort" : "lme-info"}>
      <dt>{libelle}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}

/** Récapitulatif en lignes : libellé à gauche, valeur à droite. */
export function Recapitulatif({ children }: { children: ReactNode }) {
  return <dl className="lme-lignes-recap">{children}</dl>;
}

export function LigneRecap({ libelle, valeur }: { libelle: ReactNode; valeur: ReactNode }) {
  return (
    <div className="lme-ligne-recap">
      <dt>{libelle}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}
