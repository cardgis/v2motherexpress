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
 * ── Ce qu'on garde, ce qu'on efface ────────────────────────────────────────
 * On efface l'IMAGE, pas la preuve d'avoir vérifié. Survivent en base : le type
 * de document, sa taille, sa date de dépôt et son SHA-256. Ce dernier permet
 * encore de confirmer qu'une pièce qu'on vous présente plus tard est bien celle
 * que le gérant a vue. L'identité elle-même reste par ailleurs dans le contrat
 * scellé — nom, numéro de pièce, adresse — qui n'est jamais purgé.
 *
 * Ce qui disparaît est donc la photographie d'une carte d'identité : la donnée
 * la plus sensible du système, la plus convoitée, et celle qui ne sert plus
 * rien une fois le dossier clos.
 *
 * ── Les pièces appartiennent au CLIENT, pas à la réservation ───────────────
 * C'est le point de conception qui gouverne tout ce fichier. Un client peut
 * avoir plusieurs dossiers ; purger à la clôture de l'un supprimerait la pièce
 * qu'un autre, encore en cours, exige. On ne purge donc QUE lorsque plus aucune
 * réservation du client n'est vivante, et le délai court depuis la clôture de
 * la DERNIÈRE.
 *
 * ── Deux temps, pour que la purge se voie venir ────────────────────────────
 * Le premier passage POSE `purgeApres` sans rien supprimer : le dossier affiche
 * alors une date d'effacement à venir. Un passage ultérieur, une fois la date
 * franchie, supprime le blob et renseigne `purgeAt`. Une purge qui s'annonce
 * vaut mieux qu'une purge qui surprend — et si le délai était déjà écoulé au
 * premier passage, les deux temps se produisent dans la même exécution.
 */

import { prisma } from "@/lib/prisma";
import { supprimerBlob } from "@/lib/storage";
import { STATUTS_VIVANTS } from "@/lib/statuts";
import type { StatutReservation } from "@/generated/prisma";

/**
 * Délai après la clôture. 48 heures, choix d'Alexandre le 2026-11-10.
 * Ajustable sans redéploiement : ce genre de durée se révise à l'usage, et
 * surtout à la lumière d'un avis juridique qu'on n'a pas encore.
 */
const HEURES_DEFAUT = 48;

export function delaiHeures(): number {
  const valeur = Number(process.env.PURGE_PIECES_HEURES);
  return Number.isFinite(valeur) && valeur > 0 ? valeur : HEURES_DEFAUT;
}

/**
 * Un BROUILLON n'est pas « clos » : c'est un dossier en cours de constitution.
 * Il ne figure pas dans `STATUTS_VIVANTS`, qui sert à compter l'activité
 * réelle — mais pour décider d'un effacement, il doit retenir la purge.
 */
const STATUTS_QUI_RETIENNENT: readonly StatutReservation[] = ["BROUILLON", ...STATUTS_VIVANTS];

export interface PieceAPurger {
  documentId: string;
  customerId: string;
  type: string;
  /** Date d'effacement prévue, calculée depuis la clôture du dernier dossier. */
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
  // retenant la purge. Le filtre `none` se lit « aucune réservation parmi ».
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
          reservations: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { uploadedAt: "asc" },
  });

  const traitees: PieceAPurger[] = [];

  for (const piece of pieces) {
    // Clôture du dernier dossier. Sans aucune réservation — pièce déposée puis
    // dossier abandonné —, le dépôt sert de référence : cette donnée n'a jamais
    // eu d'usage, il n'y a pas de raison de la garder plus longtemps.
    const cloture = piece.customer.reservations[0]?.updatedAt ?? piece.uploadedAt;
    const purgeApres = new Date(cloture.getTime() + delai);
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
