import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Store } from "lucide-react";
import { exigerAdmin } from "@/lib/auth";
import { listerBoutiques } from "@/lib/admin/boutiques";
import { quantite } from "@/lib/formatters";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Badge } from "@/components/ui/Badge";
import { LienBouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";

export const metadata: Metadata = {
  title: "Boutiques — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BoutiquesPage() {
  await exigerAdmin();
  const boutiques = await listerBoutiques();

  return (
    <div className="lme-page lme-page--moyenne">
      <EnTetePage
        surtitre="Administration"
        titre="Boutiques"
        description="Ouvrez une boutique pour gérer ses informations et son équipe."
        actions={
          <LienBouton href="/admin/boutiques/nouvelle" icone={<Plus size={18} aria-hidden />}>
            Nouvelle boutique
          </LienBouton>
        }
      />

      {boutiques.length === 0 ? (
        <EtatVide icone={<Store size={28} aria-hidden />} titre="Aucune boutique">
          Créez la première boutique pour recevoir des réservations.
        </EtatVide>
      ) : (
        <ul className="lme-liste">
          {boutiques.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/boutiques/${b.id}`} className="lme-ligne">
                <div className="lme-ligne__principal">
                  <p className="lme-ligne__titre">
                    {b.nom}
                    <Badge>{b.code}</Badge>
                    {b.actif ? null : <Badge>Fermée</Badge>}
                    {b.gerants === 0 ? <Badge ton="attention">Aucun gérant</Badge> : null}
                  </p>
                  <p className="lme-ligne__meta">{[b.ville, b.adresse].filter(Boolean).join(" · ")}</p>
                  <p className="lme-ligne__meta">
                    {quantite(b.gerants, "gérant")} · {quantite(b.commerciaux, "commercial", "commerciaux")} ·{" "}
                    {quantite(b.motos, "moto")} · {quantite(b.enCours, "contrat en cours", "contrats en cours")}
                  </p>
                </div>
                <div className="lme-ligne__fin lme-texte-2">
                  <span className="lme-petit lme-gras">Gérer</span>
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
