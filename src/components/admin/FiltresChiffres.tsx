"use client";

/**
 * Filtres des chiffres : période et boutique.
 *
 * Les filtres vivent dans l'adresse (`?periode=…&boutique=…`) : une vue se
 * garde en favori ou se retrouve telle quelle d'une réunion à l'autre, et la
 * page reste calculée côté serveur. Changer un filtre navigue sans recharger
 * le cadre.
 */

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Champ } from "@/components/ui/Champ";
import { PERIODES, parametresFiltres, type CodePeriode, type TypeSuivi } from "@/lib/admin/filtres";

export default function FiltresChiffres({
  periode,
  boutiqueId,
  boutiques,
  type,
}: {
  periode: CodePeriode;
  boutiqueId: string | null;
  boutiques: { id: string; nom: string }[];
  /** Conservé d'un filtre à l'autre sur la feuille de suivi. */
  type?: TypeSuivi;
}) {
  const router = useRouter();
  const chemin = usePathname();
  const [enCours, demarrer] = useTransition();

  const aller = (changement: { periode?: CodePeriode; boutiqueId?: string | null }) =>
    demarrer(() => router.push(`${chemin}${parametresFiltres({ periode, boutiqueId, type, ...changement })}`));

  return (
    <div className="lme-filtres" aria-busy={enCours || undefined}>
      <Champ libelle="Période">
        <select id="filtre-periode" value={periode} onChange={(e) => aller({ periode: e.target.value as CodePeriode })}>
          {PERIODES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.libelle}
            </option>
          ))}
        </select>
      </Champ>

      <Champ libelle="Boutique">
        <select
          id="filtre-boutique"
          value={boutiqueId ?? ""}
          onChange={(e) => aller({ boutiqueId: e.target.value || null })}
        >
          <option value="">Toutes les boutiques</option>
          {boutiques.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nom}
            </option>
          ))}
        </select>
      </Champ>
    </div>
  );
}
