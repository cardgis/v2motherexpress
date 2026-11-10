/**
 * Purge des pièces d'identité — la seconde moitié d'une promesse du schéma.
 *
 * ── Ce qui manquait ────────────────────────────────────────────────────────
 * `CustomerDocument` porte `purgeApres` et `purgeAt`, avec ce commentaire :
 * « Purge CDP : `purgeApres` est posé à la clôture du contrat, un cron
 * supprime le blob et renseigne `purgeAt` ». La LECTURE était prête — neuf
 * requêtes de l'application filtrent déjà `where: { purgeAt: null }` — mais
 * `purgeApres` n'était jamais posé et aucun blob n'était jamais supprimé.
 * Même cas de figure que `Reservation.expireLe` avant le cron d'expiration.
 *
 * ── Le déclencheur : la LIVRAISON, pas la fin du contrat ───────────────────
 * Décision d'Alexandre, 2026-11-11 : 48 heures après le retrait — contrat
 * final signé des deux côtés, état des lieux fait, moto livrée. Le gérant a
 * alors eu le temps de vérifier et de valider la pièce.
 *
 * C'est plus juste que d'attendre la fin du contrat, comme je l'avais d'abord
 * écrit. La pièce sert à une chose : vérifier, au retrait, que la personne à
 * qui l'on confie une moto est bien celle qu'elle prétend. Ce service rendu,
 * la garder pendant les vingt-quatre mois d'une accession ne protège personne
 * et expose tout le monde. `Handover.completedAt` marque précisément cet
 * instant.
 *
 * ── Ce qu'on garde, ce qu'on efface ────────────────────────────────────────
 * On efface l'IMAGE, pas la preuve d'avoir vérifié. Survivent en base : le
 * type de document, sa taille, sa date de dépôt et son SHA-256. Ce dernier
 * permet encore de confirmer qu'une pièce présentée plus tard est bien celle
 * que le gérant a vue. Et `Handover` conserve `pieceVerifiee`,
 * `pieceConforme`, `pieceVerifieeAt` et le nom du gérant : qui a vérifié,
 * quand, avec quelle conclusion. L'identité elle-même reste dans le contrat
 * scellé — nom, numéro de pièce, adresse — qui n'est jamais purgé.
 *
 * Ce qui disparaît est donc la photographie d'une carte d'identité : la donnée
 * la plus sensible du système, la plus convoitée, et celle dont l'utilité
 * s'achève à la remise des clés.
 *
 * ── Les pièces appartiennent au CLIENT, pas à la réservation ───────────────
 * C'est le point de conception qui gouverne tout ce fichier. Un client peut
 * avoir plusieurs dossiers ; purger après le retrait de l'un supprimerait la
 * pièce qu'un autre, encore en instruction, exige. On ne purge donc que
 * lorsque PLUS AUCUN dossier du client n'a besoin de la regarder.
 *
 * ── Deux temps, pour que la purge se voie venir ────────────────────────────
 * Le premier passage POSE `purgeApres` sans rien supprimer : le dossier
 * affiche alors une date d'effacement à venir. Un passage ultérieur, la date
 * franchie, supprime le blob et renseigne `purgeAt`. Si le délai était déjà
 * écoulé au premier passage, les deux temps se produisent dans la même
 * exécution.
 */

import { prisma } from "@/lib/prisma";
import { supprimerBlob } from "@/lib/storage";
import type { StatutReservation } from "@/generated/prisma";

/**
 * Délai après la livraison. 48 heures, choix d'Alexandre le 2026-11-10.
 * Ajustable sans redéploiement : ce genre de durée se révise à l'usage, et
 * surtout à la lumière d'un avis juridique qu'on n'a pas encore.
 */
const HEURES_DEFAUT = 48;

export function delaiHeures(): number {
  const valeur = Number(process.env.PURGE_PIECES_HEURES);
  return Number.isFinite(valeur) && valeur > 0 ? valeur : HEURES_DEFAUT;
}

/**
 * États dans lesquels la pièce doit encore pouvoir être REGARDÉE.
 *
 * Le gérant la consulte à la validation du KYC, puis une seconde fois au
 * retrait — `retrait.ts` lit explicitement les `PIECE_RECTO` et `PIECE_VERSO`
 * non purgées. Tant qu'un dossier n'a pas franchi le retrait, la pièce lui est
 * nécessaire. `BROUILLON` est inclus : un dossier en constitution n'est pas un
 * dossier traité.
 *
 * Au-delà — ACTIVE, TERMINEE, ARRETEE, ANNULEE, CADUQUE — plus personne n'a à
 * la voir.
 */
const STATUTS_QUI_RETIENNENT: readonly StatutReservation[] = [
  "BROUILLON",
  "EN_ATTENTE_DOSSIER",
  "EN_ATTENTE_VALIDATION",
  "EN_ATTENTE_SIGNATURE",
  "EN_ATTENTE_RETRAIT",
];

export interface PieceAPurger {
  documentId: string;
  customerId: string;
  type: string;
  /** Date d'effacement prévue, calculée depuis la dernière livraison. */
  purgeApres: Date;
  /** `true` si ce passage l'a réellement effacée. */
  effacee: boolean;
}

export async function purgerPieces(
  options: { maintenant?: Date; apercu?: boolean } = {},
): Promise<PieceAPurger[]> {
  const maintenant = options.maintenant ?? new Date();
  const delai = delaiHeures() * 3_600_000;

  // Candidats : pièces encore présentes, dont le client n'a plus aucun dossier
  // ayant besoin de les regarder. Le filtre `none` se lit « aucune réservation
  // parmi ces états ».
  const pieces = await prisma.customerDocument.findMany({
    where: {
      purgeAt: null,
      customer: { reservations: { none: { statut: { in: [...STATUTS_QUI_RETIENNENT] } } } },
    },
    select: {
      id: true,
      customerId: true,
      type: true,
      blobPath: true,
      uploadedAt: true,
      customer: {
        select: {
          reservations: {
            select: { updatedAt: true, handover: { select: { completedAt: true } } },
          },
        },
      },
    },
    orderBy: { uploadedAt: "asc" },
  });

  const traitees: PieceAPurger[] = [];

  for (const piece of pieces) {
    // Référence de calcul, par dossier : la LIVRAISON si elle a eu lieu, sinon
    // la dernière modification du dossier — un dossier annulé ou caduc n'a
    // jamais connu de retrait, et sa pièce doit pourtant finir par partir.
    const dates = piece.customer.reservations.map(
      (r) => r.handover?.completedAt ?? r.updatedAt,
    );

    // La plus RÉCENTE : un client aux dossiers multiples voit sa pièce
    // conservée jusqu'à 48 h après sa dernière livraison, pas la première.
    // Sans aucun dossier, le dépôt sert de référence : cette donnée n'a jamais
    // eu d'usage, rien ne justifie de la garder davantage.
    const reference = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : piece.uploadedAt;

    const purgeApres = new Date(reference.getTime() + delai);
    const mure = purgeApres <= maintenant;

    if (options.apercu) {
      traitees.push({
        documentId: piece.id,
        customerId: piece.customerId,
        type: piece.type,
        purgeApres,
        effacee: mure,
      });
      continue;
    }

    // Une pièce par itération, et jamais de transaction englobante : un blob
    // introuvable ou un stockage momentanément indisponible ne doit pas retenir
    // les autres purges.
    try {
      if (mure) {
        // L'ordre compte. Le blob d'abord : si la suppression échoue, la ligne
        // reste marquée non purgée et le prochain passage réessaiera. Dans
        // l'autre sens, on aurait une pièce déclarée effacée mais toujours
        // présente dans le stockage — le pire des deux états.
        await supprimerBlob(piece.blobPath);
        await prisma.customerDocument.update({
          where: { id: piece.id },
          data: { purgeApres, purgeAt: maintenant },
        });
      } else {
        await prisma.customerDocument.update({ where: { id: piece.id }, data: { purgeApres } });
      }

      traitees.push({
        documentId: piece.id,
        customerId: piece.customerId,
        type: piece.type,
        purgeApres,
        effacee: mure,
      });
    } catch (erreur) {
      // Le chemin du blob n'est pas journalisé : il désigne une pièce d'identité.
      console.error(`[purge] pièce ${piece.id} (${piece.type}) non traitée`, erreur);
    }
  }

  return traitees;
}
