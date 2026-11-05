import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FolderOpen } from "lucide-react";
import { exigerAdmin } from "@/lib/auth";
import { listerDossiers, type FiltreDossier } from "@/lib/gerant/dossiers";
import { formaterTelephone } from "@/lib/phone";
import { horodatageFr } from "@/lib/formatters";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { cheminDossier } from "@/components/gerant/espace-backoffice";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { StatutBadge } from "@/components/ui/Badge";
import { EtatVide } from "@/components/ui/EtatVide";

export const metadata: Metadata = {
  title: "Contrats — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Dossiers et contrats de TOUTES les boutiques, dans l'espace administration.
 *
 * Mêmes données et mêmes gestes que la liste du back-office — c'est la même
 * fonction métier, avec le périmètre ouvert de l'administrateur. Seul l'espace
 * change, pour que l'administrateur garde ses onglets et son adresse.
 */
export default async function ContratsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const admin = await exigerAdmin();
  const { filtre } = await searchParams;

  // L'administration s'ouvre sur TOUS les dossiers : elle sert à retrouver un
  // contrat, là où la boutique traite d'abord sa pile du jour.
  const actif: FiltreDossier = filtre === "a-verifier" ? "A_TRAITER" : "TOUS";
  const dossiers = await listerDossiers(admin, actif);

  return (
    <div className="lme-page">
      <EnTetePage
        fil={[{ libelle: "Chiffres", href: "/admin" }]}
        surtitre="Administration"
        titre="Contrats"
        description="Les dossiers et les contrats de toutes les boutiques, avec les mêmes gestes qu'un gérant."
      />

      <nav aria-label="Filtrer les dossiers" style={{ marginBottom: 16 }}>
        <div className="lme-onglets lme-onglets--compacts">
          <Link href="/admin/contrats" className="lme-onglet" aria-current={actif === "TOUS" ? "page" : undefined}>
            Tous les dossiers
          </Link>
          <Link
            href="/admin/contrats?filtre=a-verifier"
            className="lme-onglet"
            aria-current={actif === "A_TRAITER" ? "page" : undefined}
          >
            À vérifier
          </Link>
        </div>
      </nav>

      {dossiers.length === 0 ? (
        <EtatVide
          icone={<FolderOpen size={28} aria-hidden />}
          titre={actif === "A_TRAITER" ? "Aucun dossier à vérifier" : "Aucun dossier client"}
        >
          Les dossiers déposés dans vos boutiques apparaîtront ici.
        </EtatVide>
      ) : (
        <ul className="lme-liste">
          {dossiers.map((d) => (
            <li key={d.id}>
              <Link href={cheminDossier("/admin", d.id)} className="lme-ligne">
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
                        .map((r) => `${r.reference} — ${r.produit} (${LIBELLES_FORMULE[r.formule]}) · ${r.boutique}`)
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
