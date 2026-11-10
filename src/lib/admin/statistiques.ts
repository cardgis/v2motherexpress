/**
 * Chiffres de l'administration — ventes, locations, contrats en cours.
 *
 * ── Ce que compte chaque chiffre ───────────────────────────────────────────
 * Vente, location longue durée ET location courte durée : un contrat SCELLÉ
 *   dans la période, daté de son scellement. « Scellé » veut dire signé par le
 *   client PUIS contresigné par la boutique, l'acte final étant établi — c'est
 *   l'événement `SCELLE` du contrat qui en fait foi. Un contrat devenu caduc
 *   (pièce non conforme au retrait) ou annulé n'est ni une vente ni une
 *   location.
 * En cours : l'état au moment de la consultation, quelle que soit la période.
 *   Une réservation ACTIVE implique un contrat scellé, puisqu'on n'y arrive
 *   qu'après le retrait du véhicule.
 *
 * ── Pourquoi la courte durée était comptée autrement (corrigé 2026-11-10) ──
 * Elle l'était depuis les RÉSERVATIONS, au motif qu'« aucun acte n'existait
 * encore pour cette formule ». L'acte journalier a été écrit depuis, et la
 * justification est tombée sans que le calcul suive. Une réservation reçue
 * gonflait donc le panneau comme une location aboutie, alors qu'elle peut
 * n'aller jamais plus loin — demande d'Alexandre, et il avait raison.
 *
 * Cela corrigeait aussi un DOUBLE COMPTAGE dans le graphique d'évolution : sa
 * première branche comptait tous les contrats scellés, journalières comprises,
 * et une seconde y ajoutait les réservations journalières. Les deux séries
 * atterrissaient sur la même courbe et s'additionnaient.
 *
 * Les montants sont CONTRACTUELS — prix de vente, valeur des redevances
 * engagées — et non encaissés. C'est voulu : ce panneau mesure ce que la
 * boutique a VENDU sur la période. Ce qui est réellement rentré se lit sur
 * `/admin/versements`, qui s'appuie sur les tables `Echeance` et
 * `Encaissement`. Deux écrans, deux questions : ne pas chercher à les
 * rapprocher, un contrat signé en janvier et payé en mars appartient
 * légitimement à janvier ici et à mars là-bas.
 *
 * ── Performance ────────────────────────────────────────────────────────────
 * Les regroupements se font en base (SQL paramétré) : le volume de contrats
 * peut croître sans que l'écran ne charge toutes les lignes en mémoire.
 */

import { prisma } from "@/lib/prisma";
import type { Formule } from "@/generated/prisma";
import type { CleSerie, Periode } from "./filtres";

export interface ChiffreMontant {
  nombre: number;
  montant: number;
}

interface Agregat extends ChiffreMontant {
  formule: Formule;
  boutiqueId: string;
  produitId: string;
}

/**
 * Requêtes SQL paramétrées : chaque valeur part en paramètre `$n`, jamais dans
 * le texte de la requête ; le texte n'est fait que de constantes de ce fichier.
 *
 * Pourquoi pas des fragments `Prisma.sql` imbriqués : dans le serveur Next, le
 * client Prisma est chargé en double, et un fragment venant de l'autre copie
 * n'est pas reconnu comme du SQL — il part comme une valeur et la base reçoit
 * une requête invalide. Même cause que `src/lib/erreurs-prisma.ts`.
 */
type Parametre = (valeur: unknown, conversion?: string) => string;

async function lire<T>(construire: (p: Parametre) => string): Promise<T[]> {
  const valeurs: unknown[] = [];
  const p: Parametre = (valeur, conversion = "") => {
    valeurs.push(valeur);
    return `$${valeurs.length}${conversion}`;
  };
  const sql = construire(p);
  return prisma.$queryRawUnsafe<T[]>(sql, ...valeurs);
}

/** `colonne` est TOUJOURS une constante de ce fichier, jamais une saisie. */
function dansPeriode(colonne: string, periode: Periode, p: Parametre): string {
  if (!periode.debut || !periode.fin) return "";
  return `AND ${colonne} >= ${p(periode.debut, "::timestamp")} AND ${colonne} < ${p(periode.fin, "::timestamp")}`;
}

function dansBoutique(boutiqueId: string | null, p: Parametre): string {
  return boutiqueId ? `AND r."boutiqueId" = ${p(boutiqueId)}` : "";
}

/** Date de scellement de chaque contrat : son premier événement SCELLE. */
const SCELLES = `
  scelles AS (
    SELECT "contractId", min("createdAt") AS signe_le
    FROM "ContractEvent"
    WHERE type = 'SCELLE'
    GROUP BY "contractId"
  )`;

const somme = (lignes: Agregat[], retenir: (l: Agregat) => boolean): ChiffreMontant =>
  lignes
    .filter(retenir)
    .reduce((total, l) => ({ nombre: total.nombre + l.nombre, montant: total.montant + l.montant }), {
      nombre: 0,
      montant: 0,
    });

const SERIE_DE_LA_FORMULE: Record<Formule, CleSerie> = {
  VENTE_ECHELONNEE: "ventes",
  LOCATION_ACCESSION: "longues",
  LOCATION_JOURNALIERE: "courtes",
};

export async function chargerTableauDeBord({
  periode,
  boutiqueId,
  maintenant = new Date(),
}: {
  periode: Periode;
  boutiqueId: string | null;
  maintenant?: Date;
}) {
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth();
  const debutDouzeMois = new Date(Date.UTC(annee, mois - 11, 1));
  const perimetre = boutiqueId ? { boutiqueId } : {};
  const intervalle = periode.debut && periode.fin ? { gte: periode.debut, lt: periode.fin } : undefined;

  const [signes, evolution, recues, reservations, contrats, dossiers, flotte, boutiques] =
    await Promise.all([
      lire<Agregat>((p) => `
        WITH ${SCELLES}
        SELECT r.formule::text AS formule, r."boutiqueId", r."produitId",
               count(*)::int AS nombre,
               coalesce(sum(r."montantTotal"), 0)::float8 AS montant
        FROM scelles s
        JOIN "Contract" c ON c.id = s."contractId"
        JOIN "Reservation" r ON r.id = c."reservationId"
        WHERE c.statut NOT IN ('CADUC', 'ANNULE')
          ${dansPeriode("s.signe_le", periode, p)}
          ${dansBoutique(boutiqueId, p)}
        GROUP BY 1, 2, 3`),

      lire<{ mois: string; formule: Formule; nombre: number }>((p) => `
        WITH ${SCELLES}
        SELECT to_char(date_trunc('month', s.signe_le), 'YYYY-MM') AS mois,
               r.formule::text AS formule, count(*)::int AS nombre
        FROM scelles s
        JOIN "Contract" c ON c.id = s."contractId"
        JOIN "Reservation" r ON r.id = c."reservationId"
        WHERE c.statut NOT IN ('CADUC', 'ANNULE')
          AND s.signe_le >= ${p(debutDouzeMois, "::timestamp")}
          ${dansBoutique(boutiqueId, p)}
        GROUP BY 1, 2`),

      prisma.reservation.count({
        where: { ...perimetre, statut: { not: "BROUILLON" }, ...(intervalle ? { createdAt: intervalle } : {}) },
      }),

      prisma.reservation.groupBy({
        by: ["boutiqueId", "formule", "statut"],
        where: perimetre,
        _count: { _all: true },
      }),

      prisma.contract.groupBy({
        by: ["statut"],
        where: boutiqueId ? { reservation: { boutiqueId } } : {},
        _count: { _all: true },
      }),

      prisma.customer.count({
        where: { statutKyc: "A_VERIFIER", ...(boutiqueId ? { reservations: { some: { boutiqueId } } } : {}) },
      }),

      prisma.vehicule.groupBy({
        by: ["boutiqueId", "statut"],
        where: perimetre,
        _count: { _all: true },
      }),

      prisma.boutique.findMany({
        where: boutiqueId ? { id: boutiqueId } : {},
        select: { id: true, code: true, actif: true, store: { select: { name: true } } },
        orderBy: { code: "asc" },
      }),
    ]);

  const reservationsOu = (retenir: (g: (typeof reservations)[number]) => boolean) =>
    reservations.filter(retenir).reduce((n, g) => n + g._count._all, 0);
  const contratsAuStatut = (statut: string) => contrats.find((c) => c.statut === statut)?._count._all ?? 0;

  // ── Aujourd'hui ────────────────────────────────────────────────────────────
  const enCours = {
    ventes: reservationsOu((g) => g.statut === "ACTIVE" && g.formule === "VENTE_ECHELONNEE"),
    longues: reservationsOu((g) => g.statut === "ACTIVE" && g.formule === "LOCATION_ACCESSION"),
    courtes: reservationsOu((g) => g.statut === "ACTIVE" && g.formule === "LOCATION_JOURNALIERE"),
    total: reservationsOu((g) => g.statut === "ACTIVE"),
  };

  const chezLeClient = contratsAuStatut("A_SIGNER_CLIENT");
  const aContresigner = contratsAuStatut("A_SIGNER_GERANT");
  const aTraiter = {
    dossiers,
    // Une réservation « en attente de signature » dont l'acte est déjà chez le
    // client ou à contresigner ne compte pas deux fois.
    contratsAEtablir: Math.max(0, reservationsOu((g) => g.statut === "EN_ATTENTE_SIGNATURE") - chezLeClient - aContresigner),
    chezLeClient,
    aContresigner,
    retraits: reservationsOu((g) => g.statut === "EN_ATTENTE_RETRAIT"),
  };

  // ── Par boutique ───────────────────────────────────────────────────────────
  const parBoutique = boutiques.map((b) => ({
    id: b.id,
    code: b.code,
    nom: b.store.name,
    actif: b.actif,
    ventes: somme(signes, (l) => l.boutiqueId === b.id && l.formule === "VENTE_ECHELONNEE"),
    longues: somme(signes, (l) => l.boutiqueId === b.id && l.formule === "LOCATION_ACCESSION"),
    courtes: somme(signes, (l) => l.boutiqueId === b.id && l.formule === "LOCATION_JOURNALIERE"),
    enCours: reservationsOu((g) => g.boutiqueId === b.id && g.statut === "ACTIVE"),
    motos: flotte.filter((f) => f.boutiqueId === b.id).reduce((n, f) => n + f._count._all, 0),
    motosDisponibles: flotte
      .filter((f) => f.boutiqueId === b.id && f.statut === "DISPONIBLE")
      .reduce((n, f) => n + f._count._all, 0),
  }));

  // ── Par modèle ─────────────────────────────────────────────────────────────
  const produitIds = [...new Set(signes.map((l) => l.produitId))];
  const produits = produitIds.length
    ? await prisma.produit.findMany({ where: { id: { in: produitIds } }, select: { id: true, nom: true } })
    : [];

  const parModele = produits
    .map((p) => {
      const ventes = somme(signes, (l) => l.produitId === p.id && l.formule === "VENTE_ECHELONNEE").nombre;
      const longues = somme(signes, (l) => l.produitId === p.id && l.formule === "LOCATION_ACCESSION").nombre;
      const courtesModele = somme(signes, (l) => l.produitId === p.id && l.formule === "LOCATION_JOURNALIERE").nombre;
      return { id: p.id, nom: p.nom, ventes, longues, courtes: courtesModele, total: ventes + longues + courtesModele };
    })
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom));

  // ── Douze derniers mois ────────────────────────────────────────────────────
  const libelleMois = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });
  const douzeMois = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(annee, mois - 11 + i, 1));
    return {
      cle: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      libelle: libelleMois.format(d),
      ventes: 0,
      longues: 0,
      courtes: 0,
    };
  });
  for (const ligne of evolution) {
    const cible = douzeMois.find((m) => m.cle === ligne.mois);
    if (cible) cible[SERIE_DE_LA_FORMULE[ligne.formule]] += ligne.nombre;
  }

  return {
    indicateurs: {
      ventes: somme(signes, (l) => l.formule === "VENTE_ECHELONNEE"),
      longues: somme(signes, (l) => l.formule === "LOCATION_ACCESSION"),
      courtes: somme(signes, (l) => l.formule === "LOCATION_JOURNALIERE"),
      reservationsRecues: recues,
    },
    enCours,
    aTraiter,
    parBoutique,
    parModele,
    douzeMois,
  };
}

export type TableauDeBord = Awaited<ReturnType<typeof chargerTableauDeBord>>;
export type MoisGraphique = TableauDeBord["douzeMois"][number];
