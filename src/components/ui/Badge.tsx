import type { ReactNode } from "react";
import { presentationStatut, type Lecteur, type Ton, type TypeStatut } from "@/lib/statuts";

/** Pastille de statut : un point coloré ET un libellé, jamais la couleur seule. */
export function Badge({ ton = "neutre", children }: { ton?: Ton; children: ReactNode }) {
  return <span className={`lme-badge lme-badge--${ton}`}>{children}</span>;
}

/** Badge d'un statut métier, avec le libellé adapté à celui qui le lit. */
export function StatutBadge({
  type,
  statut,
  lecteur,
}: {
  type: TypeStatut;
  statut: string;
  lecteur: Lecteur;
}) {
  const { libelle, ton } = presentationStatut(type, statut, lecteur);
  return <Badge ton={ton}>{libelle}</Badge>;
}
