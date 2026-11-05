import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerAdmin } from "@/lib/auth";
import { chargerRetrait } from "@/lib/retrait";
import EcranRetrait from "@/components/gerant/EcranRetrait";

export const metadata: Metadata = {
  title: "Retrait — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Remise d'un véhicule, depuis l'administration.
 *
 * L'administrateur a les pouvoirs du gérant sur toutes les boutiques : il doit
 * pouvoir conduire un retrait, sans sortir de son espace.
 */
export default async function RetraitAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await exigerAdmin();
  const { id } = await params;

  const retrait = await chargerRetrait(admin, id);
  if (!retrait) notFound();

  return (
    <EcranRetrait
      base="/admin"
      retrait={{
        ...retrait,
        handover: retrait.handover
          ? {
              statut: retrait.handover.statut,
              pieceVerifiee: retrait.handover.pieceVerifiee,
              pieceConforme: retrait.handover.pieceConforme,
              pieceMotifRefus: retrait.handover.pieceMotifRefus,
              photos: retrait.handover.photos,
            }
          : null,
      }}
    />
  );
}
