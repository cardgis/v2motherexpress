/**
 * Construction du snapshot contractuel.
 *
 * ── Pourquoi un snapshot ───────────────────────────────────────────────────
 * Toutes les valeurs qui figureront sur l'acte sont figées ici, au moment de
 * la génération, et stockées telles quelles dans `Contract.donnees`. Si le
 * client déménage trois mois plus tard, le contrat signé ne bouge pas : il
 * n'est JAMAIS recalculé à partir des données vivantes.
 *
 * Les champs reprennent l'inventaire relevé sur les actes réels — voir
 * `docs/modeles-contrats.md`.
 */

import { prisma } from "@/lib/prisma";
import { ajouterMois, dateCourte, fcfa, nombre, quantite } from "@/lib/formatters";
import { echeancierVenteEchelonnee, joursFacturesEntre } from "@/lib/tarification";
import type { Formule, ModePaiement } from "@/generated/prisma";

/** Mentions légales de l'entreprise, identiques sur tous les actes. */
export const BAILLEUR = {
  raisonSociale: "LA MOTHER EXPRESS",
  ninea: "008246888",
  siege: "PARCELLES ASSAINIES UNITÉ 10 VILLA N°244",
} as const;

export interface SnapshotContrat {
  // Identification
  reference: string;
  formule: Formule;
  dateEmission: string;

  // Le Bailleur / Vendeur
  bailleurRaisonSociale: string;
  bailleurNinea: string;
  bailleurSiege: string;
  /** Représentant légal de la boutique. Peut différer du gérant qui signe. */
  bailleurRepresentant: string;
  /**
   * Adresse de la BOUTIQUE, et non du siège : c'est ce que porte l'en-tête du
   * contrat de location journalière.
   */
  bailleurAdresseBoutique: string;

  // Le Locataire / Acheteur — seuls champs du client qui s'impriment
  clientNomComplet: string;
  clientNumeroPiece: string;
  clientAdresse: string;
  clientTelephone: string;

  // Le véhicule
  vehiculeMarqueModele: string;
  vehiculeNumeroSerie: string;
  vehiculeImmatriculation: string;
  vehiculeCmc: string;
  vehiculeValeurReference: string;
  /**
   * VENTE — état porté aux articles 2 et 9. Absent des snapshots figés avant
   * l'ajout du champ : l'acte y imprimait « Neuf » en dur, la valeur par
   * défaut du composeur le reproduit donc à l'identique.
   */
  etatVenteVehicule?: "Neuf" | "D'occasion";

  // Conditions — location-accession
  dureeMois: number | null;
  dateDebut: string;
  dateFin: string;
  redevanceJournaliere: string;
  /** Renseignés uniquement sur la formule avec engagement (article 5). */
  avecEngagement: boolean;
  tarifSansEngagement: string;
  differentielJournalier: string;

  /**
   * Cases cochées à l'article « Modalités de paiement ». Absent des snapshots
   * figés avant l'ajout de ce champ : leurs cases sont restées vierges.
   */
  modesPaiement?: ModePaiement[];

  /**
   * Conditions — location journalière.
   *
   * Cet acte demande dix valeurs que les deux autres ignorent : heures, durée,
   * tarif, caution, kilométrage, zone, état. Elles sont convenues au comptoir
   * et saisies par le gérant ; à défaut, elles s'impriment « Néant », comme sur
   * le contrat papier laissé en pointillés.
   */
  departLe: string;
  retourLe: string;
  dureeLocation: string;
  tarifLocation: string;
  montantCaution: string;
  limiteKm: string;
  forfaitKmSupplementaires: string;
  zoneUtilisation: string;
  etatGeneral: string;

  // Conditions — vente échelonnée
  prixTotal: string;
  echeances: { libelle: string; montant: string; delaiJours: number }[];

  // Signature
  lieuSignature: string;
  dateSignature: string;

  /**
   * Total indicatif. Aucun acte ne l'imprime : la location-accession se
   * facture au jour réellement écoulé, 6 jours sur 7. Conservé pour l'espace
   * client et le suivi commercial, jamais présenté comme contractuel.
   */
  montantTotalIndicatif: string;
  joursFacturesIndicatif: number | null;
}

export class ErreurSnapshot extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurSnapshot";
  }
}

/**
 * Fige les données d'une réservation en vue de la génération de son contrat.
 *
 * Refuse de produire quoi que ce soit tant que le dossier n'est pas validé :
 * un acte engage juridiquement, il ne se génère pas sur des pièces non
 * vérifiées.
 */
export async function construireSnapshot(reservationId: string): Promise<SnapshotContrat> {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: { include: { user: { select: { telephone: true } } } },
      boutique: { include: { store: { select: { name: true, city: true } } } },
      produit: { include: { tarification: true } },
      vehicule: true,
    },
  });

  if (!r) throw new ErreurSnapshot("Réservation introuvable.");

  if (r.customer.statutKyc !== "VALIDE") {
    throw new ErreurSnapshot(
      "Le dossier du client n'est pas validé — génération de contrat interdite.",
    );
  }

  const c = r.customer;
  const manquants = (
    [
      ["nom", c.nom],
      ["prénom", c.prenom],
      ["numéro de pièce", c.numeroPiece],
      ["adresse", c.adresse],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([libelle]) => libelle);

  if (manquants.length > 0) {
    throw new ErreurSnapshot(`Données client incomplètes : ${manquants.join(", ")}.`);
  }

  // Format des actes : NOM en capitales, puis prénoms. Ex. « DIOUF Papa Demba ».
  const clientNomComplet = `${c.nom!.toUpperCase()} ${c.prenom!}`;

  const dateDebut = r.dateDebut ?? new Date();
  // La durée est LUE, jamais redéduite d'un tarif : la grille peut changer,
  // l'acte déjà signé ne doit pas s'en trouver modifié.
  const dureeMois = r.dureeMois;
  const dateFin = r.dateFin ?? (dureeMois ? ajouterMois(dateDebut, dureeMois) : null);

  const valeurReference = r.produit.tarification?.prixVenteFcfa ?? 0;

  // Jours facturés sur les dates RÉELLES du contrat, pas sur une moyenne de
  // mois : c'est ce que stipule l'article 4 (six jours sur sept).
  const joursFactures = dateFin ? joursFacturesEntre(dateDebut, dateFin) : r.nbJours;

  return {
    reference: r.reference,
    formule: r.formule,
    dateEmission: dateCourte(new Date()),

    bailleurRaisonSociale: BAILLEUR.raisonSociale,
    bailleurNinea: BAILLEUR.ninea,
    bailleurSiege: BAILLEUR.siege,
    bailleurRepresentant: r.boutique.representantNom,
    bailleurAdresseBoutique: r.boutique.adresse,

    clientNomComplet,
    clientNumeroPiece: c.numeroPiece!,
    clientAdresse: [c.adresse, c.quartier, c.ville].filter(Boolean).join(", "),
    // Téléphone vérifié du compte ; à défaut (client connecté par e-mail),
    // celui qu'il a déclaré dans son dossier.
    clientTelephone: c.user.telephone ?? c.telephoneContact ?? "Néant",

    // Le modèle saisi par le gérant prime sur le catalogue, comme le numéro
    // de série : il connaît la machine qu'il remet.
    vehiculeMarqueModele: r.modeleContrat ?? `${r.produit.marque} / ${r.produit.modele}`,
    // Ce que le gérant a saisi prime sur la fiche du véhicule : il connaît la
    // machine qu'il remet. À défaut de l'un et de l'autre, l'acte porte
    // « Néant », comme les contrats papier existants.
    vehiculeNumeroSerie:
      r.numeroSerieContrat ?? r.vehicule?.numeroChassis ?? "Néant",
    vehiculeImmatriculation:
      r.immatriculationContrat ?? r.vehicule?.immatriculation ?? "Néant",
    vehiculeCmc: r.vehicule?.cmc ?? "Néant",
    vehiculeValeurReference: fcfa(valeurReference),

    dureeMois,
    dateDebut: dateCourte(dateDebut),
    dateFin: dateFin ? dateCourte(dateFin) : "Néant",
    redevanceJournaliere: r.redevanceJournaliere ? fcfa(r.redevanceJournaliere) : "Néant",

    avecEngagement: r.engagementMois !== null,
    tarifSansEngagement: r.differentielSiRupture
      ? fcfa((r.redevanceJournaliere ?? 0) + r.differentielSiRupture)
      : "Néant",
    differentielJournalier: r.differentielSiRupture ? fcfa(r.differentielSiRupture) : "Néant",

    modesPaiement: r.modesPaiementContrat,

    // Location journalière : une date sans heure ne dirait pas quand la moto
    // doit être rendue, or tout l'article 12 repose là-dessus.
    departLe: avecHeure(dateCourte(dateDebut), r.heureDepart),
    retourLe: dateFin ? avecHeure(dateCourte(dateFin), r.heureRetour) : "Néant",
    dureeLocation: r.nbJours ? quantite(r.nbJours, "jour") : "Néant",
    tarifLocation: fcfa(r.montantTotal),
    montantCaution: r.montantCaution > 0 ? fcfa(r.montantCaution) : "Néant",
    limiteKm: r.limiteKm !== null ? `${nombre(r.limiteKm)} km` : "Néant",
    forfaitKmSupplementaires:
      r.forfaitKmSupp !== null ? `${fcfa(r.forfaitKmSupp)} par km` : "Néant",
    zoneUtilisation: r.zoneUtilisation ?? "Néant",
    etatGeneral: r.etatGeneralDepart ?? "Néant",

    // Le prix de l'article 3 EST le total de la réservation : c'est lui que le
    // gérant corrige quand le tarif a changé, et lui dont l'échéancier tire
    // les 60 % puis les quatre fois 10 %.
    prixTotal: fcfa(r.montantTotal),
    etatVenteVehicule: r.etatVenteContrat === "OCCASION" ? "D'occasion" : "Neuf",
    echeances:
      r.formule === "VENTE_ECHELONNEE"
        ? echeancierVenteEchelonnee(r.montantTotal).map((e) => ({
            libelle: e.libelle,
            montant: fcfa(e.montant),
            delaiJours: e.jourDepuisSignature,
          }))
        : [],

    // « Fait à » : la ville de la boutique de retrait.
    lieuSignature: r.boutique.store.city ?? r.boutique.store.name,
    // « Fait à …, le … » : la date fixée par le gérant, et non celle où l'acte
    // a été composé — les deux diffèrent dès qu'un contrat est préparé la veille.
    dateSignature: dateCourte(r.dateSignatureContrat ?? new Date()),

    montantTotalIndicatif: fcfa(
      joursFactures && r.redevanceJournaliere
        ? joursFactures * r.redevanceJournaliere
        : r.montantTotal,
    ),
    joursFacturesIndicatif: joursFactures ?? null,
  };
}

/** « 04/07/2026 à 08h30 », ou la date seule si l'heure n'a pas été saisie. */
function avecHeure(date: string, heure: string | null): string {
  return heure ? `${date} à ${heure}` : date;
}

/** Total en toutes lettres pour les échéanciers affichés au client. */
export const formaterNombre = nombre;
