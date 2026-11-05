import type { Metadata } from "next";
import { exigerUtilisateur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { etatDossier } from "@/lib/dossier";
import DossierForm, { type DossierInitial } from "@/components/compte/DossierForm";

export const metadata: Metadata = {
  title: "Mon dossier",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DossierPage() {
  const user = await exigerUtilisateur();

  const customer = await prisma.customer.findUnique({
    where: { userId: user.id },
    include: {
      documents: {
        where: { purgeAt: null },
        select: { id: true, type: true, mimeType: true, uploadedAt: true },
      },
    },
  });

  // Un client connecté par e-mail n'a pas de téléphone vérifié : il doit en
  // déclarer un, que le contrat imprimera.
  const telephoneVerifie = !!user.telephone;

  const documents = customer?.documents ?? [];
  const etat = etatDossier(customer, documents, { telephoneVerifie });

  /** Les dates partent en ISO court : c'est le format attendu par `<input type="date">`. */
  const jour = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  const initial: DossierInitial = {
    prenom: customer?.prenom ?? "",
    nom: customer?.nom ?? "",
    dateNaissance: jour(customer?.dateNaissance),
    lieuNaissance: customer?.lieuNaissance ?? "",
    nationalite: customer?.nationalite ?? "Sénégalaise",
    typePiece: customer?.typePiece ?? "",
    numeroPiece: customer?.numeroPiece ?? "",
    pieceDateExpiration: jour(customer?.pieceDateExpiration),
    numeroPermis: customer?.numeroPermis ?? "",
    permisDateObtention: jour(customer?.permisDateObtention),
    adresse: customer?.adresse ?? "",
    quartier: customer?.quartier ?? "",
    ville: customer?.ville ?? "",
    profession: customer?.profession ?? "",
    telephoneContact: customer?.telephoneContact ?? "",
  };

  return (
    <DossierForm
      initial={initial}
      documents={documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() }))}
      etatInitial={etat}
      statutKyc={customer?.statutKyc ?? "INCOMPLET"}
      motifRejet={customer?.kycMotifRejet ?? null}
      consentementDonne={!!customer?.consentementAt}
      telephoneContactRequis={!telephoneVerifie}
    />
  );
}
