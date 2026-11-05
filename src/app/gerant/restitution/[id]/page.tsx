import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerGerant } from "@/lib/auth";
import { chargerRestitution } from "@/lib/restitution";
import EcranRestitution from "@/components/gerant/EcranRestitution";

export const metadata: Metadata = {
  title: "Restitution du véhicule",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RestitutionPage({ params }: { params: Promise<{ id: string }> }) {
  const gerant = await exigerGerant();
  const { id } = await params;

  const detail = await chargerRestitution(gerant, id);

  // Hors périmètre de boutique : traité comme inexistant.
  if (!detail) notFound();

  return (
    <EcranRestitution
      base="/gerant"
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
