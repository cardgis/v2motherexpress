import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerGerant } from "@/lib/auth";
import { chargerRetrait } from "@/lib/retrait";
import EcranRetrait from "@/components/gerant/EcranRetrait";

export const metadata: Metadata = {
  title: "Retrait en boutique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RetraitPage({ params }: { params: Promise<{ id: string }> }) {
  const gerant = await exigerGerant();
  const { id } = await params;

  const retrait = await chargerRetrait(gerant, id);

  // Hors périmètre de boutique : traité comme inexistant.
  if (!retrait) notFound();

  return (
    <EcranRetrait
      base="/gerant"
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
