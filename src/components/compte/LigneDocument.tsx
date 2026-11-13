import { FileText } from "lucide-react";
import { StatutBadge } from "@/components/ui/Badge";
import { LienBouton } from "@/components/ui/Bouton";
import { presentationStatut } from "@/lib/statuts";
import type { DocumentClient } from "@/lib/compte/documents";

/**
 * Une ligne de document dans l'espace client.
 *
 * Partagée par la carte « Mes documents » de l'accueil et par la page
 * `/compte/documents` : un document se présente de la même façon partout, et
 * l'utilisateur n'a pas à relire une mise en forme qui change d'une page à
 * l'autre. Le bouton « Signer » n'apparaît que là où le document l'attend.
 */
export function LigneDocument({ document: doc }: { document: DocumentClient }) {
  return (
    <li className="lme-ligne">
      <div className="lme-ligne__principal">
        <p className="lme-ligne__titre">
          <FileText size={16} aria-hidden />
          {doc.titre}
        </p>
        <p className="lme-ligne__meta">{doc.meta}</p>
        {doc.statutContrat ? (
          <p style={{ marginTop: 8 }}>
            <StatutBadge type="contrat" statut={doc.statutContrat} lecteur="client" />
          </p>
        ) : null}
      </div>
      <div className="lme-ligne__fin">
        <LienBouton
          href={doc.href}
          nouvelOnglet
          variante="secondaire"
          taille="sm"
          aria-label={
            doc.statutContrat
              ? `Lire le ${doc.titre.toLowerCase()}, ${presentationStatut("contrat", doc.statutContrat, "client").libelle}`
              : `Lire le document : ${doc.titre}`
          }
        >
          Lire
        </LienBouton>
        {doc.signerHref ? (
          <LienBouton href={doc.signerHref} taille="sm">
            Signer
          </LienBouton>
        ) : null}
      </div>
    </li>
  );
}
