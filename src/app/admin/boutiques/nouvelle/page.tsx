import type { Metadata } from "next";
import { exigerAdmin } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import FormulaireBoutique from "@/components/admin/FormulaireBoutique";

export const metadata: Metadata = {
  title: "Nouvelle boutique — Administration",
  robots: { index: false, follow: false },
};

export default async function NouvelleBoutiquePage() {
  await exigerAdmin();

  return (
    <div className="lme-page lme-page--moyenne">
      <EnTetePage
        fil={[{ libelle: "Boutiques", href: "/admin/boutiques" }]}
        surtitre="Administration"
        titre="Nouvelle boutique"
        description="Elle apparaît aussitôt dans le choix des clients. Ajoutez ensuite son gérant."
      />
      <Carte>
        <FormulaireBoutique />
      </Carte>
    </div>
  );
}
