import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerEquipe } from "@/lib/auth";
import { chargerDossier } from "@/lib/gerant/dossiers";
import DossierExamen from "@/components/gerant/DossierExamen";

export const metadata: Metadata = {
  title: "Vérification du dossier",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const gerant = await exigerEquipe();
  const { id } = await params;

  const dossier = await chargerDossier(gerant, id);

  // Hors périmètre de boutique : traité comme inexistant, sans le dire.
  if (!dossier) notFound();

  return (
    <DossierExamen
      base="/gerant"
      lectureSeule={gerant.lectureSeule}
      dossier={{
        ...dossier,
        dateNaissance: dossier.dateNaissance?.toISOString() ?? null,
        pieceDateExpiration: dossier.pieceDateExpiration?.toISOString() ?? null,
        consentementAt: dossier.consentementAt?.toISOString() ?? null,
        documents: dossier.documents.map((d) => ({
          ...d,
          uploadedAt: d.uploadedAt.toISOString(),
        })),
        reservations: dossier.reservations.map((r) => ({
          ...r,
          dateDebut: r.dateDebut?.toISOString() ?? null,
          dateFin: r.dateFin?.toISOString() ?? null,
          dateSignatureContrat: r.dateSignatureContrat?.toISOString() ?? null,
          echeances: r.echeances.map((e) => ({ ...e, echeanceLe: e.echeanceLe.toISOString() })),
          encaissements: r.encaissements.map((v) => ({
            ...v,
            recuLe: v.recuLe.toISOString(),
            annuleLe: v.annuleLe?.toISOString() ?? null,
          })),
        })),
      }}
    />
  );
}
