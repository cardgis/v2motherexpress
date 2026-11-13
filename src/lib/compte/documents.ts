import { prisma } from "@/lib/prisma";
import { dateFr } from "@/lib/formatters";
import type { StatutContrat } from "@/generated/prisma";

/**
 * Les documents qu'un client peut relire depuis son espace : son contrat, ses
 * reçus de versement et les deux constats d'état du véhicule.
 *
 * CE MODULE EST LA SEULE SOURCE DE CETTE LISTE. Deux pages l'affichent — la
 * carte « Mes documents » de l'accueil, qui en montre les plus récents, et
 * `/compte/documents`, qui montre tout — et la règle « un brouillon n'est
 * JAMAIS montré au client » ne doit exister qu'ici. Recopiée sur deux pages,
 * elle finirait par diverger, et la page qui l'aurait perdue laisserait voir au
 * client un acte que la boutique n'a pas encore relu.
 *
 * AUCUN MONTANT N'APPARAÎT DANS CES LIBELLÉS (2026-11-13). Décision
 * d'Alexandre : afficher « Reçu de 1 872 000 FCFA » dans une liste n'apporte
 * rien au client et met en avant une somme au mauvais endroit. Le montant
 * reste dans le PDF du reçu, qui est la pièce comptable, et dans le
 * back-office, où il sert au suivi des versements.
 */

export type TypeDocument = "contrat" | "recu" | "constat" | "restitution";

export interface DocumentClient {
  /** Clé de rendu, unique toutes catégories confondues. */
  cle: string;
  type: TypeDocument;
  titre: string;
  meta: string;
  /** Le PDF, à ouvrir dans un nouvel onglet. */
  href: string;
  /** Sert au tri par récence. Jamais affiché tel quel. */
  quand: Date;
  /** Contrat seulement : l'état gouverne le badge et le bouton « Signer ». */
  statutContrat?: StatutContrat;
  signerHref?: string;
}

export const LIBELLES_TYPE: Record<TypeDocument, { singulier: string; pluriel: string }> = {
  contrat: { singulier: "Contrat", pluriel: "Contrats" },
  recu: { singulier: "Reçu de versement", pluriel: "Reçus de versement" },
  constat: { singulier: "Constat de remise", pluriel: "Constats de remise" },
  restitution: { singulier: "Constat de restitution", pluriel: "Constats de restitution" },
};

/** L'ordre des sections de `/compte/documents`, du plus engageant au plus rare. */
export const ORDRE_TYPES: TypeDocument[] = ["contrat", "recu", "constat", "restitution"];

export function estTypeDocument(valeur: string | undefined): valeur is TypeDocument {
  return valeur !== undefined && (ORDRE_TYPES as string[]).includes(valeur);
}

/**
 * Ce que `construireDocuments` attend d'une réservation. Décrit en structure
 * plutôt qu'avec les types générés par Prisma : les deux pages interrogent la
 * base différemment — l'accueil a besoin de bien d'autres champs — et c'est
 * cette forme-ci, et elle seule, qui les engage.
 */
export interface SourceDocuments {
  id: string;
  reference: string;
  produit: { nom: string };
  contract: { id: string; statut: StatutContrat; updatedAt: Date } | null;
  handover: { pvPdfPath: string | null; completedAt: Date | null; createdAt: Date } | null;
  restitution: { pvPdfPath: string | null; completedAt: Date | null; createdAt: Date } | null;
  encaissements: { id: string; recuLe: Date; recuRef: string | null }[];
}

/** La sélection Prisma qui satisfait `SourceDocuments`, à réutiliser telle quelle. */
export const INCLUSION_DOCUMENTS = {
  produit: { select: { nom: true } },
  contract: { select: { id: true, statut: true, updatedAt: true } },
  handover: { select: { pvPdfPath: true, completedAt: true, createdAt: true } },
  restitution: { select: { pvPdfPath: true, completedAt: true, createdAt: true } },
  encaissements: {
    // Un versement annulé n'a plus de reçu valable, et un reçu sans PDF n'est
    // pas encore un document : ni l'un ni l'autre ne doit apparaître.
    where: { annuleLe: null, recuPdfPath: { not: null } },
    select: { id: true, recuLe: true, recuRef: true },
    orderBy: { recuLe: "desc" },
  },
} as const;

/**
 * Met les documents de toutes les réservations à plat, du plus récent au plus
 * ancien. Fonction PURE : elle ne touche pas la base, pour que l'accueil la
 * nourrisse avec la requête qu'il fait déjà au lieu d'en lancer une seconde.
 */
export function construireDocuments(reservations: SourceDocuments[]): DocumentClient[] {
  const documents: DocumentClient[] = [];

  for (const r of reservations) {
    // Un BROUILLON est le travail interne du gérant : le client ne voit que
    // ce que la boutique lui a explicitement transmis.
    if (r.contract && r.contract.statut !== "BROUILLON") {
      documents.push({
        cle: `contrat-${r.contract.id}`,
        type: "contrat",
        titre: `Contrat ${r.reference}`,
        meta: r.produit.nom,
        href: `/api/contrats/${r.contract.id}/pdf`,
        quand: r.contract.updatedAt,
        statutContrat: r.contract.statut,
        ...(r.contract.statut === "A_SIGNER_CLIENT" && {
          signerHref: `/compte/contrats/${r.contract.id}/signer`,
        }),
      });
    }

    for (const e of r.encaissements) {
      documents.push({
        cle: `recu-${e.id}`,
        type: "recu",
        titre: `Reçu de versement du ${dateFr(e.recuLe)}`,
        meta: e.recuRef ? `${r.reference} · ${e.recuRef}` : r.reference,
        href: `/api/actes/attestation/${e.id}`,
        quand: e.recuLe,
      });
    }

    if (r.handover?.pvPdfPath) {
      documents.push({
        cle: `constat-${r.id}`,
        type: "constat",
        titre: "Constat de remise",
        meta: `${r.reference} — état du véhicule à la remise`,
        href: `/api/actes/constat/${r.id}`,
        quand: r.handover.completedAt ?? r.handover.createdAt,
      });
    }

    if (r.restitution?.pvPdfPath) {
      documents.push({
        cle: `restitution-${r.id}`,
        type: "restitution",
        titre: "Constat de restitution",
        meta: `${r.reference} — état du véhicule au retour`,
        href: `/api/actes/restitution/${r.id}`,
        quand: r.restitution.completedAt ?? r.restitution.createdAt,
      });
    }
  }

  return documents.sort((a, b) => b.quand.getTime() - a.quand.getTime());
}

/** Charge et met à plat les documents d'un client. Pour la page dédiée. */
export async function chargerDocuments(userId: string): Promise<DocumentClient[]> {
  const reservations = await prisma.reservation.findMany({
    where: { customer: { userId } },
    include: INCLUSION_DOCUMENTS,
    orderBy: { createdAt: "desc" },
  });
  return construireDocuments(reservations);
}

export function compterParType(documents: DocumentClient[]): Record<TypeDocument, number> {
  const comptes: Record<TypeDocument, number> = {
    contrat: 0,
    recu: 0,
    constat: 0,
    restitution: 0,
  };
  for (const d of documents) comptes[d.type] += 1;
  return comptes;
}
