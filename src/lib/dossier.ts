/**
 * Dossier client (KYC) — validation et complétude.
 *
 * Les champs de `Customer` sont nullables en base pour permettre la
 * sauvegarde progressive sur une connexion instable. La garantie de
 * complétude est donc ENTIÈREMENT portée par ce module : c'est le seul
 * chemin par lequel un dossier peut passer en `A_VERIFIER`.
 *
 * Aucune donnée ne franchit cette barrière sans être validée côté serveur.
 * Le navigateur peut envoyer n'importe quoi ; rien ici ne lui fait confiance.
 *
 * Importé aussi par le formulaire client : ce module ne doit rien charger de
 * lourd ni de propre au serveur.
 */

import { z } from "zod";
import type { Customer, CustomerDocument, TypeDocument } from "@/generated/prisma";

/** Pièces exigées pour qu'un dossier soit présentable au gérant. */
export const DOCUMENTS_OBLIGATOIRES: TypeDocument[] = [
  "PIECE_RECTO",
  "PIECE_VERSO",
  "JUSTIFICATIF_DOMICILE",
];

export const LIBELLES_DOCUMENT: Record<TypeDocument, string> = {
  PIECE_RECTO: "Pièce d'identité — recto",
  PIECE_VERSO: "Pièce d'identité — verso",
  PERMIS_RECTO: "Permis de conduire — recto",
  PERMIS_VERSO: "Permis de conduire — verso",
  JUSTIFICATIF_DOMICILE: "Justificatif de domicile",
  SELFIE: "Photo du visage",
  AUTRE: "Autre document",
};

export const LIBELLES_PIECE = {
  CNI: "Carte nationale d'identité",
  PASSEPORT: "Passeport",
  CARTE_SEJOUR: "Carte de séjour",
  CARTE_CONSULAIRE: "Carte consulaire",
} as const;

// ---------------------------------------------------------------------------
// Validation de la saisie
// ---------------------------------------------------------------------------

const texte = (min: number, max: number, libelle: string) =>
  z
    .string()
    .trim()
    .min(min, `${libelle} : ${min} caractères minimum`)
    .max(max, `${libelle} : ${max} caractères maximum`);

/**
 * Numéro saisi librement, sénégalais ou étranger. Contrôle de forme seulement :
 * ces numéros ne servent jamais d'identifiant de connexion, ils sont imprimés
 * ou composés à la main par la boutique.
 */
const telephoneLibre = (libelle: string) =>
  z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ().-]{5,22}$/, `${libelle} : numéro invalide (ex. 77 123 45 67 ou +33 6 12 34 56 78)`);

/** Une date de naissance plausible : majeur, et pas née il y a 120 ans. */
const dateNaissance = z.coerce
  .date()
  .refine((d) => d <= majoriteLimite(), "Le locataire doit être majeur (18 ans)")
  .refine((d) => d >= new Date("1906-01-01"), "Date de naissance invalide");

function majoriteLimite(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

/**
 * Schéma de saisie du dossier. `.partial()` en est dérivé pour les
 * enregistrements intermédiaires : on valide ce qui est fourni sans exiger
 * que tout soit là.
 */
export const schemaDossier = z.object({
  prenom: texte(2, 60, "Prénom"),
  nom: texte(2, 60, "Nom"),
  dateNaissance,
  lieuNaissance: texte(2, 80, "Lieu de naissance"),
  nationalite: texte(2, 60, "Nationalité").default("Sénégalaise"),

  typePiece: z.enum(["CNI", "PASSEPORT", "CARTE_SEJOUR", "CARTE_CONSULAIRE"]),
  numeroPiece: texte(4, 40, "Numéro de pièce"),
  pieceDateExpiration: z.coerce
    .date()
    .refine((d) => d > new Date(), "La pièce d'identité est expirée")
    .optional()
    .nullable(),

  numeroPermis: texte(3, 40, "Numéro de permis").optional().nullable(),
  permisDateObtention: z.coerce.date().optional().nullable(),

  adresse: texte(4, 160, "Adresse"),
  quartier: texte(2, 80, "Quartier").optional().nullable(),
  ville: texte(2, 80, "Ville"),
  profession: texte(2, 80, "Profession").optional().nullable(),
  telephoneContact: telephoneLibre("Téléphone").optional().nullable(),
});

/** Enregistrement partiel — sauvegarde au fil de la saisie. */
export const schemaDossierPartiel = schemaDossier.partial();

/**
 * Champs que le gérant a confrontés à la pièce d'identité.
 *
 * Une fois le dossier parti en vérification, ils sont figés : les modifier
 * après coup romprait le lien entre ce qui a été vérifié et ce qui figure sur
 * le contrat. Toute correction passe alors par la boutique.
 */
export const CHAMPS_IDENTITE = [
  "prenom",
  "nom",
  "dateNaissance",
  "lieuNaissance",
  "nationalite",
  "typePiece",
  "numeroPiece",
  "pieceDateExpiration",
  "numeroPermis",
  "permisDateObtention",
] as const;

/**
 * Coordonnées : elles restent modifiables même après validation.
 *
 * Un client qui déménage doit pouvoir se mettre à jour sans appeler la
 * boutique. Cela ne touche à aucun contrat déjà signé : `Contract.donnees`
 * est un instantané figé, jamais recalculé.
 */
export const CHAMPS_COORDONNEES = [
  "adresse",
  "quartier",
  "ville",
  "profession",
  "telephoneContact",
] as const;

/** L'identité est figée dès que le dossier est soumis au gérant. */
export function identiteFigee(statutKyc: string | undefined | null): boolean {
  return statutKyc === "A_VERIFIER" || statutKyc === "VALIDE";
}

export type SaisieDossier = z.infer<typeof schemaDossier>;

// ---------------------------------------------------------------------------
// Complétude
// ---------------------------------------------------------------------------

type Exigence = readonly [keyof Customer, string];

/** Champs sans lesquels un contrat ne peut pas être rempli. */
const CHAMPS_REQUIS: readonly Exigence[] = [
  ["prenom", "Prénom"],
  ["nom", "Nom"],
  ["dateNaissance", "Date de naissance"],
  ["lieuNaissance", "Lieu de naissance"],
  ["typePiece", "Type de pièce d'identité"],
  ["numeroPiece", "Numéro de pièce d'identité"],
  ["adresse", "Adresse"],
  ["ville", "Ville"],
];

/**
 * Le contrat imprime un téléphone. Un client connecté par téléphone l'a déjà,
 * vérifié ; un client connecté par e-mail doit en déclarer un.
 */
const TELEPHONE_CONTACT: Exigence = ["telephoneContact", "Votre numéro de téléphone"];

export interface EtatDossier {
  complet: boolean;
  champsManquants: string[];
  documentsManquants: TypeDocument[];
  /** Progression 0-100, pour la barre d'avancement de l'espace client. */
  progression: number;
}

/**
 * Diagnostic de complétude. Utilisé à deux fins : afficher au client ce
 * qu'il lui reste à faire, et autoriser (ou non) le passage en `A_VERIFIER`.
 *
 * `telephoneVerifie` est obligatoire, sans valeur par défaut : chaque appelant
 * doit dire si le compte possède un téléphone vérifié, sans quoi un client
 * connecté par e-mail passerait sans numéro jusqu'au contrat.
 */
export function etatDossier(
  customer: Partial<Customer> | null,
  documents: Pick<CustomerDocument, "type">[],
  options: { telephoneVerifie: boolean },
): EtatDossier {
  const exigences = options.telephoneVerifie ? CHAMPS_REQUIS : [...CHAMPS_REQUIS, TELEPHONE_CONTACT];

  if (!customer) {
    return {
      complet: false,
      champsManquants: exigences.map(([, libelle]) => libelle),
      documentsManquants: [...DOCUMENTS_OBLIGATOIRES],
      progression: 0,
    };
  }

  const champsManquants = exigences
    .filter(([cle]) => {
      const valeur = customer[cle];
      return valeur === null || valeur === undefined || valeur === "";
    })
    .map(([, libelle]) => libelle);

  const typesFournis = new Set(documents.map((d) => d.type));
  const documentsManquants = DOCUMENTS_OBLIGATOIRES.filter((t) => !typesFournis.has(t));

  // Le consentement au traitement des pièces est une condition à part entière.
  const consentementManquant = !customer.consentementAt;

  const total = exigences.length + DOCUMENTS_OBLIGATOIRES.length + 1;
  const restant = champsManquants.length + documentsManquants.length + (consentementManquant ? 1 : 0);

  return {
    complet: restant === 0,
    champsManquants: consentementManquant
      ? [...champsManquants, "Consentement au traitement des pièces"]
      : champsManquants,
    documentsManquants,
    progression: Math.round(((total - restant) / total) * 100),
  };
}
