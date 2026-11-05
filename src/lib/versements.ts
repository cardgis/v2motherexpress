/**
 * Versements — ce qui est dû, ce qui est reçu.
 *
 * ── Ce que ce module garantit ──────────────────────────────────────────────
 * 1. Aucun cumul n'est stocké. Le solde se recalcule à partir des lignes ; un
 *    total figé finirait par diverger de son détail, et c'est le détail qui
 *    fait foi devant un client.
 * 2. Rien ne s'efface. Une erreur de saisie s'annule avec un motif, par
 *    l'administrateur seul, et la ligne reste visible.
 * 3. Le dû se calcule selon CE QUE DIT L'ACTE, formule par formule — voir
 *    `duADate()`. On n'invente pas de mensualité là où le contrat n'en prévoit
 *    pas.
 * 4. Rien n'est réclamé au titre d'une période antérieure à la mise en service
 *    du suivi : les versements d'avant ne sont pas repris, le dû non plus.
 */

import { prisma } from "@/lib/prisma";
import { echeancierVenteEchelonnee, joursFacturesEntre } from "@/lib/tarification";
import { MODES_PAIEMENT } from "@/lib/modes-paiement";
import { ecrireBlob, lireBlob } from "@/lib/storage";
import { dateCourte, fcfa } from "@/lib/formatters";
import { composerAttestation, VERSION_ATTESTATION } from "@/lib/contrats/attestation";
import type { SnapshotContrat } from "@/lib/contrats/snapshot";
import type { Utilisateur } from "@/lib/auth";
import type { Formule, ModePaiement, Prisma } from "@/generated/prisma";

export class ErreurVersement extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurVersement";
  }
}

/** Un versement isolé ne dépasse pas ce montant : au-delà, c'est une faute de frappe. */
const MONTANT_MAX = 50_000_000;

// ---------------------------------------------------------------------------
// Mise en service du suivi
// ---------------------------------------------------------------------------

/**
 * Date à partir de laquelle les versements sont suivis (`SUIVI_VERSEMENTS_DEPUIS`).
 *
 * Les encaissements antérieurs à la mise en ligne ne sont pas repris : un
 * contrat signé des mois plus tôt afficherait sinon un retard de plusieurs
 * centaines de milliers de francs dès la première réunion. Variable absente —
 * développement — : aucun plancher, chaque contrat est suivi depuis son
 * scellement.
 */
export function debutDuSuivi(): Date | null {
  const saisie = process.env.SUIVI_VERSEMENTS_DEPUIS?.trim();
  if (!saisie) return null;

  const date = new Date(`${saisie}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Le plus tard entre le scellement du contrat et la mise en service du suivi. */
export function debutDuSuiviPour(scelleLe: Date): Date {
  const plancher = debutDuSuivi();
  return plancher && plancher > scelleLe ? plancher : scelleLe;
}

// ---------------------------------------------------------------------------
// Échéancier, figé au scellement
// ---------------------------------------------------------------------------

/**
 * Crée l'échéancier d'une réservation au moment où son contrat est scellé.
 *
 * Figé, comme le snapshot : si la grille change ensuite, un échéancier déjà
 * signé ne bouge pas. Idempotent — rescellé par erreur, il ne se duplique pas.
 */
export async function creerEcheancier(
  tx: Prisma.TransactionClient,
  params: { reservationId: string; formule: Formule; montantTotal: number; scelleLe: Date },
) {
  const { reservationId, formule, montantTotal, scelleLe } = params;

  const dejaLa = await tx.echeance.count({ where: { reservationId } });
  if (dejaLa > 0) return;

  const lignes = echeancesDe(formule, montantTotal, scelleLe);
  if (lignes.length === 0) return;

  await tx.echeance.createMany({
    data: lignes.map((l) => ({ reservationId, ...l })),
  });
}

/** Échéances prévues par l'acte, formule par formule. */
export function echeancesDe(
  formule: Formule,
  montantTotal: number,
  scelleLe: Date,
): { numero: number; libelle: string; montantDu: number; echeanceLe: Date }[] {
  switch (formule) {
    // Article 3 de l'acte : 60 % à la signature, puis 4 × 10 % tous les 30 jours.
    case "VENTE_ECHELONNEE":
      return echeancierVenteEchelonnee(montantTotal).map((e) => ({
        numero: e.numero,
        libelle: e.libelle,
        montantDu: e.montant,
        echeanceLe: ajouterJours(scelleLe, e.jourDepuisSignature),
      }));

    // Réglée au retrait, en une fois.
    case "LOCATION_JOURNALIERE":
      return [
        { numero: 1, libelle: "Règlement au retrait en boutique", montantDu: montantTotal, echeanceLe: scelleLe },
      ];

    // Aucune échéance : l'acte prévoit une redevance journalière, pas des
    // mensualités. Le dû se calcule jour par jour — voir `duADate`.
    case "LOCATION_ACCESSION":
      return [];
  }
}

function ajouterJours(d: Date, jours: number): Date {
  return new Date(d.getTime() + jours * 24 * 3_600_000);
}

// ---------------------------------------------------------------------------
// Solde
// ---------------------------------------------------------------------------

export interface SoldeReservation {
  /** Montant total du contrat. */
  duTotal: number;
  /** Ce qui est exigible aujourd'hui, selon la formule. */
  duADate: number;
  encaisse: number;
  /** Ce qu'il reste à payer jusqu'au terme. */
  restant: number;
  /** Ce qui aurait dû être payé et ne l'est pas. */
  retard: number;
  /** Retard converti en jours de redevance — accession seulement. */
  joursDeRetard: number | null;
  solde: boolean;
  /** Suivi commencé après le scellement : le dû affiché est partiel. */
  suiviPartiel: boolean;
}

interface DonneesSolde {
  formule: Formule;
  montantTotal: number;
  redevanceJournaliere: number | null;
  scelleLe: Date | null;
  suiviDepuis: Date | null;
  /**
   * Date à laquelle le contrat a été ARRÊTÉ par un constat de restitution.
   *
   * Sans elle, le dû d'une accession continuerait de courir sur un contrat qui
   * n'existe plus. Absente tant que le contrat court.
   */
  arreteLe?: Date | null;
  echeances: { montantDu: number; echeanceLe: Date }[];
  encaissements: { montant: number; annuleLe: Date | null }[];
}

/**
 * Calcul pur, sans accès à la base : c'est lui qu'on met à l'épreuve dans
 * `npm run verif:versements`.
 */
export function calculerSolde(d: DonneesSolde, maintenant = new Date()): SoldeReservation {
  const encaisse = d.encaissements
    .filter((e) => e.annuleLe === null)
    .reduce((total, e) => total + e.montant, 0);

  const depart = d.suiviDepuis ?? (d.scelleLe ? debutDuSuiviPour(d.scelleLe) : null);

  // Contrat arrêté : le compteur s'arrête à la restitution. Sans ce gel, une
  // accession rompue au 100e jour continuerait d'accumuler sa redevance
  // quotidienne jusqu'au total du contrat, sur un engagement qui n'existe plus.
  const arrete = d.arreteLe ?? null;
  const jusqua = arrete && arrete < maintenant ? arrete : maintenant;
  const duADate = calculerDuADate(d, depart, jusqua);

  const retard = Math.max(0, duADate - encaisse);
  const redevance = d.redevanceJournaliere ?? 0;

  // Un contrat arrêté ne doit plus les mois restants : son total EST ce qui a
  // couru jusqu'à l'arrêt, plus ce que le constat a mis à sa charge. Le reste à
  // recouvrer et le solde s'y adossent — les faire porter sur le montant du
  // contrat réclamerait une dette que la restitution a éteinte.
  const totalDu = arrete ? duADate : d.montantTotal;

  return {
    duTotal: totalDu,
    duADate,
    encaisse,
    restant: Math.max(0, totalDu - encaisse),
    retard,
    joursDeRetard:
      d.formule === "LOCATION_ACCESSION" && redevance > 0 ? Math.ceil(retard / redevance) : null,
    solde: encaisse >= totalDu,
    suiviPartiel: depart !== null && d.scelleLe !== null && depart > d.scelleLe,
  };
}

function calculerDuADate(d: DonneesSolde, depart: Date | null, maintenant: Date): number {
  // Contrat pas encore scellé : rien n'est exigible.
  if (!depart || depart > maintenant) return 0;

  // Les échéances échues comptent pour TOUTES les formules. Une accession n'en
  // a aucune tant qu'elle court — l'acte n'en prévoit pas — mais sa clôture lui
  // en crée : différentiel de rupture et frais de remise en état.
  const echues = d.echeances
    .filter((e) => e.echeanceLe <= maintenant)
    .reduce((total, e) => total + e.montantDu, 0);

  if (d.formule === "LOCATION_ACCESSION") {
    // L'article 4 fixe une redevance due six jours sur sept : le dû suit les
    // jours réellement écoulés, jamais une moyenne mensuelle. La redevance est
    // plafonnée au total du contrat ; ce que le constat ajoute vient par-dessus.
    const redevance = d.redevanceJournaliere ?? 0;
    if (redevance <= 0) return echues;
    return Math.min(d.montantTotal, joursFacturesEntre(depart, maintenant) * redevance) + echues;
  }

  // Vente et courte durée : ce qui est exigible est la somme des échéances
  // dont la date est passée.
  return echues;
}

// ---------------------------------------------------------------------------
// Saisie
// ---------------------------------------------------------------------------

function perimetre(membre: Utilisateur) {
  return membre.role === "ADMIN" ? {} : { boutiqueId: membre.boutiqueId ?? "__aucune__" };
}

/**
 * Enregistre un versement reçu en boutique.
 *
 * Le gérant saisit ce qu'il a réellement encaissé. Les contrôles portent sur
 * la forme — montant entier positif, mode connu, date plausible — et sur le
 * périmètre : on n'encaisse que pour sa propre boutique. Le montant n'est PAS
 * plafonné au solde : un client peut payer d'avance, et un trop-perçu doit se
 * voir plutôt que d'être refusé en silence.
 */
export async function enregistrerVersement(params: {
  membre: Utilisateur;
  reservationId: string;
  montant: number;
  mode: ModePaiement;
  recuLe: Date;
  reference?: string | null;
}) {
  const { membre, reservationId, montant, mode, recuLe } = params;

  if (!Number.isInteger(montant) || montant <= 0) {
    throw new ErreurVersement("Le montant doit être un nombre entier de francs, supérieur à zéro.");
  }
  if (montant > MONTANT_MAX) {
    throw new ErreurVersement("Montant inhabituel : vérifiez la saisie.");
  }
  if (!MODES_PAIEMENT.includes(mode)) {
    throw new ErreurVersement("Mode de paiement inconnu.");
  }

  const demain = new Date(Date.now() + 24 * 3_600_000);
  if (recuLe > demain) {
    throw new ErreurVersement("La date de réception ne peut pas être dans le futur.");
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(membre) },
    select: { id: true, reference: true, statut: true, formule: true },
  });

  if (!reservation) throw new ErreurVersement("Dossier introuvable.");
  if (reservation.statut === "BROUILLON" || reservation.statut === "ANNULEE" || reservation.statut === "CADUQUE") {
    throw new ErreurVersement(
      `Aucun encaissement possible sur un dossier ${reservation.statut.toLowerCase()}.`,
    );
  }

  // La référence du reçu dérive de celle du dossier : pas de compteur
  // supplémentaire, et un numéro lisible par le client comme par la comptabilité.
  const rang = (await prisma.encaissement.count({ where: { reservationId } })) + 1;

  const cree = await prisma.encaissement.create({
    data: {
      reservationId,
      montant,
      mode,
      recuLe,
      reference: params.reference?.trim() || null,
      saisiParUserId: membre.id,
      saisiParNom: membre.nomAffichage ?? "Équipe",
      recuRef: `${reservation.reference}-V${rang}`,
    },
    select: { id: true, montant: true, mode: true, recuLe: true, recuRef: true },
  });

  await ajusterCloture(reservationId);
  return cree;
}

/**
 * Clôt une vente entièrement payée, ou la rouvre si un versement est annulé.
 *
 * ── Pourquoi la VENTE seulement ────────────────────────────────────────────
 * Le paiement intégral fait tomber la réserve de propriété de l'article 5 : la
 * moto appartient à l'acheteur, le dossier est fini. Rien de tel ailleurs —
 * payer d'avance une location-accession n'abrège pas sa durée ferme, et une
 * location journalière ne s'achève qu'au retour du véhicule.
 *
 * Tant que la moto n'est pas remise (`ACTIVE`), rien ne se clôt : un client
 * qui a tout payé sans être passé la chercher n'a pas fini son parcours.
 */
async function ajusterCloture(reservationId: string) {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      formule: true,
      statut: true,
      montantTotal: true,
      vehiculeId: true,
      contract: { select: { id: true } },
      encaissements: { where: { annuleLe: null }, select: { montant: true } },
    },
  });

  if (!r || r.formule !== "VENTE_ECHELONNEE") return;

  const encaisse = r.encaissements.reduce((total, e) => total + e.montant, 0);
  const solde = encaisse >= r.montantTotal;

  if (solde && r.statut === "ACTIVE") {
    await prisma.$transaction([
      prisma.reservation.update({ where: { id: r.id }, data: { statut: "TERMINEE" } }),
      ...(r.vehiculeId
        ? [prisma.vehicule.update({ where: { id: r.vehiculeId }, data: { statut: "VENDU" } })]
        : []),
      ...(r.contract
        ? [
            prisma.contractEvent.create({
              data: { contractId: r.contract.id, type: "SOLDE", metadata: { encaisse } },
            }),
          ]
        : []),
    ]);
    return;
  }

  // Versement annulé après coup : le dossier n'est plus soldé, il reprend.
  if (!solde && r.statut === "TERMINEE") {
    await prisma.$transaction([
      prisma.reservation.update({ where: { id: r.id }, data: { statut: "ACTIVE" } }),
      ...(r.vehiculeId
        ? [prisma.vehicule.update({ where: { id: r.vehiculeId }, data: { statut: "EN_LOCATION" } })]
        : []),
    ]);
  }
}

/**
 * Annule un versement — administrateur seul, avec un motif conservé.
 *
 * On n'efface jamais une ligne d'argent : elle reste visible, barrée, avec la
 * raison et le nom de qui a décidé.
 */
export async function annulerVersement(params: {
  admin: Utilisateur;
  encaissementId: string;
  motif: string;
}) {
  const motif = params.motif.trim();
  if (motif.length < 10) {
    throw new ErreurVersement("Indiquez pourquoi ce versement est annulé, en une phrase au moins.");
  }
  if (motif.length > 500) {
    throw new ErreurVersement("Motif trop long : 500 caractères maximum.");
  }

  const existant = await prisma.encaissement.findUnique({
    where: { id: params.encaissementId },
    select: { id: true, annuleLe: true, reservationId: true },
  });

  if (!existant) throw new ErreurVersement("Versement introuvable.");
  if (existant.annuleLe) throw new ErreurVersement("Ce versement est déjà annulé.");

  const annule = await prisma.encaissement.update({
    where: { id: existant.id },
    data: {
      annuleLe: new Date(),
      annuleParUserId: params.admin.id,
      annuleMotif: motif,
    },
    select: { id: true, annuleLe: true, reservationId: true },
  });

  // Un dossier clos par erreur doit rouvrir dès que l'argent disparaît.
  await ajusterCloture(annule.reservationId);
  return { id: annule.id, annuleLe: annule.annuleLe };
}

// ---------------------------------------------------------------------------
// Consultation
// ---------------------------------------------------------------------------

/** Échéances, versements et solde d'un dossier. */
export async function chargerVersements(membre: Utilisateur, reservationId: string) {
  const r = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(membre) },
    select: {
      id: true,
      reference: true,
      formule: true,
      montantTotal: true,
      redevanceJournaliere: true,
      suiviDepuis: true,
      // Date d'arrêt : elle gèle le compteur d'une accession rompue.
      restitution: { select: { dateRestitution: true } },
      echeances: {
        select: { id: true, numero: true, libelle: true, montantDu: true, echeanceLe: true },
        orderBy: { numero: "asc" },
      },
      encaissements: {
        select: {
          id: true,
          montant: true,
          mode: true,
          recuLe: true,
          reference: true,
          recuRef: true,
          saisiParNom: true,
          annuleLe: true,
          annuleMotif: true,
        },
        orderBy: { recuLe: "desc" },
      },
      contract: { select: { events: { where: { type: "SCELLE" }, select: { createdAt: true }, take: 1 } } },
    },
  });

  if (!r) return null;

  const scelleLe = r.contract?.events[0]?.createdAt ?? null;

  return {
    reservationId: r.id,
    reference: r.reference,
    formule: r.formule,
    redevanceJournaliere: r.redevanceJournaliere,
    echeances: r.echeances,
    encaissements: r.encaissements,
    solde: calculerSolde({
      formule: r.formule,
      montantTotal: r.montantTotal,
      redevanceJournaliere: r.redevanceJournaliere,
      scelleLe,
      suiviDepuis: r.suiviDepuis,
      arreteLe: r.restitution?.dateRestitution ?? null,
      echeances: r.echeances,
      encaissements: r.encaissements,
    }),
  };
}

/**
 * Recherche pour la saisie rapide : le client se présente au comptoir sans
 * rendez-vous, le gérant tape ce qu'il a sous la main — une référence, un nom,
 * un numéro. Cloisonnée à la boutique, comme tout le back-office.
 */
export async function chercherDossiers(membre: Utilisateur, requete: string) {
  const texte = requete.trim();
  if (texte.length < 2) return [];

  // Un numéro saisi « 77 123 45 67 » doit retrouver « +221771234567 ».
  const chiffres = texte.replace(/[^0-9]/g, "");

  const reservations = await prisma.reservation.findMany({
    where: {
      ...perimetre(membre),
      statut: { notIn: ["BROUILLON", "ANNULEE", "CADUQUE"] },
      OR: [
        { reference: { contains: texte, mode: "insensitive" } },
        { customer: { nom: { contains: texte, mode: "insensitive" } } },
        { customer: { prenom: { contains: texte, mode: "insensitive" } } },
        ...(chiffres.length >= 6
          ? [{ customer: { user: { telephone: { contains: chiffres } } } }]
          : []),
      ],
    },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      formule: true,
      montantTotal: true,
      redevanceJournaliere: true,
      suiviDepuis: true,
      // Date d'arrêt : elle gèle le compteur d'une accession rompue.
      restitution: { select: { dateRestitution: true } },
      produit: { select: { nom: true } },
      boutique: { select: { store: { select: { name: true } } } },
      customer: { select: { nom: true, prenom: true, user: { select: { telephone: true } } } },
      echeances: { select: { montantDu: true, echeanceLe: true } },
      encaissements: { select: { montant: true, annuleLe: true } },
      contract: { select: { events: { where: { type: "SCELLE" }, select: { createdAt: true }, take: 1 } } },
    },
  });

  return reservations.map((r) => ({
    id: r.id,
    reference: r.reference,
    client: r.customer.nom && r.customer.prenom ? `${r.customer.nom.toUpperCase()} ${r.customer.prenom}` : "Dossier sans nom",
    telephone: r.customer.user.telephone,
    produit: r.produit.nom,
    boutique: r.boutique.store.name,
    formule: r.formule,
    solde: calculerSolde({
      formule: r.formule,
      montantTotal: r.montantTotal,
      redevanceJournaliere: r.redevanceJournaliere,
      scelleLe: r.contract?.events[0]?.createdAt ?? null,
      suiviDepuis: r.suiviDepuis,
      arreteLe: r.restitution?.dateRestitution ?? null,
      echeances: r.echeances,
      encaissements: r.encaissements,
    }),
  }));
}

export type DossierTrouve = Awaited<ReturnType<typeof chercherDossiers>>[number];

// ---------------------------------------------------------------------------
// Attestation de versement
// ---------------------------------------------------------------------------

/** Libellés des cases du modèle papier : « 1er (60 %) », « 2e (10 %) »… */
function libelleEcheance(numero: number, montantDu: number, total: number): string {
  const rang = numero === 1 ? "1er" : `${numero}e`;
  const part = total > 0 ? Math.round((montantDu / total) * 100) : 0;
  return `${rang} (${part} %)`;
}

/**
 * Produit le reçu d'un versement et le range avec les actes du dossier.
 *
 * ── Pourquoi aucun champ n'est saisi ICI ───────────────────────────────────
 * Montant, date et mode viennent de l'encaissement enregistré, sans retouche
 * possible : un reçu qui dirait autre chose que le registre serait un faux.
 * C'est au moment de la SAISIE que le gérant fixe ces valeurs ; l'attestation
 * ne fait que les mettre en forme.
 *
 * Les deux signatures sont reprises du contrat, et le document le dit.
 */
export async function genererAttestation(params: { membre: Utilisateur; encaissementId: string }) {
  const { membre, encaissementId } = params;

  const versement = await prisma.encaissement.findFirst({
    where: { id: encaissementId, reservation: perimetre(membre) },
    select: {
      id: true,
      montant: true,
      recuLe: true,
      mode: true,
      recuRef: true,
      annuleLe: true,
      reservation: {
        select: {
          id: true,
          reference: true,
          formule: true,
          montantTotal: true,
          boutique: { select: { store: { select: { city: true, name: true } } } },
          echeances: { select: { numero: true, montantDu: true }, orderBy: { numero: "asc" } },
          encaissements: {
            where: { annuleLe: null },
            select: { id: true, montant: true, recuLe: true, createdAt: true },
            orderBy: [{ recuLe: "asc" }, { createdAt: "asc" }],
          },
          contract: {
            select: {
              id: true,
              reference: true,
              donnees: true,
              signatures: { select: { role: true, imagePath: true, signedAt: true } },
            },
          },
        },
      },
    },
  });

  if (!versement) throw new ErreurVersement("Versement introuvable.");
  if (versement.annuleLe) {
    throw new ErreurVersement("Ce versement est annulé : aucune attestation ne peut en être tirée.");
  }

  const r = versement.reservation;
  const snapshot = r.contract?.donnees as unknown as SnapshotContrat | undefined;
  if (!snapshot) {
    throw new ErreurVersement("Aucun contrat établi : l'attestation reprend l'identité de l'acte.");
  }

  // Cumul ARRÊTÉ à ce versement : un reçu ne tient pas compte de ce qui a été
  // payé après lui, sans quoi sa réimpression changerait de contenu.
  const ordre = r.encaissements.findIndex((e) => e.id === versement.id);
  const cumul = r.encaissements
    .slice(0, ordre + 1)
    .reduce((total, e) => total + e.montant, 0);

  // Cases cumulatives : une échéance est cochée dès que le cumul la couvre.
  let couvert = 0;
  const echeances = r.echeances.map((e) => {
    couvert += e.montantDu;
    return {
      libelle: libelleEcheance(e.numero, e.montantDu, r.montantTotal),
      cochee: cumul >= couvert,
    };
  });

  const attestation = await composerAttestation({
    reference: r.reference,
    formule: r.formule,
    bailleurRaisonSociale: snapshot.bailleurRaisonSociale,
    bailleurNinea: snapshot.bailleurNinea,
    bailleurSiege: snapshot.bailleurSiege,
    bailleurRepresentant: snapshot.bailleurRepresentant,
    clientNomComplet: snapshot.clientNomComplet,
    clientNumeroPiece: snapshot.clientNumeroPiece,
    montantVerse: fcfa(versement.montant),
    datePaiement: dateCourte(versement.recuLe),
    mode: versement.mode,
    montantRestantDu: fcfa(Math.max(0, r.montantTotal - cumul)),
    echeances,
    signaturesReprisesDu: mentionSignatures(r.contract),
    lieuSignature: r.boutique.store.city ?? r.boutique.store.name,
    dateSignature: dateCourte(versement.recuLe),
  });

  // Incrustation des tracés du contrat, aux emplacements calculés à la
  // composition de CE document.
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(attestation.octets);

  for (const role of ["GERANT", "CLIENT"] as const) {
    const trace = r.contract?.signatures.find((s) => s.role === role);
    if (!trace) continue;

    const cible = role === "GERANT" ? attestation.emplacements.gerant : attestation.emplacements.client;
    const page = pdf.getPages()[cible.page];
    if (!page) continue;

    const image = await pdf.embedPng((await lireBlob(trace.imagePath)).octets);
    const dims = image.scaleToFit(cible.largeur, cible.hauteur);
    page.drawImage(image, {
      x: cible.x + (cible.largeur - dims.width) / 2,
      y: cible.y,
      width: dims.width,
      height: dims.height,
    });
  }

  const octets = await pdf.save();
  const chemin = `versements/${r.reference}/attestation-${versement.recuRef ?? versement.id}.pdf`;
  await ecrireBlob(chemin, octets, "application/pdf");

  await prisma.$transaction([
    prisma.encaissement.update({ where: { id: versement.id }, data: { recuPdfPath: chemin } }),
    ...(r.contract
      ? [
          prisma.contractEvent.create({
            data: {
              contractId: r.contract.id,
              type: "ATTESTATION",
              acteurUserId: membre.id,
              metadata: {
                recuRef: versement.recuRef,
                montant: versement.montant,
                version: VERSION_ATTESTATION,
              },
            },
          }),
        ]
      : []),
  ]);

  return { chemin, recuRef: versement.recuRef, pages: attestation.pages };
}

/** « Signatures reprises du contrat … du 25/06/2026 », ou rien s'il n'y en a pas. */
function mentionSignatures(
  contrat: { reference: string; signatures: { signedAt: Date }[] } | null,
): string | null {
  const date = contrat?.signatures[0]?.signedAt;
  if (!contrat || !date) return null;
  return `Signatures reprises du contrat ${contrat.reference}, signé le ${dateCourte(date)}.`;
}
