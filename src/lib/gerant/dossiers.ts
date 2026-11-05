/**
 * Back-office gérant — consultation et validation des dossiers clients.
 *
 * ── Cloisonnement ──────────────────────────────────────────────────────────
 * Un `Customer` n'appartient à aucune boutique : le rattachement se fait par
 * ses réservations. Un gérant ne voit donc un dossier que si le client a au
 * moins une réservation dans SA boutique. Ce filtre est appliqué dans chaque
 * requête ci-dessous, jamais laissé à l'appelant.
 *
 * ── Attribution du véhicule ────────────────────────────────────────────────
 * La moto est affectée AU MOMENT de la validation du dossier, et non au
 * retrait : sans cela, le numéro de châssis n'apparaîtrait pas sur le contrat
 * signé, seulement sur le procès-verbal de remise.
 */

import { prisma } from "@/lib/prisma";
import { etatDossier } from "@/lib/dossier";
import { calculerSolde } from "@/lib/versements";
import { estAnnulable } from "@/lib/annulation";
import type { StatutKyc } from "@/generated/prisma";
import type { Utilisateur } from "@/lib/auth";

export class ErreurDossier extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurDossier";
  }
}

/** Clause de rattachement d'un client au périmètre d'un gérant. */
function perimetre(gerant: Utilisateur) {
  if (gerant.role === "ADMIN") return {};
  return { reservations: { some: { boutiqueId: gerant.boutiqueId ?? "__aucune__" } } };
}

/** Clause de filtrage des réservations visibles par le gérant. */
function reservationsDuPerimetre(gerant: Utilisateur) {
  return gerant.role === "ADMIN" ? {} : { boutiqueId: gerant.boutiqueId ?? "__aucune__" };
}

function nomComplet(c: { nom: string | null; prenom: string | null }): string {
  return c.nom && c.prenom ? `${c.nom.toUpperCase()} ${c.prenom}` : "Dossier sans nom";
}

const libelleModele = (p: { marque: string; modele: string }) => `${p.marque} / ${p.modele}`;

// ---------------------------------------------------------------------------
// Consultation
// ---------------------------------------------------------------------------

export type FiltreDossier = "A_TRAITER" | "TOUS";

export async function listerDossiers(gerant: Utilisateur, filtre: FiltreDossier = "A_TRAITER") {
  const statuts: StatutKyc[] =
    filtre === "A_TRAITER" ? ["A_VERIFIER"] : ["INCOMPLET", "A_VERIFIER", "VALIDE", "REJETE"];

  const clients = await prisma.customer.findMany({
    where: { ...perimetre(gerant), statutKyc: { in: statuts } },
    include: {
      user: { select: { telephone: true, email: true } },
      documents: { where: { purgeAt: null }, select: { type: true } },
      reservations: {
        where: reservationsDuPerimetre(gerant),
        include: {
          produit: { select: { nom: true, modele: true } },
          boutique: { select: { store: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "asc" }, // le dossier qui attend depuis le plus longtemps d'abord
    take: 200,
  });

  return clients.map((c) => ({
    id: c.id,
    nomComplet: nomComplet(c),
    telephone: c.user.telephone,
    email: c.user.email,
    ville: c.ville,
    statutKyc: c.statutKyc,
    deposeLe: c.updatedAt,
    nbDocuments: c.documents.length,
    etat: etatDossier(c, c.documents, { telephoneVerifie: !!c.user.telephone }),
    reservations: c.reservations.map((r) => ({
      id: r.id,
      reference: r.reference,
      produit: r.produit.nom,
      boutique: r.boutique.store.name,
      formule: r.formule,
      statut: r.statut,
      montantTotal: r.montantTotal,
      vehiculeId: r.vehiculeId,
    })),
  }));
}

/** Détail d'un dossier, avec ses pièces et les véhicules affectables. */
export async function chargerDossier(gerant: Utilisateur, customerId: string) {
  const c = await prisma.customer.findFirst({
    where: { id: customerId, ...perimetre(gerant) },
    include: {
      user: { select: { telephone: true, email: true } },
      documents: {
        where: { purgeAt: null },
        select: { id: true, type: true, mimeType: true, tailleOctets: true, uploadedAt: true },
        orderBy: { type: "asc" },
      },
      reservations: {
        where: reservationsDuPerimetre(gerant),
        include: {
          produit: { select: { id: true, nom: true, marque: true, modele: true } },
          vehicule: { select: { id: true, numeroChassis: true, immatriculation: true } },
          contract: {
            select: {
              id: true,
              statut: true,
              // Date de scellement : c'est elle qui ouvre le suivi des versements.
              events: {
                where: { type: "SCELLE" },
                select: { createdAt: true },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
          // Pour rouvrir le constat depuis la fiche : trois mois après la
          // remise, c'est ici qu'on le cherche, pas sur l'écran de retrait.
          handover: { select: { pvPdfPath: true } },
          restitution: { select: { pvPdfPath: true, dateRestitution: true } },
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
              recuPdfPath: true,
              saisiParNom: true,
              annuleLe: true,
              annuleMotif: true,
            },
            orderBy: { recuLe: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!c) return null;

  // Véhicules disponibles du bon modèle dans chaque boutique concernée, et
  // modèles du catalogue proposés à la saisie : requêtes lancées en parallèle.
  const [vehiculesParReservation, catalogue] = await Promise.all([
    Promise.all(
      c.reservations.map(async (r) => ({
        reservationId: r.id,
        vehicules: await prisma.vehicule.findMany({
          where: { boutiqueId: r.boutiqueId, produitId: r.produitId, statut: "DISPONIBLE" },
          select: { id: true, numeroChassis: true, immatriculation: true, couleur: true },
          orderBy: { numeroChassis: "asc" },
        }),
      })),
    ),
    prisma.produit.findMany({
      where: { estActif: true },
      select: { marque: true, modele: true },
      orderBy: [{ marque: "asc" }, { modele: "asc" }],
    }),
  ]);

  return {
    id: c.id,
    nomComplet: nomComplet(c),
    prenom: c.prenom,
    nom: c.nom,
    dateNaissance: c.dateNaissance,
    lieuNaissance: c.lieuNaissance,
    nationalite: c.nationalite,
    typePiece: c.typePiece,
    numeroPiece: c.numeroPiece,
    pieceDateExpiration: c.pieceDateExpiration,
    numeroPermis: c.numeroPermis,
    adresse: c.adresse,
    quartier: c.quartier,
    ville: c.ville,
    profession: c.profession,
    telephone: c.user.telephone,
    email: c.user.email,
    telephoneContact: c.telephoneContact,
    statutKyc: c.statutKyc,
    kycMotifRejet: c.kycMotifRejet,
    consentementAt: c.consentementAt,
    documents: c.documents,
    etat: etatDossier(c, c.documents, { telephoneVerifie: !!c.user.telephone }),
    /** Suggestions pour le champ « Marque / Modèle » du contrat. */
    modelesCatalogue: [...new Set(catalogue.map(libelleModele))],
    reservations: c.reservations.map((r) => ({
      id: r.id,
      reference: r.reference,
      produit: r.produit.nom,
      modele: r.produit.modele,
      /** Ce que l'acte imprime si le gérant ne saisit rien. */
      modeleCatalogue: libelleModele(r.produit),
      formule: r.formule,
      statut: r.statut,
      montantTotal: r.montantTotal,
      redevanceJournaliere: r.redevanceJournaliere,
      dureeMois: r.dureeMois,
      engagementMois: r.engagementMois,
      dateDebut: r.dateDebut,
      dateFin: r.dateFin,
      dateSignatureContrat: r.dateSignatureContrat,
      // Valeurs saisies par le gérant, qui priment à l'impression.
      modeleContrat: r.modeleContrat,
      numeroSerieContrat: r.numeroSerieContrat,
      immatriculationContrat: r.immatriculationContrat,
      modesPaiementContrat: r.modesPaiementContrat,
      // Vente : état coché aux articles 2 et 9 de l'acte.
      etatVenteContrat: r.etatVenteContrat,
      // Location journalière : l'acte demande dix valeurs de plus, toutes
      // convenues au comptoir.
      heureDepart: r.heureDepart,
      heureRetour: r.heureRetour,
      montantCaution: r.montantCaution,
      limiteKm: r.limiteKm,
      forfaitKmSupp: r.forfaitKmSupp,
      zoneUtilisation: r.zoneUtilisation,
      etatGeneralDepart: r.etatGeneralDepart,
      vehicule: r.vehicule,
      contrat: r.contract ? { id: r.contract.id, statut: r.contract.statut } : null,
      constatEtabli: r.handover?.pvPdfPath != null,
      // Annulable tant que le contrat n'est pas scellé ; au-delà ce serait une
      // résiliation. Calculé ici pour que l'écran n'ait pas à le redéduire.
      annulable: estAnnulable(r.statut, r.contract?.statut ?? null),
      annuleMotif: r.annuleMotif,
      restitutionEtablie: r.restitution?.pvPdfPath != null,
      // Argent reçu et solde à ce jour : le gérant répond au client sans
      // quitter sa fiche, et tire une attestation déjà produite si besoin.
      echeances: r.echeances,
      encaissements: r.encaissements,
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
      vehiculesDisponibles:
        vehiculesParReservation.find((v) => v.reservationId === r.id)?.vehicules ?? [],
    })),
  };
}

export type DossierDetail = NonNullable<Awaited<ReturnType<typeof chargerDossier>>>;

// ---------------------------------------------------------------------------
// Décisions
// ---------------------------------------------------------------------------

/**
 * Valide le dossier et fait avancer les réservations en attente.
 *
 * La complétude est RECONTRÔLÉE ici : le gérant peut avoir la page ouverte
 * depuis un moment, et le client avoir retiré une pièce entre-temps.
 *
 * Tout se joue dans UNE transaction, et chaque moto est prise par une mise à
 * jour conditionnelle (`statut = DISPONIBLE`) : si deux gérants attribuent la
 * même machine au même instant, un seul réussit, l'autre reçoit un message
 * clair et rien n'est enregistré de son côté.
 */
export async function validerDossier(params: {
  gerant: Utilisateur;
  customerId: string;
  /** Véhicule à affecter, par réservation. */
  affectations?: { reservationId: string; vehiculeId: string }[];
}) {
  const { gerant, customerId, affectations = [] } = params;

  const c = await prisma.customer.findFirst({
    where: { id: customerId, ...perimetre(gerant) },
    include: {
      documents: { where: { purgeAt: null }, select: { type: true } },
      user: { select: { telephone: true } },
    },
  });

  if (!c) throw new ErreurDossier("Dossier introuvable.");
  if (c.statutKyc === "VALIDE") throw new ErreurDossier("Ce dossier est déjà validé.");

  const etat = etatDossier(c, c.documents, { telephoneVerifie: !!c.user.telephone });
  if (!etat.complet) {
    throw new ErreurDossier(
      `Dossier incomplet : ${[...etat.champsManquants, ...etat.documentsManquants].join(", ")}.`,
    );
  }

  // On ne fait pas confiance au formulaire : chaque réservation doit être
  // celle de ce client, dans le périmètre du gérant, et sans moto déjà prise.
  const idsReservations = affectations.map((a) => a.reservationId);
  const idsVehicules = affectations.map((a) => a.vehiculeId);

  if (new Set(idsReservations).size !== idsReservations.length) {
    throw new ErreurDossier("Une réservation ne peut recevoir qu'une moto.");
  }
  if (new Set(idsVehicules).size !== idsVehicules.length) {
    throw new ErreurDossier("Une même moto ne peut pas être attribuée à deux réservations.");
  }

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: idsReservations }, customerId, ...reservationsDuPerimetre(gerant) },
    select: { id: true, boutiqueId: true, produitId: true, vehiculeId: true },
  });
  if (reservations.length !== idsReservations.length) {
    throw new ErreurDossier("Réservation hors de votre périmètre.");
  }
  if (reservations.some((r) => r.vehiculeId)) {
    throw new ErreurDossier("Une moto est déjà attribuée à cette réservation.");
  }
  const parId = new Map(reservations.map((r) => [r.id, r]));

  await prisma.$transaction(async (tx) => {
    const dossier = await tx.customer.updateMany({
      where: { id: customerId, statutKyc: { not: "VALIDE" } },
      data: {
        statutKyc: "VALIDE",
        kycVerifiePar: gerant.id,
        kycVerifieAt: new Date(),
        kycMotifRejet: null,
      },
    });
    if (dossier.count === 0) throw new ErreurDossier("Ce dossier vient d'être validé par ailleurs.");

    for (const a of affectations) {
      const r = parId.get(a.reservationId)!;

      const prise = await tx.vehicule.updateMany({
        where: {
          id: a.vehiculeId,
          boutiqueId: r.boutiqueId,
          produitId: r.produitId,
          statut: "DISPONIBLE",
        },
        data: { statut: "RESERVE" },
      });
      if (prise.count !== 1) {
        throw new ErreurDossier("Ce véhicule n'est plus disponible ou ne correspond pas au modèle.");
      }

      await tx.reservation.update({ where: { id: r.id }, data: { vehiculeId: a.vehiculeId } });
    }

    await tx.reservation.updateMany({
      where: {
        customerId,
        statut: { in: ["EN_ATTENTE_DOSSIER", "EN_ATTENTE_VALIDATION"] },
        ...reservationsDuPerimetre(gerant),
      },
      data: { statut: "EN_ATTENTE_SIGNATURE" },
    });
  });

  return { statutKyc: "VALIDE" as const, affectations: affectations.length };
}

/**
 * Rejette le dossier avec un motif, qui sera affiché au client tel quel dans
 * son espace personnel — il doit donc être rédigé pour être lu par lui.
 */
export async function rejeterDossier(params: {
  gerant: Utilisateur;
  customerId: string;
  motif: string;
}) {
  const motif = params.motif.trim();
  if (motif.length < 10) {
    throw new ErreurDossier("Indiquez au client ce qu'il doit corriger, en une phrase au moins.");
  }
  if (motif.length > 1000) {
    throw new ErreurDossier("Le motif est trop long : 1 000 caractères maximum.");
  }

  const c = await prisma.customer.findFirst({
    where: { id: params.customerId, ...perimetre(params.gerant) },
    select: { id: true, statutKyc: true },
  });

  if (!c) throw new ErreurDossier("Dossier introuvable.");
  if (c.statutKyc === "VALIDE") {
    throw new ErreurDossier("Ce dossier est déjà validé — il ne peut plus être rejeté ici.");
  }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: c.id },
      data: {
        statutKyc: "REJETE",
        kycMotifRejet: motif,
        kycVerifiePar: params.gerant.id,
        kycVerifieAt: new Date(),
      },
    }),
    // Le client doit pouvoir reprendre son dossier : les réservations
    // retournent en attente de pièces.
    prisma.reservation.updateMany({
      where: { customerId: c.id, statut: "EN_ATTENTE_VALIDATION" },
      data: { statut: "EN_ATTENTE_DOSSIER" },
    }),
  ]);

  return { statutKyc: "REJETE" as const };
}
