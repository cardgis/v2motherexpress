import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChartColumn } from "lucide-react";
import { exigerAdmin } from "@/lib/auth";
import { chargerBoutique } from "@/lib/admin/boutiques";
import { parametresFiltres } from "@/lib/admin/filtres";
import { formaterTelephone } from "@/lib/phone";
import { horodatageFr, quantite } from "@/lib/formatters";
import type { RoleEquipe } from "@/lib/roles";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Badge } from "@/components/ui/Badge";
import { LienBouton } from "@/components/ui/Bouton";
import FormulaireBoutique from "@/components/admin/FormulaireBoutique";
import EquipeBoutique from "@/components/admin/EquipeBoutique";

export const metadata: Metadata = {
  title: "Boutique — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BoutiquePage({ params }: { params: Promise<{ id: string }> }) {
  await exigerAdmin();
  const { id } = await params;

  const b = await chargerBoutique(id);
  if (!b) notFound();

  return (
    <div className="lme-page lme-page--moyenne">
      <EnTetePage
        fil={[{ libelle: "Boutiques", href: "/admin/boutiques" }]}
        surtitre={`Boutique ${b.code}`}
        titre={b.nom}
        badge={b.actif ? <Badge ton="succes">Ouverte</Badge> : <Badge>Fermée</Badge>}
        description={`${quantite(b.reservations, "réservation")} · ${quantite(b.motos, "moto")} dans la flotte`}
        actions={
          <LienBouton
            href={`/admin${parametresFiltres({ boutiqueId: b.id })}`}
            variante="secondaire"
            icone={<ChartColumn size={18} aria-hidden />}
          >
            Voir ses chiffres
          </LienBouton>
        }
      />

      <div className="lme-pile lme-pile--large">
        <Carte
          titre="Équipe"
          description="Gérants et commerciaux se connectent par code, avec le mobile ou l’e-mail indiqué ici."
        >
          <EquipeBoutique
            boutiqueId={b.id}
            equipe={b.equipe.map((m) => ({
              id: m.id,
              role: m.role as RoleEquipe,
              nom: m.nomAffichage ?? "Sans nom",
              identifiant: m.telephone ? formaterTelephone(m.telephone) : (m.email ?? "—"),
              identifiantBrut: m.telephone ?? m.email ?? "",
              derniereConnexion: m.lastLoginAt ? horodatageFr(m.lastLoginAt) : null,
            }))}
          />
        </Carte>

        <Carte titre="Informations" description="Ce qui s’imprime sur les contrats de la boutique.">
          <FormulaireBoutique
            boutiqueId={b.id}
            initial={{
              nom: b.nom,
              ville: b.ville,
              code: b.code,
              adresse: b.adresse,
              telephone: formaterTelephone(b.telephone),
              representantNom: b.representantNom,
              actif: b.actif,
            }}
          />
        </Carte>
      </div>
    </div>
  );
}
