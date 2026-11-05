/**
 * Génération des références de dossier : LME-2026-THS-0142
 *
 * La référence figure sur le contrat signé et sert d'identifiant d'échange
 * entre le client, le gérant et la comptabilité. Deux dossiers ne peuvent en
 * aucun cas partager la même : l'incrément se fait donc en UN SEUL ordre SQL
 * atomique (`INSERT … ON CONFLICT DO UPDATE … RETURNING`), et non par une
 * lecture suivie d'une écriture, qui laisserait une fenêtre de concurrence
 * entre deux réservations simultanées.
 *
 * Le compteur est cloisonné par boutique ET par année : la séquence de Thiès
 * repart à 0001 au 1er janvier, indépendamment de celle de Mbour.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { estViolationUnicite } from "@/lib/erreurs-prisma";
import { FUSEAU_DAKAR } from "@/lib/formatters";

/** Année civile à Dakar. Le fuseau est UTC+0 sans heure d'été. */
export function anneeDakar(d: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: FUSEAU_DAKAR }).format(d),
  );
}

/**
 * Réserve le prochain numéro pour une boutique et retourne la référence
 * complète. Chaque appel consomme un numéro, y compris si la transaction
 * appelante échoue ensuite : un trou dans la séquence est sans conséquence,
 * un doublon serait grave.
 */
export async function prochaineReference(boutiqueId: string): Promise<string> {
  const boutique = await prisma.boutique.findUniqueOrThrow({
    where: { id: boutiqueId },
    select: { code: true },
  });

  const annee = anneeDakar();

  const [{ dernier }] = await prisma.$queryRaw<{ dernier: number }[]>`
    INSERT INTO "CompteurReference" ("id", "boutiqueId", "annee", "dernier")
    VALUES (${nouvelId()}, ${boutiqueId}, ${annee}, 1)
    ON CONFLICT ("boutiqueId", "annee")
      DO UPDATE SET "dernier" = "CompteurReference"."dernier" + 1
    RETURNING "dernier"
  `;

  return `LME-${annee}-${boutique.code}-${String(dernier).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Résistance à un compteur en retard
// ---------------------------------------------------------------------------

const TENTATIVES_MAX = 5;

/**
 * Crée un enregistrement qui porte une référence, sans jamais échouer parce
 * que le compteur serait en retard sur les références déjà attribuées.
 *
 * Le compteur ne recule jamais en usage normal, mais il peut se retrouver
 * derrière la réalité : restauration d'une sauvegarde, intervention manuelle
 * en base, script de test. Sans ce garde-fou, chaque réservation de la
 * boutique échouerait en erreur 500 jusqu'à ce qu'on répare la base à la main.
 *
 * Sur collision, le compteur est réaligné sur la plus haute référence
 * réellement présente, puis on réessaie : quel que soit le retard, la
 * tentative suivante obtient un numéro libre. Le nombre de tentatives reste
 * borné, pour ne jamais boucler sur une panne d'une autre nature.
 */
export async function creerAvecReference<T>(
  boutiqueId: string,
  creer: (reference: string) => Promise<T>,
): Promise<T> {
  for (let tentative = 1; ; tentative++) {
    const reference = await prochaineReference(boutiqueId);
    try {
      return await creer(reference);
    } catch (erreur) {
      if (!estCollisionDeReference(erreur) || tentative >= TENTATIVES_MAX) throw erreur;
      console.warn(
        `[reference] ${reference} déjà attribuée — compteur en retard, réalignement (tentative ${tentative})`,
      );
      await realignerCompteur(boutiqueId);
    }
  }
}

/** Violation de l'unicité de `reference`. */
export function estCollisionDeReference(erreur: unknown): boolean {
  return estViolationUnicite(erreur, "reference");
}

/**
 * Remonte le compteur de l'année au niveau de la plus haute référence déjà
 * attribuée à la boutique. Ne le fait jamais redescendre.
 */
export async function realignerCompteur(boutiqueId: string): Promise<void> {
  const annee = anneeDakar();
  const motif = `^LME-${annee}-[A-Z0-9]+-[0-9]+$`;

  await prisma.$executeRaw`
    UPDATE "CompteurReference" AS c
    SET "dernier" = GREATEST(c."dernier", COALESCE((
      SELECT max(split_part(r."reference", '-', 4)::int)
      FROM "Reservation" AS r
      WHERE r."boutiqueId" = ${boutiqueId} AND r."reference" ~ ${motif}
    ), 0))
    WHERE c."boutiqueId" = ${boutiqueId} AND c."annee" = ${annee}
  `;
}

/**
 * Identifiant de la ligne de compteur. Prisma génère les `cuid()` côté
 * application : une insertion en SQL brut doit donc fournir le sien.
 */
function nouvelId(): string {
  return `c${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}
