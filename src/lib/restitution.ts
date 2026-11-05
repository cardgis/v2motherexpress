/**
 * Restitution du véhicule — clôture d'un contrat.
 *
 * ── Quand ce constat existe ────────────────────────────────────────────────
 * Au retour d'une location journalière, et à la rupture anticipée d'une
 * location-accession. Une accession menée à son terme n'en produit PAS : elle
 * transfère la propriété, la moto reste au client. Une vente échelonnée non
 * plus, pour la même raison.
 *
 * ── Ce que le document engage ──────────────────────────────────────────────
 * Le constat ne crée aucune obligation nouvelle : les réparations sont dues
 * dans les conditions prévues au contrat, dont les articles restent seuls
 * applicables. Une seule somme se calcule ici, parce que l'acte en donne
 * lui-même la formule — le différentiel de rupture de la formule avec
 * engagement, 500 F par jour facturé depuis le début du contrat jusqu'à la
 * restitution effective (article 5 de l'accession).
 *
 * ── Les signatures ─────────────────────────────────────────────────────────
 * Recueillies SUR PLACE, contrairement au constat de remise. Au retour on
 * oppose au client des dégâts et des sommes : son accord doit être donné
 * devant la moto, pas emprunté à un acte signé des mois plus tôt.
 */

import { prisma } from "@/lib/prisma";
import { ecrireBlob, lireBlob, sha256 } from "@/lib/storage";
import { dateCourte, fcfa } from "@/lib/formatters";
import { joursFacturesEntre } from "@/lib/tarification";
import { calculerSolde } from "@/lib/versements";
import {
  composerConstatRestitution,
  VERSION_CONSTAT_RESTITUTION,
} from "@/lib/contrats/pv-restitution";
import { libelleAngle } from "@/lib/retrait";
import type { SnapshotContrat } from "@/lib/contrats/snapshot";
import type { Utilisateur } from "@/lib/auth";
import type {
  AngleHandover,
  EtatAccessoires,
  EtatRestitution,
  Formule,
  MotifRestitution,
} from "@/generated/prisma";

/** Sans photos, le constat ne vaut rien en cas de litige sur les dégâts. */
const PHOTOS_MINIMUM = 4;

/** Formules dont le véhicule revient en boutique. */
const FORMULES_RESTITUABLES: Formule[] = ["LOCATION_JOURNALIERE", "LOCATION_ACCESSION"];

/**
 * Motifs qui rendent le différentiel exigible.
 *
 * L'acte le dit : « en cas de rupture du contrat avant son terme pour une cause
 * imputable au Locataire ». Une fin normale ne le déclenche donc pas, et
 * « Autre » non plus — la cause peut ne pas être imputable au client, un vice
 * du véhicule par exemple. Le gérant qui veut le réclamer coche le motif qui
 * l'établit.
 */
const MOTIFS_IMPUTABLES: MotifRestitution[] = ["RUPTURE_ANTICIPEE", "DEFAUT_DE_PAIEMENT"];

export class ErreurRestitution extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurRestitution";
  }
}

/** Restreint la recherche à la boutique du gérant. */
function perimetre(gerant: Utilisateur) {
  return gerant.role === "ADMIN" ? {} : { boutiqueId: gerant.boutiqueId ?? "__aucune__" };
}

// ---------------------------------------------------------------------------
// Sommes arrêtées au retour
// ---------------------------------------------------------------------------

interface ComptesDeSortie {
  redevancesImpayees: number | null;
  differentielRupture: number | null;
  differentielJours: number | null;
}

/**
 * Ce que le dossier doit au jour de la restitution.
 *
 * `coutReparations` n'est pas ici : il n'est pas calculable, l'acte le renvoie
 * à ses propres articles. C'est le gérant qui le saisit, s'il y en a un.
 */
function comptesDeSortie(
  r: {
    formule: Formule;
    montantTotal: number;
    redevanceJournaliere: number | null;
    suiviDepuis: Date | null;
    differentielSiRupture: number | null;
    dateDebut: Date | null;
    createdAt: Date;
    contract: { events: { createdAt: Date }[] } | null;
    echeances: { montantDu: number; echeanceLe: Date }[];
    encaissements: { montant: number; annuleLe: Date | null }[];
  },
  motif: MotifRestitution,
  maintenant: Date,
  departEffectif: Date | null,
): ComptesDeSortie {
  const solde = calculerSolde({
    formule: r.formule,
    montantTotal: r.montantTotal,
    redevanceJournaliere: r.redevanceJournaliere,
    scelleLe: r.contract?.events[0]?.createdAt ?? null,
    suiviDepuis: r.suiviDepuis,
    echeances: r.echeances,
    encaissements: r.encaissements,
  });

  // Le différentiel n'existe que sur la formule à engagement, et seulement si
  // la rupture est imputable au client.
  const differentielApplicable =
    r.formule === "LOCATION_ACCESSION" &&
    (r.differentielSiRupture ?? 0) > 0 &&
    MOTIFS_IMPUTABLES.includes(motif);

  const depart = departEffectif ?? r.dateDebut ?? r.createdAt;
  const jours = differentielApplicable ? joursFacturesEntre(depart, maintenant) : null;

  return {
    redevancesImpayees: solde.retard > 0 ? solde.retard : null,
    differentielJours: jours,
    differentielRupture:
      jours !== null ? (r.differentielSiRupture ?? 0) * Math.max(0, jours) : null,
  };
}

// ---------------------------------------------------------------------------
// Chargement de l'écran de restitution
// ---------------------------------------------------------------------------

export async function chargerRestitution(gerant: Utilisateur, reservationId: string) {
  const r = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(gerant) },
    include: {
      customer: { include: { user: { select: { telephone: true } } } },
      produit: { select: { nom: true, marque: true, modele: true } },
      vehicule: { select: { id: true, numeroChassis: true, immatriculation: true } },
      contract: {
        select: {
          id: true,
          reference: true,
          statut: true,
          events: {
            where: { type: "SCELLE" },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
      // Le relevé de la remise sert à lire la distance parcourue.
      handover: { select: { compteurKm: true, completedAt: true } },
      restitution: { include: { photos: { select: { id: true, angle: true } } } },
      echeances: { select: { numero: true, montantDu: true, echeanceLe: true } },
      encaissements: { select: { montant: true, annuleLe: true } },
      boutique: { select: { code: true, store: { select: { name: true } } } },
    },
  });

  if (!r) return null;

  // Aperçu affiché au gérant AVANT signature : c'est ce qu'il annonce au
  // client. Le motif n'étant pas encore choisi, on montre le différentiel tel
  // qu'il serait en cas de rupture imputable — le plus élevé des cas.
  const comptes = comptesDeSortie(
    { ...r, createdAt: r.createdAt },
    "RUPTURE_ANTICIPEE",
    new Date(),
    r.handover?.completedAt ?? null,
  );

  return {
    id: r.id,
    reference: r.reference,
    statut: r.statut,
    formule: r.formule,
    dureeMois: r.dureeMois,
    boutique: r.boutique.store.name,
    /** Le différentiel n'a de sens que sur la formule à engagement. */
    avecEngagement: (r.differentielSiRupture ?? 0) > 0,
    differentielJournalier: r.differentielSiRupture,
    restituable: FORMULES_RESTITUABLES.includes(r.formule),

    client: {
      nomComplet:
        r.customer.nom && r.customer.prenom
          ? `${r.customer.nom.toUpperCase()} ${r.customer.prenom}`
          : "Dossier sans nom",
      numeroPiece: r.customer.numeroPiece,
      telephone: r.customer.user.telephone ?? r.customer.telephoneContact,
    },

    produit: r.produit.nom,
    vehicule: r.vehicule,
    contrat: r.contract ? { id: r.contract.id, reference: r.contract.reference } : null,
    compteurKmRemise: r.handover?.compteurKm ?? null,
    restitution: r.restitution,
    comptes,
  };
}

export type DetailRestitution = NonNullable<Awaited<ReturnType<typeof chargerRestitution>>>;

// ---------------------------------------------------------------------------
// Photos de l'état des lieux de sortie
// ---------------------------------------------------------------------------

/**
 * Ajoute une photo, en ouvrant le dossier de restitution au premier envoi.
 *
 * Aucune étape préalable ne le crée — il n'y a pas de pièce à vérifier au
 * retour : la première photo ouvre le dossier.
 */
export async function ajouterPhotoRestitution(params: {
  gerant: Utilisateur;
  reservationId: string;
  angle: AngleHandover;
  octets: Uint8Array;
  mimeType: string;
}) {
  const { gerant, reservationId, angle, octets, mimeType } = params;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(gerant) },
    select: {
      id: true,
      reference: true,
      statut: true,
      formule: true,
      restitution: { select: { id: true, statut: true } },
    },
  });

  if (!reservation) throw new ErreurRestitution("Réservation introuvable.");
  if (!FORMULES_RESTITUABLES.includes(reservation.formule)) {
    throw new ErreurRestitution(
      "Cette formule ne donne pas lieu à restitution : le véhicule reste au client.",
    );
  }
  if (reservation.statut !== "ACTIVE") {
    throw new ErreurRestitution(
      `Restitution impossible : la réservation est en statut ${reservation.statut}.`,
    );
  }
  if (reservation.restitution?.statut === "COMPLETE") {
    throw new ErreurRestitution("Le constat est déjà établi — il ne peut plus être modifié.");
  }

  const dossier =
    reservation.restitution ??
    (await prisma.restitution.create({
      data: {
        reservationId,
        gerantUserId: gerant.id,
        gerantNom: gerant.nomAffichage ?? "Gérant",
      },
      select: { id: true, statut: true },
    }));

  const chemin = `restitutions/${reservation.reference}/${angle.toLowerCase()}-${Date.now()}.jpg`;
  const { sha256: empreinte } = await ecrireBlob(chemin, octets, mimeType);

  // Un angle ne peut être photographié qu'une fois : reprendre une photo
  // remplace la précédente plutôt que d'empiler des doublons.
  const existante = await prisma.restitutionPhoto.findFirst({
    where: { restitutionId: dossier.id, angle },
    select: { id: true },
  });

  if (existante) {
    await prisma.restitutionPhoto.update({
      where: { id: existante.id },
      data: { blobPath: chemin, sha256: empreinte, prisAt: new Date() },
    });
  } else {
    await prisma.restitutionPhoto.create({
      data: { restitutionId: dossier.id, angle, blobPath: chemin, sha256: empreinte },
    });
  }

  return { angle, chemin };
}

// ---------------------------------------------------------------------------
// Constat de restitution et clôture du contrat
// ---------------------------------------------------------------------------

export interface SaisieRestitution {
  motif: MotifRestitution;
  motifPrecision?: string;
  heureRestitution: string;
  compteurKm: number | null;
  niveauBatterie: number | null;
  carrosserie: EtatRestitution;
  freinsPneus: EtatRestitution;
  batterieChargeur: EtatRestitution;
  accessoires: EtatAccessoires;
  accessoiresPrecision?: string;
  dommagesConstates: boolean;
  dommagesPrecision?: string;
  /** Saisi par le gérant : l'acte ne fixe aucun barème. */
  coutReparations: number | null;
  observations?: string;
}

export async function enregistrerRestitution(params: {
  gerant: Utilisateur;
  reservationId: string;
  saisie: SaisieRestitution;
  /** Tracés recueillis sur place, déjà décodés en PNG par la route. */
  traces: { gerant: Uint8Array; client: Uint8Array };
  ip: string;
}) {
  const { gerant, reservationId, saisie, traces, ip } = params;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, ...perimetre(gerant) },
    include: {
      customer: { include: { user: { select: { telephone: true } } } },
      produit: { select: { marque: true, modele: true } },
      vehicule: { select: { id: true, numeroChassis: true } },
      contract: {
        select: {
          id: true,
          reference: true,
          donnees: true,
          events: {
            where: { type: "SCELLE" },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
          signatures: { select: { role: true, signedAt: true } },
        },
      },
      handover: { select: { compteurKm: true, completedAt: true } },
      restitution: { include: { photos: true } },
      echeances: { select: { numero: true, montantDu: true, echeanceLe: true } },
      encaissements: { select: { montant: true, annuleLe: true } },
    },
  });

  if (!reservation) throw new ErreurRestitution("Réservation introuvable.");

  if (!FORMULES_RESTITUABLES.includes(reservation.formule)) {
    throw new ErreurRestitution(
      "Cette formule ne donne pas lieu à restitution : le véhicule reste au client.",
    );
  }
  if (reservation.statut !== "ACTIVE") {
    throw new ErreurRestitution(
      `Restitution impossible : la réservation est en statut ${reservation.statut}.`,
    );
  }

  const dossier = reservation.restitution;
  if (!dossier) {
    throw new ErreurRestitution(
      "Prenez d'abord les photos du véhicule : elles ouvrent le constat.",
    );
  }
  if (dossier.statut === "COMPLETE") {
    throw new ErreurRestitution("Cette restitution a déjà été enregistrée.");
  }
  if (dossier.photos.length < PHOTOS_MINIMUM) {
    throw new ErreurRestitution(
      `Prenez au moins ${PHOTOS_MINIMUM} photos du véhicule — c'est ce qui établit son état au retour.`,
    );
  }

  // Une dégradation sans description ne prouve rien et ne se chiffre pas.
  if (saisie.dommagesConstates && !saisie.dommagesPrecision?.trim()) {
    throw new ErreurRestitution("Décrivez les dommages constatés : c'est ce qui les rend opposables.");
  }
  if (saisie.motif === "AUTRE" && !saisie.motifPrecision?.trim()) {
    throw new ErreurRestitution("Précisez le motif de la restitution.");
  }

  const maintenant = new Date();
  const comptes = comptesDeSortie(
    { ...reservation, createdAt: reservation.createdAt },
    saisie.motif,
    maintenant,
    reservation.handover?.completedAt ?? null,
  );

  const total =
    (comptes.redevancesImpayees ?? 0) +
    (comptes.differentielRupture ?? 0) +
    (saisie.coutReparations ?? 0);

  // Ce que le constat met à la charge du client devient un DÛ À ENCAISSER,
  // exigible à la date de l'arrêt : le différentiel l'est par l'article 5, les
  // réparations par les clauses d'entretien et de caution.
  //
  // Les redevances impayées n'en font PAS partie : le compteur de l'accession
  // les porte déjà, les ajouter ici les compterait deux fois.
  const numeroDepart = Math.max(0, ...reservation.echeances.map((e) => e.numero)) + 1;
  const lignesDues: {
    reservationId: string;
    numero: number;
    libelle: string;
    montantDu: number;
    echeanceLe: Date;
  }[] = [];

  if (comptes.differentielRupture) {
    lignesDues.push({
      reservationId,
      numero: numeroDepart,
      libelle: "Différentiel de rupture anticipée (article 5)",
      montantDu: comptes.differentielRupture,
      echeanceLe: maintenant,
    });
  }

  if (saisie.coutReparations) {
    lignesDues.push({
      reservationId,
      numero: numeroDepart + lignesDues.length,
      libelle: "Frais de remise en état",
      montantDu: saisie.coutReparations,
      echeanceLe: maintenant,
    });
  }

  // Les photos sont relues depuis le stockage pour être incrustées au constat.
  const photos = await Promise.all(
    dossier.photos
      .sort((a, b) => a.angle.localeCompare(b.angle))
      .map(async (p) => {
        const blob = await lireBlob(p.blobPath);
        return { octets: blob.octets, mimeType: blob.mimeType, legende: libelleAngle(p.angle) };
      }),
  );

  const snapshot = reservation.contract?.donnees as unknown as SnapshotContrat | undefined;
  const signatureContrat = reservation.contract?.signatures.find((s) => s.role === "CLIENT");

  // Le constat identifie le véhicule et le client EXACTEMENT comme le contrat
  // signé : un numéro de série différent d'un document à l'autre suffirait à
  // contester que la moto rendue est celle du contrat.
  const constat = await composerConstatRestitution({
    reference: reservation.reference,
    formule: reservation.formule,
    dureeMois: reservation.dureeMois,
    vehiculeMarqueModele:
      snapshot?.vehiculeMarqueModele ??
      `${reservation.produit.marque} / ${reservation.produit.modele}`,
    vehiculeNumeroSerie:
      snapshot?.vehiculeNumeroSerie ?? reservation.vehicule?.numeroChassis ?? "Néant",
    clientNomComplet:
      snapshot?.clientNomComplet ??
      `${reservation.customer.nom?.toUpperCase() ?? ""} ${reservation.customer.prenom ?? ""}`.trim(),
    clientNumeroPiece: snapshot?.clientNumeroPiece ?? reservation.customer.numeroPiece ?? "-",
    clientTelephone:
      snapshot?.clientTelephone ??
      reservation.customer.user.telephone ??
      reservation.customer.telephoneContact ??
      "Néant",

    bailleurSignataire: gerant.nomAffichage ?? dossier.gerantNom,
    contratReference: reservation.contract?.reference ?? null,
    contratSigneLe: signatureContrat ? dateCourte(signatureContrat.signedAt) : null,

    motif: saisie.motif,
    motifPrecision: saisie.motifPrecision?.trim() || null,

    dateRestitution: dateCourte(maintenant),
    heureRestitution: saisie.heureRestitution,
    compteurKm: saisie.compteurKm,
    compteurKmRemise: reservation.handover?.compteurKm ?? null,

    carrosserie: saisie.carrosserie,
    freinsPneus: saisie.freinsPneus,
    batterieChargeur: saisie.batterieChargeur,
    accessoires: saisie.accessoires,
    accessoiresPrecision: saisie.accessoiresPrecision?.trim() || null,

    dommagesConstates: saisie.dommagesConstates,
    dommagesPrecision: saisie.dommagesPrecision?.trim() || null,

    redevancesImpayees: comptes.redevancesImpayees ? fcfa(comptes.redevancesImpayees) : null,
    coutReparations: saisie.coutReparations ? fcfa(saisie.coutReparations) : null,
    differentielRupture: comptes.differentielRupture ? fcfa(comptes.differentielRupture) : null,
    differentielJours: comptes.differentielRupture ? comptes.differentielJours : null,
    totalDu: total > 0 ? fcfa(total) : null,

    observations: saisie.observations?.trim() || null,
    photos,
  });

  // Les deux tracés viennent d'être faits devant la moto : ils sont conservés
  // comme pièces à part entière, chacun sous son propre chemin.
  const cheminSigGerant = `restitutions/${reservation.reference}/signature-gerant-${Date.now()}.png`;
  const cheminSigClient = `restitutions/${reservation.reference}/signature-client-${Date.now()}.png`;

  await Promise.all([
    ecrireBlob(cheminSigGerant, traces.gerant, "image/png"),
    ecrireBlob(cheminSigClient, traces.client, "image/png"),
  ]);

  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(constat.octets);

  for (const [octets, cible] of [
    [traces.gerant, constat.emplacements.bailleur],
    [traces.client, constat.emplacements.locataire],
  ] as const) {
    const page = pdf.getPages()[cible.page];
    if (!page) continue;

    const image = await pdf.embedPng(octets);
    const dims = image.scaleToFit(cible.largeur, cible.hauteur);
    page.drawImage(image, {
      x: cible.x + (cible.largeur - dims.width) / 2,
      y: cible.y,
      width: dims.width,
      height: dims.height,
    });
  }

  const octets = await pdf.save();
  const empreinte = sha256(octets);
  const cheminPv = `restitutions/${reservation.reference}/constat-restitution-${empreinte.slice(0, 12)}.pdf`;
  await ecrireBlob(cheminPv, octets, "application/pdf");

  // Une moto rendue avec des dégâts ne repart pas en location : elle passe à
  // l'atelier. Sans dégât, elle est immédiatement disponible.
  const statutVehicule = saisie.dommagesConstates ? "MAINTENANCE" : "DISPONIBLE";

  await prisma.$transaction([
    prisma.restitution.update({
      where: { id: dossier.id },
      data: {
        motif: saisie.motif,
        motifPrecision: saisie.motifPrecision?.trim() || null,
        dateRestitution: maintenant,
        heureRestitution: saisie.heureRestitution,
        compteurKm: saisie.compteurKm,
        niveauBatterie: saisie.niveauBatterie,
        carrosserie: saisie.carrosserie,
        freinsPneus: saisie.freinsPneus,
        batterieChargeur: saisie.batterieChargeur,
        accessoires: saisie.accessoires,
        accessoiresPrecision: saisie.accessoiresPrecision?.trim() || null,
        dommagesConstates: saisie.dommagesConstates,
        dommagesPrecision: saisie.dommagesPrecision?.trim() || null,
        redevancesImpayees: comptes.redevancesImpayees,
        coutReparations: saisie.coutReparations,
        differentielRupture: comptes.differentielRupture,
        differentielJours: comptes.differentielJours,
        observations: saisie.observations?.trim() || null,
        pvPdfPath: cheminPv,
        pvHashSigned: empreinte,
        signatureGerantPath: cheminSigGerant,
        signatureClientPath: cheminSigClient,
        statut: "COMPLETE",
        completedAt: maintenant,
      },
    }),

    ...(lignesDues.length > 0 ? [prisma.echeance.createMany({ data: lignesDues })] : []),

    // Le contrat est ARRÊTÉ — et non « Terminé », qui dit d'un contrat qu'il
    // s'est bien fini. Le dossier reste visible dans le suivi des versements :
    // c'est là qu'on voit ce qu'il reste à recouvrer.
    prisma.reservation.update({
      where: { id: reservationId },
      data: { statut: "ARRETEE" },
    }),

    ...(reservation.vehiculeId
      ? [
          prisma.vehicule.update({
            where: { id: reservation.vehiculeId },
            data: { statut: statutVehicule },
          }),
        ]
      : []),

    ...(reservation.contract
      ? [
          prisma.contractEvent.create({
            data: {
              contractId: reservation.contract.id,
              type: "RESTITUE",
              acteurUserId: gerant.id,
              ip,
              metadata: {
                empreintePv: empreinte,
                // Rédaction du constat effectivement signée par les deux parties.
                versionConstat: VERSION_CONSTAT_RESTITUTION,
                motif: saisie.motif,
                photos: dossier.photos.length,
                compteurKm: saisie.compteurKm,
                dommages: saisie.dommagesConstates,
                redevancesImpayees: comptes.redevancesImpayees,
                differentielRupture: comptes.differentielRupture,
                differentielJours: comptes.differentielJours,
                coutReparations: saisie.coutReparations,
                totalDu: total > 0 ? total : null,
                vehicule: statutVehicule,
              },
            },
          }),
        ]
      : []),
  ]);

  return { cheminPv, empreinte, pages: constat.pages, totalDu: total };
}
