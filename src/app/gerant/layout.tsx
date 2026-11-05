import type { ReactNode } from "react";
import { exigerEquipe } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIBELLES_ROLE } from "@/lib/roles";
import CadreEspace, { initiales } from "@/components/espace/CadreEspace";

/**
 * Cadre du back-office : en-tête, navigation, pastille « dossiers à vérifier ».
 *
 * Ouvert au gérant, au commercial (consultation) et à l'administrateur. Le
 * contrôle d'accès et le cloisonnement par boutique restent faits dans chaque
 * page et chaque route d'API : ce layout ne sert qu'à l'affichage.
 */
export default async function LayoutGerant({ children }: { children: ReactNode }) {
  const membre = await exigerEquipe();

  const [boutique, aVerifier] = await Promise.all([
    membre.boutiqueId
      ? prisma.boutique.findUnique({
          where: { id: membre.boutiqueId },
          select: { store: { select: { name: true } } },
        })
      : null,
    prisma.customer.count({
      where: {
        statutKyc: "A_VERIFIER",
        ...(membre.estAdmin ? {} : { reservations: { some: { boutiqueId: membre.boutiqueId! } } }),
      },
    }),
  ]);

  const nom = membre.nomAffichage ?? LIBELLES_ROLE[membre.role];
  const [premier, second] = nom.split(/\s+/);

  return (
    <CadreEspace
      espace="gerant"
      titreEspace="Back-office"
      identite={{
        nom,
        detail: `${LIBELLES_ROLE[membre.role]} · ${boutique?.store.name ?? "Toutes les boutiques"}`,
        initiales: initiales(premier, second),
      }}
      pastilles={{ "/gerant/dossiers": aVerifier }}
      raccourcis={membre.estAdmin ? [{ href: "/admin", libelle: "Espace administrateur" }] : undefined}
    >
      {children}
    </CadreEspace>
  );
}
