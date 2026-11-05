import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { afficherIdentifiant } from "@/lib/phone";
import { accueilDuRole } from "@/lib/roles";
import CadreEspace, { initiales } from "@/components/espace/CadreEspace";

/**
 * Cadre de l'espace client : en-tête, navigation, pastille « contrat à signer ».
 *
 * La page de connexion est hors de ce groupe de routes : elle doit rester
 * accessible sans session. Le contrôle d'accès reste AUSSI fait dans chaque
 * page — un layout n'est pas une barrière de sécurité, il n'est pas réévalué
 * à chaque navigation.
 */
export default async function LayoutEspaceClient({ children }: { children: ReactNode }) {
  const user = await exigerUtilisateur();

  // L'équipe et l'administrateur n'ont rien à faire dans l'espace client.
  if (user.role !== "CLIENT") redirect(accueilDuRole(user.role));

  const [customer, contratsASigner] = await Promise.all([
    prisma.customer.findUnique({ where: { userId: user.id }, select: { prenom: true, nom: true } }),
    prisma.contract.count({
      where: { statut: "A_SIGNER_CLIENT", reservation: { customer: { userId: user.id } } },
    }),
  ]);

  const nomComplet = [customer?.prenom, customer?.nom].filter(Boolean).join(" ");

  return (
    <CadreEspace
      espace="client"
      titreEspace="Espace client"
      identite={{
        nom: nomComplet || "Mon compte",
        detail: afficherIdentifiant(user),
        initiales: initiales(customer?.prenom, customer?.nom),
      }}
      pastilles={{ "/compte": contratsASigner }}
    >
      {children}
    </CadreEspace>
  );
}
