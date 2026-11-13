import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { EtatVide } from "@/components/ui/EtatVide";
import { LienBouton } from "@/components/ui/Bouton";
import { LigneDocument } from "@/components/compte/LigneDocument";
import {
  chargerDocuments,
  compterParType,
  estTypeDocument,
  LIBELLES_TYPE,
  ORDRE_TYPES,
  type TypeDocument,
} from "@/lib/compte/documents";

export const metadata: Metadata = {
  title: "Mes documents",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Tous les documents du client, filtrables par type.
 *
 * POURQUOI UNE PAGE À PART. La carte de l'accueil les empilait tous : au bout
 * de deux ans de location-accession, un reçu par mois fait une trentaine de
 * lignes, et l'accueil devenait un long défilement où le contrat — la seule
 * pièce qui demande parfois une action — se perdait au milieu des reçus.
 * L'accueil n'en garde donc que les plus récents et renvoie ici.
 *
 * LE FILTRE PASSE PAR L'ADRESSE, pas par un état React : la page reste un
 * composant serveur, le filtre survit à un rafraîchissement, se partage et
 * fonctionne sans JavaScript. Un onglet est un lien, et c'est ce que c'est.
 */
export default async function DocumentsClientPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await exigerUtilisateur();
  const { type } = await searchParams;

  const documents = await chargerDocuments(user.id);
  const comptes = compterParType(documents);

  // Un type inconnu dans l'adresse n'est pas une erreur : on retombe sur tout.
  const actif: TypeDocument | null = estTypeDocument(type) ? type : null;
  const affiches = actif ? documents.filter((d) => d.type === actif) : documents;

  // Seuls les types dont le client possède au moins un document ont un onglet :
  // un filtre qui ne peut rien donner n'est pas une aide.
  const typesPresents = ORDRE_TYPES.filter((t) => comptes[t] > 0);

  return (
    <div className="lme-page">
      <EnTetePage
        fil={[{ libelle: "Mon espace", href: "/compte" }]}
        surtitre="Mon espace"
        titre="Mes documents"
        description="Vos contrats, vos reçus de versement et les constats d’état du véhicule, du plus récent au plus ancien."
      />

      {documents.length === 0 ? (
        <EtatVide
          icone={<FileText size={28} aria-hidden />}
          titre="Aucun document"
          action={<LienBouton href="/compte">Retour à mon espace</LienBouton>}
        >
          Votre contrat et votre constat de remise apparaîtront ici dès qu’ils seront établis.
        </EtatVide>
      ) : (
        <div className="lme-pile lme-pile--large">
          {typesPresents.length > 1 ? (
            <nav aria-label="Filtrer mes documents">
              <div className="lme-onglets lme-onglets--compacts lme-onglets--defilant">
                <Link
                  href="/compte/documents"
                  className="lme-onglet"
                  aria-current={actif === null ? "page" : undefined}
                >
                  Tous ({documents.length})
                </Link>
                {typesPresents.map((t) => (
                  <Link
                    key={t}
                    href={`/compte/documents?type=${t}`}
                    className="lme-onglet"
                    aria-current={actif === t ? "page" : undefined}
                  >
                    {LIBELLES_TYPE[t].pluriel} ({comptes[t]})
                  </Link>
                ))}
              </div>
            </nav>
          ) : null}

          <Carte titre={actif ? LIBELLES_TYPE[actif].pluriel : "Tous mes documents"}>
            <ul className="lme-liste">
              {affiches.map((d) => (
                <LigneDocument key={d.cle} document={d} />
              ))}
            </ul>
          </Carte>
        </div>
      )}
    </div>
  );
}
