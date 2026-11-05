import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerAdmin } from "@/lib/auth";
import { chargerRestitution } from "@/lib/restitution";
import EcranRestitution from "@/components/gerant/EcranRestitution";

export const metadata: Metadata = {
  title: "Restitution — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Clôture d'un contrat vue par l'administrateur : mêmes gestes que le gérant,
 * sans quitter l'espace d'administration.
 */
export default async function RestitutionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await exigerAdmin();
  const { id } = await params;

  // Périmètre ouvert : `chargerRestitution` ne filtre pas par boutique pour un admin.
  const detail = await chargerRestitution(admin, id);
  if (!detail) notFound();

  return (
    <EcranRestitution
      base="/admin"
      restitution={{
        ...detail,
        restitution: detail.restitution
          ? {
              statut: detail.restitution.statut,
              photos: detail.restitution.photos,
            }
          : null,
      }}
    />
  );
}
