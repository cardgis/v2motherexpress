/**
 * Libellé et couleur de chaque statut, selon qui le lit.
 *
 * Un même état ne se dit pas pareil au client et au gérant : un contrat
 * `A_SIGNER_CLIENT` est « À signer » pour le client (c'est à lui d'agir, ton
 * ambre) et « Chez le client » pour le gérant (il attend, ton bleu). Centraliser
 * ces correspondances garantit qu'un statut a la même couleur sur tous les
 * écrans — c'est le code couleur des espaces (voir `src/styles/espace.css`).
 *
 * Importable côté client : types Prisma uniquement, aucun accès à la base.
 */

import type {
  StatutContrat,
  StatutKyc,
  StatutReservation,
  StatutVehicule,
} from "@/generated/prisma";

export type Ton = "succes" | "info" | "attention" | "erreur" | "neutre";
export type Lecteur = "client" | "gerant";

export interface Presentation {
  libelle: string;
  ton: Ton;
}

type Table<S extends string> = Record<S, Record<Lecteur, Presentation>>;

const pareil = (libelle: string, ton: Ton) => ({ client: { libelle, ton }, gerant: { libelle, ton } });

const KYC: Table<StatutKyc> = {
  INCOMPLET: {
    client: { libelle: "À compléter", ton: "attention" },
    gerant: { libelle: "Incomplet", ton: "neutre" },
  },
  A_VERIFIER: {
    client: { libelle: "En vérification", ton: "info" },
    gerant: { libelle: "À vérifier", ton: "attention" },
  },
  VALIDE: pareil("Validé", "succes"),
  REJETE: {
    client: { libelle: "À corriger", ton: "erreur" },
    gerant: { libelle: "Renvoyé au client", ton: "erreur" },
  },
};

const RESERVATION: Table<StatutReservation> = {
  BROUILLON: pareil("Brouillon", "neutre"),
  EN_ATTENTE_DOSSIER: {
    client: { libelle: "Dossier à compléter", ton: "attention" },
    gerant: { libelle: "Dossier incomplet", ton: "neutre" },
  },
  EN_ATTENTE_VALIDATION: {
    client: { libelle: "Dossier en vérification", ton: "info" },
    gerant: { libelle: "Dossier à vérifier", ton: "attention" },
  },
  EN_ATTENTE_SIGNATURE: {
    client: { libelle: "Contrat en préparation", ton: "info" },
    gerant: { libelle: "Contrat à établir", ton: "attention" },
  },
  EN_ATTENTE_RETRAIT: {
    client: { libelle: "Prêt au retrait", ton: "succes" },
    gerant: { libelle: "Retrait à faire", ton: "attention" },
  },
  ACTIVE: pareil("En cours", "succes"),
  TERMINEE: pareil("Terminée", "neutre"),
  ARRETEE: pareil("Contrat arrêté", "neutre"),
  ANNULEE: pareil("Annulée", "neutre"),
  CADUQUE: pareil("Caduque", "erreur"),
};

/**
 * Contrats VIVANTS : ceux dont la valeur est encore en jeu.
 *
 * Servent aux totaux d'argent ENGAGÉ. Un dossier caduc n'a jamais rien produit ;
 * un terminé ou un arrêté ne produira plus rien. Les additionner gonflerait un
 * total que personne n'encaissera.
 *
 * Attention : ce n'est PAS la bonne liste pour mesurer l'ACTIVITÉ. Une location
 * journalière rendue normalement passe en ARRETEE — c'est son état de succès.
 * Les chiffres de `statistiques.ts` la comptent donc, et c'est voulu.
 */
export const STATUTS_VIVANTS: readonly StatutReservation[] = [
  "EN_ATTENTE_DOSSIER",
  "EN_ATTENTE_VALIDATION",
  "EN_ATTENTE_SIGNATURE",
  "EN_ATTENTE_RETRAIT",
  "ACTIVE",
];

const CONTRAT: Table<StatutContrat> = {
  BROUILLON: {
    client: { libelle: "En préparation", ton: "info" },
    gerant: { libelle: "Brouillon — à relire", ton: "attention" },
  },
  A_SIGNER_CLIENT: {
    client: { libelle: "À signer", ton: "attention" },
    gerant: { libelle: "Chez le client", ton: "info" },
  },
  A_SIGNER_GERANT: {
    client: { libelle: "Signé, en attente de la boutique", ton: "info" },
    gerant: { libelle: "À contresigner", ton: "attention" },
  },
  SIGNE: pareil("Signé", "succes"),
  EN_ATTENTE_RETRAIT: pareil("Signé — à retirer", "succes"),
  RETIRE: pareil("Véhicule remis", "succes"),
  CADUC: pareil("Caduc", "erreur"),
  ANNULE: pareil("Annulé", "neutre"),
};

const VEHICULE: Table<StatutVehicule> = {
  DISPONIBLE: pareil("Disponible", "succes"),
  RESERVE: pareil("Réservée", "attention"),
  EN_LOCATION: pareil("En location", "info"),
  MAINTENANCE: pareil("En atelier", "neutre"),
  VENDU: pareil("Vendue", "neutre"),
  HORS_SERVICE: pareil("Hors service", "erreur"),
};

const TABLES = { kyc: KYC, reservation: RESERVATION, contrat: CONTRAT, vehicule: VEHICULE } as const;

export type TypeStatut = keyof typeof TABLES;

const INCONNU: Presentation = { libelle: "—", ton: "neutre" };

export function presentationStatut(type: TypeStatut, statut: string, lecteur: Lecteur): Presentation {
  const table = TABLES[type] as Record<string, Record<Lecteur, Presentation>>;
  return table[statut]?.[lecteur] ?? { ...INCONNU, libelle: statut.replace(/_/g, " ").toLowerCase() };
}
