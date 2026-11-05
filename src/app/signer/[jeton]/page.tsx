import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { contratParJeton, ErreurSignature, MENTION_ENGAGEMENT } from "@/lib/contrats/signature";
import type { SnapshotContrat } from "@/lib/contrats/snapshot";
import PageSignature from "@/components/signature/PageSignature";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Alerte } from "@/components/ui/Alerte";
import { LienBouton, classesBouton } from "@/components/ui/Bouton";

export const metadata: Metadata = {
  title: "Signer mon contrat",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignerPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;

  let contrat;
  try {
    contrat = await contratParJeton(jeton);
  } catch (error) {
    // Lien invalide, expiré ou déjà consommé : on l'explique sans rien
    // révéler du dossier concerné.
    return (
      <div className="lme-page lme-page--etroite">
        <EnTetePage surtitre="Signature" titre="Lien indisponible" />
        <div className="lme-pile">
          <Alerte ton="erreur" titre={error instanceof ErreurSignature ? error.message : "Ce lien de signature n’est pas valide."}>
            Contactez votre boutique La Mother Express pour en recevoir un nouveau, ou signez depuis votre espace
            client.
          </Alerte>
          <div className="lme-rangee">
            <a href="tel:+221772320235" className={classesBouton({ variante: "secondaire" })}>
              <Phone size={18} aria-hidden />
              Appeler la boutique
            </a>
            <LienBouton href="/compte/connexion" variante="fantome">
              Me connecter à mon espace
            </LienBouton>
          </div>
        </div>
      </div>
    );
  }

  const snapshot = contrat.donnees as unknown as SnapshotContrat;

  return (
    <PageSignature
      jeton={jeton}
      reference={contrat.reference}
      resume={{
        clientNomComplet: snapshot.clientNomComplet,
        vehicule: snapshot.vehiculeMarqueModele,
        numeroSerie: snapshot.vehiculeNumeroSerie,
        redevanceJournaliere: snapshot.redevanceJournaliere,
        dureeMois: snapshot.dureeMois,
        prixTotal: snapshot.prixTotal,
        formule: snapshot.formule,
        avecEngagement: snapshot.avecEngagement,
        differentielJournalier: snapshot.differentielJournalier,
        bailleurRepresentant: snapshot.bailleurRepresentant,
      }}
      mentionExigee={snapshot.avecEngagement ? MENTION_ENGAGEMENT : null}
    />
  );
}
