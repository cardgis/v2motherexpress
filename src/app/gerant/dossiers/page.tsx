import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FolderOpen } from "lucide-react";
import { exigerEquipe } from "@/lib/auth";
import { listerDossiers, type FiltreDossier } from "@/lib/gerant/dossiers";
import { formaterTelephone } from "@/lib/phone";
import { horodatageFr } from "@/lib/formatters";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { StatutBadge } from "@/components/ui/Badge";
import { EtatVide } from "@/components/ui/EtatVide";

export const metadata: Metadata = {
  title: "Dossiers clients",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ListeDossiersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const gerant = await exigerEquipe();
  const { filtre } = await searchParams;

  const actif: FiltreDossier = filtre === "tous" ? "TOUS" : "A_TRAITER";
  const dossiers = await listerDossiers(gerant, actif);

  return (
    <div className="lme-page">
      <EnTetePage
        fil={[{ libelle: "Tableau de bord", href: "/gerant" }]}
        surtitre="Back-office"
        titre="Dossiers clients"
        description={
          gerant.lectureSeule
            ? "Consultez les pièces, les réservations et les contrats de votre boutique."
            : "Vérifiez les pièces, validez ou renvoyez les dossiers, puis préparez les contrats."
        }
      />

      <nav aria-label="Filtrer les dossiers" style={{ marginBottom: 16 }}>
        <div className="lme-onglets lme-onglets--compacts">
          <Link href="/gerant/dossiers" className="lme-onglet" aria-current={actif === "A_TRAITER" ? "page" : undefined}>
            À vérifier
          </Link>
          <Link href="/gerant/dossiers?filtre=tous" className="lme-onglet" aria-current={actif === "TOUS" ? "page" : undefined}>
            Tous les dossiers
          </Link>
        </div>
      </nav>

      {dossiers.length === 0 ? (
        <EtatVide
          icone={<FolderOpen size={28} aria-hidden />}
          titre={actif === "A_TRAITER" ? "Aucun dossier à vérifier" : "Aucun dossier client"}
        >
          {actif === "A_TRAITER"
            ? "Les dossiers complets envoyés par vos clients apparaîtront ici."
            : "Les clients qui réservent dans votre boutique apparaîtront ici."}
        </EtatVide>
      ) : (
        <ul className="lme-liste">
          {dossiers.map((d) => (
            <li key={d.id}>
              <Link href={`/gerant/dossiers/${d.id}`} className="lme-ligne">
                <div className="lme-ligne__principal">
                  <p className="lme-ligne__titre">
                    {d.nomComplet}
                    <StatutBadge type="kyc" statut={d.statutKyc} lecteur="gerant" />
                  </p>
                  <p className="lme-ligne__meta">
                    {d.telephone ? formaterTelephone(d.telephone) : d.email}
                    {d.ville ? ` · ${d.ville}` : null}
                    {` · ${d.nbDocuments} pièce${d.nbDocuments > 1 ? "s" : ""}`}
                    {` · mis à jour le ${horodatageFr(d.deposeLe)}`}
                  </p>
                  {d.reservations.length > 0 ? (
                    <p className="lme-ligne__meta">
                      {d.reservations
                        .map(
                          (r) =>
                            `${r.reference} — ${r.produit} (${LIBELLES_FORMULE[r.formule]})` +
                            // L'administrateur voit toutes les boutiques : il faut dire laquelle.
                            (gerant.estAdmin ? ` · ${r.boutique}` : ""),
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="lme-ligne__fin lme-texte-2">
                  <span className="lme-petit lme-gras">Examiner</span>
                  <ChevronRight size={18} aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
