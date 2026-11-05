import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import { suiteSure } from "@/lib/suite";
import { accueilDuRole } from "@/lib/roles";
import ConnexionForm from "@/components/compte/ConnexionForm";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre espace client La Mother Express avec votre numéro de téléphone.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ suite?: string | string[] }> };

export default async function ConnexionPage({ searchParams }: Props) {
  // Page visée avant la connexion, par exemple « Réserver » depuis la vitrine.
  const suite = suiteSure((await searchParams).suite);

  // Déjà connecté : inutile de repasser par l'OTP.
  const user = await utilisateurCourant();
  if (user) redirect(user.role === "CLIENT" ? (suite ?? "/compte") : accueilDuRole(user.role));

  return <ConnexionForm suite={suite} />;
}
