/**
 * Génération des actes — point d'entrée unique.
 *
 * Enchaîne : snapshot figé → composition du PDF → dépôt en stockage privé →
 * empreinte SHA-256 → création du `Contract` → journalisation.
 *
 * ── Deux règles absolues ───────────────────────────────────────────────────
 * 1. Un acte déjà signé n'est JAMAIS régénéré. Toute correction passe par un
 *    avenant ou par une annulation suivie d'un nouveau contrat.
 * 2. Le snapshot ne se recalcule pas. `Contract.donnees` est la vérité de ce
 *    qui a été présenté à la signature, quoi qu'il advienne des données
 *    vivantes ensuite.
 */

import { prisma } from "@/lib/prisma";
import { ecrireBlob, sha256, supprimerBlob } from "@/lib/storage";
import { ajouterMois } from "@/lib/formatters";
import { construireSnapshot, ErreurSnapshot, type SnapshotContrat } from "./snapshot";
import { composerContratAccession, type ActeCompose } from "./accession";
import { composerContratVente } from "./vente";
import { composerContratJournaliere } from "./journaliere";
import { normaliserModes } from "@/lib/modes-paiement";
import type { Formule, ModePaiement } from "@/generated/prisma";

export { construireSnapshot, ErreurSnapshot };
export type { SnapshotContrat, ActeCompose };

/**
 * Version du texte des modèles, portée par `ContractTemplate`.
 *
 * À INCRÉMENTER à chaque modification du texte d'un acte. C'est ce qui permet
 * de savoir, des mois plus tard, quelle rédaction exacte un client a signée.
 *
 * UN NUMÉRO NE SE RÉUTILISE JAMAIS, même pour revenir en arrière. La 2 portait
 * le cadre de témoin, retiré le 2026-11-12 ; le texte redevient donc celui de
 * la 1, mais sous le numéro 3. Remettre 1 aurait fait désigner par un même
 * numéro deux rédactions différentes, et laissé en base un contrat pointant
 * vers une version absente du code — exactement ce que cette constante existe
 * pour empêcher.
 */
export const VERSION_MODELES = 3;

const LIBELLES_MODELE: Record<Formule, string> = {
  LOCATION_JOURNALIERE: "Contrat de location journalière",
  LOCATION_ACCESSION: "Contrat de location-accession",
  VENTE_ECHELONNEE: "Contrat de vente avec paiement échelonné",
};

export class ErreurGeneration extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGeneration";
  }
}

/** Statuts au-delà desquels l'acte est figé. */
const STATUTS_FIGES = ["A_SIGNER_GERANT", "SIGNE", "EN_ATTENTE_RETRAIT", "RETIRE"] as const;

async function composer(snapshot: SnapshotContrat): Promise<ActeCompose> {
  switch (snapshot.formule) {
    case "LOCATION_ACCESSION":
      return composerContratAccession(snapshot);

    case "VENTE_ECHELONNEE":
      return composerContratVente(snapshot);

    case "LOCATION_JOURNALIERE":
      return composerContratJournaliere(snapshot);
  }
}

/**
 * Produit le brouillon de l'acte, POUR LE GÉRANT SEUL.
 *
 * Le contrat naît en `BROUILLON` : il n'apparaît pas encore dans l'espace du
 * client. Le gérant le relit, corrige au besoin la date de prise d'effet ou
 * l'attribution du véhicule, régénère autant de fois qu'il le faut, puis le
 * transmet explicitement. Sans cette étape, le client verrait passer des
 * versions successives d'un document qui l'engage.
 *
 * Idempotent tant que le client n'a pas signé : régénérer remplace le
 * brouillon ET ramène le contrat en `BROUILLON`, car une nouvelle version
 * doit être retransmise.
 */
/**
 * Ce que le gérant peut fixer lui-même sur l'acte.
 *
 * Ces valeurs sont écrites sur la réservation AVANT la construction du
 * snapshot, afin que les articles 2, 3 et 4 les reprennent.
 *
 * Le principe « aucun montant ne vient du navigateur » vise le CLIENT, dont
 * on ne négocie pas les prix. Le gérant, lui, est authentifié, cloisonné à sa
 * boutique, et c'est son métier de convenir d'une redevance : sa saisie est
 * légitime, et journalisée avec le contrat.
 */
export interface ValeursGerant {
  acteurUserId?: string;
  /**
   * Date de prise d'effet. En location journalière les dates viennent du
   * client et ne sont pas écrasées.
   */
  dateDebut?: Date;
  /**
   * Date portée par « Fait à …, le … ». Absente, l'acte prend la date du jour —
   * ce qui n'est juste que si on le signe le jour où on le génère.
   */
  dateSignature?: Date | null;
  /**
   * « Marque / Modèle » porté à l'article 2, s'il diffère du modèle réservé.
   * Valeur d'impression : ne modifie ni le tarif ni la moto attribuée.
   */
  modele?: string | null;
  /** Numéro de série porté à l'article 2, s'il diffère de la fiche véhicule. */
  numeroSerie?: string | null;
  immatriculation?: string | null;
  /** Redevance journalière de l'article 4, en francs CFA entiers. */
  redevanceJournaliere?: number | null;
  /** Cases à cocher de l'article « Modalités de paiement ». */
  modesPaiement?: ModePaiement[];

  /**
   * Vente échelonnée seulement.
   *
   * `prixVente` est le prix de l'article 3, à corriger quand le tarif a baissé
   * ou changé depuis la réservation. Il commande aussi l'échéancier, qui en
   * tire les 60 % et les quatre fois 10 % au scellement.
   * `etatVente` coche l'article 9 et renseigne l'article 2.
   */
  prixVente?: number | null;
  etatVente?: "NEUF" | "OCCASION" | null;

  /**
   * Location journalière seulement. L'acte en demande dix de plus que les
   * autres : elles se conviennent au comptoir, rien ne les déduit du catalogue.
   */
  heureDepart?: string | null;
  heureRetour?: string | null;
  caution?: number | null;
  limiteKm?: number | null;
  forfaitKmSupp?: number | null;
  zoneUtilisation?: string | null;
  etatGeneral?: string | null;
}

export async function genererBrouillon(
  reservationId: string,
  valeurs: ValeursGerant = {},
) {
  const { acteurUserId } = valeurs;
  const existant = await prisma.contract.findUnique({
    where: { reservationId },
    select: { id: true, statut: true, reference: true, pdfDraftPath: true },
  });

  if (existant && (STATUTS_FIGES as readonly string[]).includes(existant.statut)) {
    throw new ErreurGeneration(
      `Le contrat ${existant.reference} est déjà engagé (${existant.statut}). ` +
        "Un acte signé ne se régénère pas : passez par un avenant ou une annulation.",
    );
  }

  await appliquerValeursGerant(reservationId, valeurs);

  const snapshot = await construireSnapshot(reservationId);
  const acte = await composer(snapshot);

  const empreinte = sha256(acte.octets);
  const chemin = `contrats/${snapshot.reference}/brouillon-${empreinte.slice(0, 12)}.pdf`;
  await ecrireBlob(chemin, acte.octets, "application/pdf");

  // Le modèle est enregistré pour que l'on puisse retrouver, plus tard, la
  // rédaction exacte qui a été soumise à la signature.
  const template = await prisma.contractTemplate.upsert({
    where: { code_version: { code: snapshot.formule, version: VERSION_MODELES } },
    create: {
      code: snapshot.formule,
      version: VERSION_MODELES,
      libelle: LIBELLES_MODELE[snapshot.formule],
      // Le texte vit dans le code, pas dans un fichier : le chemin reste vide.
      blobPath: "",
      champs: {},
    },
    update: {},
  });

  const contract = await prisma.contract.upsert({
    where: { reservationId },
    create: {
      reference: snapshot.reference,
      reservationId,
      templateId: template.id,
      donnees: snapshot as unknown as object,
      emplacementsSignature: acte.emplacements as unknown as object,
      pdfDraftPath: chemin,
      hashDraft: empreinte,
      statut: "BROUILLON",
    },
    update: {
      templateId: template.id,
      donnees: snapshot as unknown as object,
      emplacementsSignature: acte.emplacements as unknown as object,
      pdfDraftPath: chemin,
      hashDraft: empreinte,
      // Retour au brouillon : une nouvelle version doit être relue puis
      // retransmise, elle ne se substitue pas en silence à celle que le
      // client avait sous les yeux.
      statut: "BROUILLON",
      // Une régénération invalide un éventuel lien de signature déjà envoyé :
      // il pointerait vers un document qui n'est plus celui qui sera signé.
      signTokenHash: null,
      signTokenExp: null,
    },
  });

  // Sort du brouillon remplacé :
  //   — jamais transmis (`BROUILLON`) : travail interne du gérant, que
  //     personne d'autre n'a vu. Le garder n'apporte rien et fait grossir le
  //     stockage à chaque correction : il est supprimé ;
  //   — déjà transmis (`A_SIGNER_CLIENT`) : le client a pu l'ouvrir, et
  //     l'événement `OUVERT` renvoie à son empreinte. C'est une pièce du
  //     dossier de preuve : il est conservé.
  const ancien =
    existant?.pdfDraftPath && existant.pdfDraftPath !== chemin ? existant.pdfDraftPath : null;
  const ancienSupprime = ancien !== null && existant?.statut === "BROUILLON";

  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservationId },
      data: { statut: "EN_ATTENTE_SIGNATURE" },
    }),
    prisma.contractEvent.create({
      data: {
        contractId: contract.id,
        type: "GENERE",
        acteurUserId,
        metadata: {
          empreinte,
          modele: snapshot.formule,
          version: VERSION_MODELES,
          pages: acte.pages,
          ...(ancien && { brouillonRemplace: ancien, brouillonRemplaceConserve: !ancienSupprime }),
        },
      },
    }),
  ]);

  // Après la transaction seulement : si elle échoue, l'ancien brouillon est
  // encore celui que désigne la base et doit rester lisible. Un échec de
  // suppression laisse un fichier orphelin, jamais un contrat sans fichier.
  if (ancienSupprime) {
    await supprimerBlob(ancien).catch((erreur) =>
      console.error(`[contrats] brouillon remplacé non supprimé (${ancien}) :`, erreur),
    );
  }

  return { contract, empreinte, pages: acte.pages, chemin };
}

/**
 * Reporte sur la réservation ce que le gérant a saisi à la génération.
 *
 * Une valeur absente ne touche à rien ; une chaîne vide efface la saisie et
 * fait retomber l'acte sur la fiche du véhicule, puis sur « Néant ».
 */
async function appliquerValeursGerant(reservationId: string, valeurs: ValeursGerant) {
  const { dateDebut, modele, numeroSerie, immatriculation, redevanceJournaliere, modesPaiement } =
    valeurs;

  const rien = Object.entries(valeurs).every(
    ([cle, v]) => cle === "acteurUserId" || v === undefined,
  );
  if (rien) return;

  const r = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { formule: true, dureeMois: true, nbJours: true },
  });

  const donnees: Record<string, unknown> = {};

  if (dateDebut && r.formule !== "LOCATION_JOURNALIERE") {
    donnees.dateDebut = dateDebut;
    // La date de fin découle de la durée : la laisser saisir séparément
    // ouvrirait la porte à un acte dont l'article 3 se contredit.
    if (r.dureeMois) donnees.dateFin = ajouterMois(dateDebut, r.dureeMois);
  }

  if (valeurs.dateSignature !== undefined) donnees.dateSignatureContrat = valeurs.dateSignature;

  if (modele !== undefined) donnees.modeleContrat = vide(modele);
  if (numeroSerie !== undefined) donnees.numeroSerieContrat = vide(numeroSerie);
  if (immatriculation !== undefined) donnees.immatriculationContrat = vide(immatriculation);
  if (modesPaiement !== undefined) donnees.modesPaiementContrat = normaliserModes(modesPaiement);

  if (redevanceJournaliere !== undefined && r.formule !== "VENTE_ECHELONNEE") {
    const montant =
      redevanceJournaliere === null ? null : Math.round(redevanceJournaliere);

    if (montant !== null && (!Number.isFinite(montant) || montant <= 0)) {
      throw new ErreurGeneration("La redevance journalière doit être un montant positif.");
    }

    donnees.redevanceJournaliere = montant;

    // Le total suit la redevance : laisser les deux diverger produirait un
    // échéancier qui contredit l'article 4 de l'acte.
    if (montant !== null && r.nbJours) donnees.montantTotal = montant * r.nbJours;
  }

  // ── Vente échelonnée ─────────────────────────────────────────────────────
  //
  // Le prix vit dans `montantTotal`, pas dans un champ d'impression à part :
  // l'acte et l'échéancier doivent lire la MÊME valeur, sans quoi le contrat
  // annoncerait un prix que les échéances contrediraient. L'échéancier étant
  // figé au scellement, une correction faite ici — donc avant signature — s'y
  // répercute d'elle-même.
  if (r.formule === "VENTE_ECHELONNEE") {
    if (valeurs.prixVente !== undefined && valeurs.prixVente !== null) {
      const prix = Math.round(valeurs.prixVente);
      if (!Number.isFinite(prix) || prix <= 0) {
        throw new ErreurGeneration("Le prix de vente doit être un montant positif.");
      }
      donnees.montantTotal = prix;
    }

    // Null ramène à « Neuf » : les motos vendues sont neuves, et la colonne
    // n'accepte pas l'absence de valeur.
    if (valeurs.etatVente !== undefined) {
      donnees.etatVenteContrat = valeurs.etatVente ?? "NEUF";
    }
  }

  // ── Location journalière ─────────────────────────────────────────────────
  //
  // Ces valeurs ne concernent que cet acte : les écrire sur une accession ou
  // une vente n'aurait aucun effet à l'impression, mais laisserait des données
  // trompeuses dans le dossier.
  if (r.formule === "LOCATION_JOURNALIERE") {
    if (valeurs.heureDepart !== undefined) donnees.heureDepart = vide(valeurs.heureDepart);
    if (valeurs.heureRetour !== undefined) donnees.heureRetour = vide(valeurs.heureRetour);
    if (valeurs.zoneUtilisation !== undefined) donnees.zoneUtilisation = vide(valeurs.zoneUtilisation);
    if (valeurs.etatGeneral !== undefined) donnees.etatGeneralDepart = vide(valeurs.etatGeneral);

    if (valeurs.caution !== undefined) donnees.montantCaution = entierPositif(valeurs.caution, "La caution") ?? 0;
    if (valeurs.limiteKm !== undefined) donnees.limiteKm = entierPositif(valeurs.limiteKm, "La limite de kilométrage");
    if (valeurs.forfaitKmSupp !== undefined) {
      donnees.forfaitKmSupp = entierPositif(valeurs.forfaitKmSupp, "Le forfait kilométrique");
    }
  }

  if (Object.keys(donnees).length > 0) {
    await prisma.reservation.update({ where: { id: reservationId }, data: donnees });
  }
}

/** Montant ou distance : entier positif, ou rien. Jamais une valeur négative. */
function entierPositif(valeur: number | null, libelle: string): number | null {
  if (valeur === null) return null;
  const entier = Math.round(valeur);
  if (!Number.isFinite(entier) || entier < 0) {
    throw new ErreurGeneration(`${libelle} doit être un nombre positif.`);
  }
  return entier;
}

function vide(valeur: string | null): string | null {
  const texte = (valeur ?? "").trim();
  return texte === "" ? null : texte;
}

/**
 * Met le contrat à disposition du client.
 *
 * C'est le geste par lequel le gérant assume le document : à partir de là il
 * apparaît dans l'espace client, devient signable, et ne peut plus être
 * régénéré sans repasser par une relecture.
 */
export async function transmettreAuClient(contractId: string, acteurUserId?: string) {
  const contrat = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { id: true, statut: true, reference: true },
  });

  if (contrat.statut === "A_SIGNER_CLIENT") {
    return { statut: "A_SIGNER_CLIENT" as const, dejaTransmis: true };
  }

  if (contrat.statut !== "BROUILLON") {
    throw new ErreurGeneration(
      `Le contrat ${contrat.reference} est en statut ${contrat.statut} : il n'est plus à transmettre.`,
    );
  }

  await prisma.$transaction([
    prisma.contract.update({
      where: { id: contractId },
      data: { statut: "A_SIGNER_CLIENT" },
    }),
    prisma.contractEvent.create({
      data: { contractId, type: "TRANSMIS_CLIENT", acteurUserId },
    }),
  ]);

  return { statut: "A_SIGNER_CLIENT" as const, dejaTransmis: false };
}
