import type { ReactNode } from "react";
import { exigerAdmin } from "@/lib/auth";
import { afficherIdentifiant } from "@/lib/phone";
import CadreEspace, { initiales } from "@/components/espace/CadreEspace";
import "@/styles/admin.css";

/**
 * Cadre de l'administration — compte administrateur unique.
 *
 * Comme pour les autres espaces, ce layout ne sert qu'à l'affichage : chaque
 * page et chaque route d'API refait son propre contrôle d'accès.
 */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigerAdmin();
  const nom = admin.nomAffichage ?? "Administrateur";
  const [premier, second] = nom.split(/\s+/);

  return (
    <CadreEspace
      espace="admin"
      titreEspace="Administration"
      identite={{
        nom,
        detail: `Administrateur · ${afficherIdentifiant(admin)}`,
        initiales: initiales(premier, second),
      }}
      raccourcis={[{ href: "/gerant", libelle: "Back-office des boutiques" }]}
    >
      {children}
    </CadreEspace>
  );
}
