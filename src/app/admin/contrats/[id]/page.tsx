import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerAdmin } from "@/lib/auth";
import { chargerDossier } from "@/lib/gerant/dossiers";
import DossierExamen from "@/components/gerant/DossierExamen";

export const metadata: Metadata = {
  title: "Dossier — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Fiche d'un dossier vue par l'administrateur : mêmes gestes que le gérant —
 * valider, établir et transmettre un contrat, contresigner — mais sans quitter
 * l'espace d'administration.
 */
export default async function DossierAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await exigerAdmin();
  const { id } = await params;

  // Périmètre ouvert : `chargerDossier` ne filtre pas par boutique pour un admin.
  const dossier = await chargerDossier(admin, id);
  if (!dossier) notFound();

  return (
    <DossierExamen
      base="/admin"
      dossier={{
        ...dossier,
        dateNaissance: dossier.dateNaissance?.toISOString() ?? null,
        pieceDateExpiration: dossier.pieceDateExpiration?.toISOString() ?? null,
        consentementAt: dossier.consentementAt?.toISOString() ?? null,
        documents: dossier.documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })),
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
