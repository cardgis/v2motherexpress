/**
 * Création et suivi des réservations.
 *
 * ── Règle non négociable ───────────────────────────────────────────────────
 * AUCUN montant n'est accepté depuis le navigateur. Le client transmet ses
 * choix (modèle, formule, boutique, dates) ; le serveur recalcule seul les
 * montants à partir du catalogue et de `src/lib/offres.ts`. Un montant reçu
 * du client serait un montant négociable par le client.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { creerAvecReference } from "@/lib/reference";
import { etatDossier } from "@/lib/dossier";
import { formulesDisponiblesPour, offreAccessionParCle, OFFRES_ACCESSION } from "@/lib/offres";
import {
  calculerAccession,
  calculerLocationJournaliere,
  echeancierVenteEchelonnee,
} from "@/lib/tarification";
import type { Formule, StatutReservation } from "@/generated/prisma";

/** Durée maximale d'une location courte durée : d'un jour à un mois. */
const LOCATION_JOURNALIERE_MAX_JOURS = 31;

export const schemaReservation = z
  .object({
    produitId: z.string().min(1, "Modèle requis"),
    boutiqueId: z.string().min(1, "Boutique requise"),
    formule: z.enum(["LOCATION_JOURNALIERE", "LOCATION_ACCESSION", "VENTE_ECHELONNEE"]),

    // Location journalière uniquement
    dateDebut: z.coerce.date().optional(),
    dateFin: z.coerce.date().optional(),

    // Location-accession uniquement
    offreCle: z.string().optional(),
  })
  .refine(
    (v) => v.formule !== "LOCATION_JOURNALIERE" || (v.dateDebut && v.dateFin),
    "Dates de début et de fin requises pour une location journalière",
  )
  .refine((v) => v.formule !== "LOCATION_ACCESSION" || !!v.offreCle, "Formule d'accession requise")
  .refine(
    (v) => !v.dateDebut || !v.dateFin || v.dateFin >= v.dateDebut,
    "La date de fin doit suivre la date de début",
  );

export type SaisieReservation = z.infer<typeof schemaReservation>;

export class ErreurReservation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurReservation";
  }
}

/** Détail chiffré d'une réservation, avant ou après enregistrement. */
export interface DevisReservation {
  formule: Formule;
  montantTotal: number;
  montantAcompte: number;
  montantCaution: number;
  redevanceJournaliere: number | null;
  nbJours: number | null;
  /** Clé de l'offre d'accession retenue, nulle pour les autres formules. */
  offreCle: string | null;
  /** Durée du contrat d'accession en mois — s'imprime sur l'acte. */
  dureeMois: number | null;
  engagementMois: number | null;
  differentielSiRupture: number | null;
  echeances: { numero: number; libelle: string; montant: number; jourDepuisSignature: number }[];
  /** Signale un tarif non encore validé commercialement. */
  tarifProvisoire: boolean;
}

/**
 * Calcule le devis sans rien enregistrer.
 *
 * Sert à l'aperçu affiché au client pendant qu'il compose sa réservation, ET
 * au calcul définitif à la création : les deux empruntent exactement le même
 * chemin, donc le prix annoncé est toujours le prix enregistré.
 */
export async function calculerDevis(saisie: SaisieReservation): Promise<DevisReservation> {
  const produit = await prisma.produit.findUnique({
    where: { id: saisie.produitId },
    include: { tarification: true },
  });

  if (!produit || !produit.estActif) {
    throw new ErreurReservation("Ce modèle n'est plus proposé.");
  }

  const formulesOuvertes = formulesDisponiblesPour(produit);
  if (!formulesOuvertes.includes(saisie.formule)) {
    throw new ErreurReservation(`Formule indisponible pour le ${produit.nom}.`);
  }

  switch (saisie.formule) {
    case "LOCATION_JOURNALIERE": {
      const tarif = produit.tarification?.tarifJourneeFcfa;
      if (!tarif) throw new ErreurReservation("Tarif journalier non défini pour ce modèle.");

      const { joursFactures, montantTotal } = calculerLocationJournaliere({
        tarifJournalier: tarif,
        dateDebut: saisie.dateDebut!,
        dateFin: saisie.dateFin!,
      });

      if (joursFactures <= 0) throw new ErreurReservation("Durée de location invalide.");
      if (joursFactures > LOCATION_JOURNALIERE_MAX_JOURS) {
        throw new ErreurReservation(
          "La location courte durée est limitée à un mois. Au-delà, choisissez la location-accession.",
        );
      }

      return {
        formule: saisie.formule,
        montantTotal,
        montantAcompte: 0,
        montantCaution: 0,
        redevanceJournaliere: tarif,
        nbJours: joursFactures,
        offreCle: null,
        dureeMois: null,
        engagementMois: null,
        differentielSiRupture: null,
        echeances: [
          {
            numero: 1,
            libelle: "Règlement au retrait en boutique",
            montant: montantTotal,
            jourDepuisSignature: 0,
          },
        ],
        tarifProvisoire: false,
      };
    }

    case "LOCATION_ACCESSION": {
      const offre = offreAccessionParCle(saisie.offreCle!);
      if (!offre) throw new ErreurReservation("Formule d'accession inconnue.");

      // Une clé d'offre ne doit pas pouvoir être appliquée à un autre modèle :
      // sans ce contrôle, un client pourrait réclamer le tarif A10 sur un E52.
      const offresDuModele = OFFRES_ACCESSION[produit.modele] ?? [];
      if (!offresDuModele.some((o) => o.cle === offre.cle)) {
        throw new ErreurReservation(`Cette formule ne s'applique pas au ${produit.nom}.`);
      }

      const calcul = calculerAccession(offre);

      return {
        formule: saisie.formule,
        montantTotal: calcul.montantTotal,
        montantAcompte: 0,
        montantCaution: 0,
        redevanceJournaliere: calcul.redevanceJournaliere,
        nbJours: calcul.joursFactures,
        offreCle: offre.cle,
        dureeMois: offre.dureeMois,
        engagementMois: offre.avecEngagement ? offre.dureeMois : null,
        differentielSiRupture: offre.avecEngagement ? offre.differentielSiRupture : null,
        echeances: [
          {
            numero: 1,
            libelle: `Redevance journalière, 6 jours sur 7, pendant ${offre.dureeMois} mois`,
            montant: calcul.redevanceJournaliere,
            jourDepuisSignature: 0,
          },
        ],
        tarifProvisoire: offre.provisoire === true,
      };
    }

    case "VENTE_ECHELONNEE": {
      const prix = produit.tarification?.prixVenteFcfa;
      if (!prix) throw new ErreurReservation("Prix de vente non défini pour ce modèle.");

      const echeances = echeancierVenteEchelonnee(prix);

      return {
        formule: saisie.formule,
        montantTotal: prix,
        montantAcompte: echeances[0]!.montant,
        montantCaution: 0,
        redevanceJournaliere: null,
        nbJours: null,
        offreCle: null,
        dureeMois: null,
        engagementMois: null,
        differentielSiRupture: null,
        echeances,
        tarifProvisoire: false,
      };
    }
  }
}

/**
 * Crée la réservation, et le profil client s'il n'existe pas encore.
 *
 * Le statut initial découle de l'état réel du dossier : un client qui a déjà
 * loué et dont les pièces sont validées n'a pas à tout ressaisir.
 */
export async function creerReservation(params: {
  userId: string;
  saisie: SaisieReservation;
}): Promise<{ id: string; reference: string; statut: StatutReservation }> {
  const { userId, saisie } = params;

  const boutique = await prisma.boutique.findUnique({
    where: { id: saisie.boutiqueId },
    select: { id: true, actif: true },
  });
  if (!boutique?.actif) throw new ErreurReservation("Cette boutique n'accepte pas de réservation.");

  const devis = await calculerDevis(saisie);

  // Le profil peut être vide : il sera complété à l'étape suivante.
  const customer = await prisma.customer.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      documents: { where: { purgeAt: null }, select: { type: true } },
      user: { select: { telephone: true } },
    },
  });

  const etat = etatDossier(customer, customer.documents, {
    telephoneVerifie: !!customer.user.telephone,
  });
  const statut: StatutReservation = !etat.complet
    ? "EN_ATTENTE_DOSSIER"
    : customer.statutKyc === "VALIDE"
      ? "EN_ATTENTE_SIGNATURE"
      : "EN_ATTENTE_VALIDATION";

  return creerAvecReference(boutique.id, (reference) => prisma.reservation.create({
    data: {
      reference,
      customerId: customer.id,
      boutiqueId: boutique.id,
      produitId: saisie.produitId,
      formule: saisie.formule,
      dateDebut: saisie.dateDebut ?? null,
      dateFin: saisie.dateFin ?? null,
      nbJours: devis.nbJours,
      montantTotal: devis.montantTotal,
      montantAcompte: devis.montantAcompte,
      montantCaution: devis.montantCaution,
      redevanceJournaliere: devis.redevanceJournaliere,
      offreCle: devis.offreCle,
      dureeMois: devis.dureeMois,
      engagementMois: devis.engagementMois,
      differentielSiRupture: devis.differentielSiRupture,
      statut,
    },
    select: { id: true, reference: true, statut: true },
  }));
}
