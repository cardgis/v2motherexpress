/**
 * Flotte physique — les motos réelles, une ligne par machine.
 *
 * À distinguer du catalogue V1 (`Produit`), qui décrit des MODÈLES et leurs
 * prix. Ici on tient l'inventaire des exemplaires : numéro de série gravé sur
 * le cadre, immatriculation, certificat de mise en circulation. Ce sont ces
 * valeurs-là qui s'impriment sur le contrat, à l'article 2.
 *
 * ── Qui décide du statut ───────────────────────────────────────────────────
 * Un gérant peut immobiliser une moto ou la remettre en service. Il ne peut
 * PAS la déclarer réservée ou en location : ces états découlent du parcours
 * client et sont posés par le système. Les laisser à la main ouvrirait la
 * porte à une moto « disponible » alors qu'un contrat signé la retient.
 */

import { prisma } from "@/lib/prisma";
import type { StatutVehicule } from "@/generated/prisma";
import type { Utilisateur } from "@/lib/auth";
import {
  LIBELLES_STATUT_VEHICULE,
  STATUTS_AUTOMATIQUES,
  STATUTS_MANUELS,
} from "./flotte-libelles";

export class ErreurFlotte extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurFlotte";
  }
}

function perimetre(gerant: Utilisateur) {
  return gerant.role === "ADMIN" ? {} : { boutiqueId: gerant.boutiqueId ?? "__aucune__" };
}

// ---------------------------------------------------------------------------
// Consultation
// ---------------------------------------------------------------------------

export async function listerFlotte(gerant: Utilisateur) {
  const vehicules = await prisma.vehicule.findMany({
    where: perimetre(gerant),
    include: {
      produit: { select: { id: true, nom: true, modele: true } },
      boutique: { select: { code: true, store: { select: { name: true } } } },
      reservations: {
        where: { statut: { in: ["EN_ATTENTE_RETRAIT", "ACTIVE"] } },
        select: { id: true, reference: true, statut: true },
        take: 1,
      },
    },
    orderBy: [{ produit: { modele: "asc" } }, { numeroChassis: "asc" }],
  });

  return vehicules.map((v) => ({
    id: v.id,
    produitId: v.produit.id,
    produit: v.produit.nom,
    modele: v.produit.modele,
    boutique: v.boutique.store.name,
    numeroChassis: v.numeroChassis,
    immatriculation: v.immatriculation,
    cmc: v.cmc,
    couleur: v.couleur,
    statut: v.statut,
    /** Renseigné si la moto est engagée sur un dossier : elle n'est pas libre. */
    engageeSur: v.reservations[0] ?? null,
  }));
}

export type VehiculeFlotte = Awaited<ReturnType<typeof listerFlotte>>[number];

/** Modèles du catalogue proposables à l'ajout. */
export async function modelesDisponibles() {
  return prisma.produit.findMany({
    where: { estActif: true },
    select: { id: true, nom: true, modele: true },
    orderBy: { modele: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

function nettoyer(valeur: unknown): string | null {
  const texte = String(valeur ?? "").trim();
  return texte === "" ? null : texte;
}

export async function ajouterVehicule(params: {
  gerant: Utilisateur;
  /**
   * Boutique où la moto est stationnée — lue pour l'administrateur SEULEMENT.
   * Un gérant ajoute toujours dans sa propre boutique, quoi qu'envoie le
   * navigateur.
   */
  boutiqueId?: string;
  produitId: string;
  numeroChassis: string;
  immatriculation?: string;
  cmc?: string;
  couleur?: string;
}) {
  const { gerant } = params;

  const boutiqueId = gerant.role === "ADMIN" ? params.boutiqueId : gerant.boutiqueId;
  if (!boutiqueId) {
    throw new ErreurFlotte("Choisissez la boutique où la moto est stationnée.");
  }
  if (gerant.role === "ADMIN") {
    const boutique = await prisma.boutique.findUnique({ where: { id: boutiqueId }, select: { id: true } });
    if (!boutique) throw new ErreurFlotte("Boutique inconnue.");
  }

  const numeroChassis = String(params.numeroChassis ?? "").trim().toUpperCase();
  if (numeroChassis.length < 5) {
    throw new ErreurFlotte("Le numéro de série figure sur le cadre — au moins 5 caractères.");
  }

  const produit = await prisma.produit.findFirst({
    where: { id: params.produitId, estActif: true },
    select: { id: true },
  });
  if (!produit) throw new ErreurFlotte("Modèle inconnu.");

  // Le numéro de série identifie la machine : un doublon signalerait soit une
  // faute de frappe, soit deux motos confondues dans l'inventaire.
  const doublon = await prisma.vehicule.findUnique({
    where: { numeroChassis },
    select: { id: true },
  });
  if (doublon) throw new ErreurFlotte(`Le numéro de série ${numeroChassis} est déjà enregistré.`);

  const immatriculation = nettoyer(params.immatriculation);
  if (immatriculation) await verifierImmatriculationLibre(immatriculation, null);

  return prisma.vehicule.create({
    data: {
      boutiqueId,
      produitId: produit.id,
      numeroChassis,
      immatriculation,
      cmc: nettoyer(params.cmc),
      couleur: nettoyer(params.couleur),
    },
    select: { id: true, numeroChassis: true },
  });
}

export async function modifierVehicule(params: {
  gerant: Utilisateur;
  vehiculeId: string;
  immatriculation?: string;
  cmc?: string;
  couleur?: string;
  statut?: StatutVehicule;
}) {
  const { gerant, vehiculeId } = params;

  const vehicule = await prisma.vehicule.findFirst({
    where: { id: vehiculeId, ...perimetre(gerant) },
    select: { id: true, statut: true, numeroChassis: true },
  });
  if (!vehicule) throw new ErreurFlotte("Moto introuvable.");

  const donnees: Record<string, unknown> = {};

  if (params.immatriculation !== undefined) {
    const immatriculation = nettoyer(params.immatriculation);
    if (immatriculation) await verifierImmatriculationLibre(immatriculation, vehiculeId);
    donnees.immatriculation = immatriculation;
  }
  if (params.cmc !== undefined) donnees.cmc = nettoyer(params.cmc);
  if (params.couleur !== undefined) donnees.couleur = nettoyer(params.couleur);

  if (params.statut !== undefined) {
    if (!STATUTS_MANUELS.includes(params.statut)) {
      throw new ErreurFlotte(
        `Le statut « ${LIBELLES_STATUT_VEHICULE[params.statut]} » est posé par le système, pas à la main.`,
      );
    }
    // Une moto engagée sur un dossier ne se libère pas d'un clic : il faut
    // passer par l'annulation ou la caducité du contrat.
    if (STATUTS_AUTOMATIQUES.includes(vehicule.statut)) {
      throw new ErreurFlotte(
        `Cette moto est en statut « ${LIBELLES_STATUT_VEHICULE[vehicule.statut]} » : ` +
          "son statut dépend du dossier client en cours.",
      );
    }
    donnees.statut = params.statut;
  }

  if (Object.keys(donnees).length === 0) {
    throw new ErreurFlotte("Aucune modification demandée.");
  }

  return prisma.vehicule.update({
    where: { id: vehicule.id },
    data: donnees,
    select: { id: true, numeroChassis: true },
  });
}

/**
 * Retire une moto de l'inventaire.
 *
 * Refusé dès qu'elle a servi : les réservations et les contrats y renvoient,
 * et une machine effacée rendrait des actes signés illisibles. Une moto qui
 * quitte le parc se met HORS_SERVICE ou VENDU, elle ne s'efface pas.
 */
export async function supprimerVehicule(gerant: Utilisateur, vehiculeId: string) {
  const vehicule = await prisma.vehicule.findFirst({
    where: { id: vehiculeId, ...perimetre(gerant) },
    select: { id: true, numeroChassis: true, _count: { select: { reservations: true } } },
  });
  if (!vehicule) throw new ErreurFlotte("Moto introuvable.");

  if (vehicule._count.reservations > 0) {
    throw new ErreurFlotte(
      "Cette moto figure sur des dossiers clients et ne peut pas être effacée. " +
        "Passez-la en « Hors service » pour la retirer du parc.",
    );
  }

  await prisma.vehicule.delete({ where: { id: vehicule.id } });
  return { numeroChassis: vehicule.numeroChassis };
}

async function verifierImmatriculationLibre(immatriculation: string, sauf: string | null) {
  const existante = await prisma.vehicule.findFirst({
    where: { immatriculation, ...(sauf ? { NOT: { id: sauf } } : {}) },
    select: { numeroChassis: true },
  });
  if (existante) {
    throw new ErreurFlotte(
      `L'immatriculation ${immatriculation} est déjà portée par la moto ${existante.numeroChassis}.`,
    );
  }
}
