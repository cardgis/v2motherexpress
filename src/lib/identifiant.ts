/**
 * Identifiants de connexion : numéro de téléphone (tous pays) ou e-mail.
 *
 * SERVEUR UNIQUEMENT — ce module embarque les métadonnées complètes de
 * libphonenumber (~150 Ko), inutiles dans le navigateur. L'affichage et le
 * masquage, eux, vivent dans `phone.ts`, importable côté client.
 *
 * ── La règle d'or ──────────────────────────────────────────────────────────
 * Deux écritures du même identifiant doivent produire EXACTEMENT la même
 * chaîne, sans quoi une même personne se retrouve avec deux comptes et deux
 * dossiers KYC. D'où :
 *   — téléphone ramené au format E.164 (+221771234567) ;
 *   — e-mail ramené en minuscules, espaces retirés.
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { z } from "zod";

export type TypeIdentifiant = "TELEPHONE" | "EMAIL";

export interface Identifiant {
  type: TypeIdentifiant;
  /** Valeur normalisée : E.164 pour un téléphone, minuscules pour un e-mail. */
  valeur: string;
}

/** Un numéro saisi sans indicatif est présumé sénégalais. */
const PAYS_PAR_DEFAUT: CountryCode = "SN";

/**
 * Seules ces lignes reçoivent un SMS. Un fixe sénégalais (33 8xx xx xx) est
 * un numéro valide, mais le code n'y arriverait jamais : mieux vaut le dire
 * tout de suite que laisser le client attendre.
 */
const TYPES_JOIGNABLES_PAR_SMS = new Set(["MOBILE", "FIXED_LINE_OR_MOBILE"]);

const LONGUEUR_MAX_SAISIE = 64;

// ---------------------------------------------------------------------------
// Téléphone
// ---------------------------------------------------------------------------

export function normaliserTelephone(saisie: string): { e164: string; pays?: CountryCode } | null {
  const brut = String(saisie ?? "").trim();
  if (!brut || brut.length > LONGUEUR_MAX_SAISIE) return null;

  let texte = brut;
  const chiffres = brut.replace(/\D/g, "");

  // Écritures héritées de la V1, toujours saisies par les clients sénégalais :
  //   00221771234567 → préfixe international composé depuis le Sénégal
  //   221771234567   → indicatif sans « + »
  //   0771234567     → zéro de courtoisie affiché par certains opérateurs
  if (/^00\d/.test(brut.replace(/[\s.()-]/g, ""))) texte = `+${chiffres.slice(2)}`;
  else if (!brut.startsWith("+") && chiffres.length === 12 && chiffres.startsWith("221")) {
    texte = `+${chiffres}`;
  } else if (!brut.startsWith("+") && chiffres.length === 10 && chiffres.startsWith("07")) {
    texte = chiffres.slice(1);
  }

  const numero = parsePhoneNumberFromString(texte, PAYS_PAR_DEFAUT);
  if (!numero || !numero.isValid()) return null;

  const type = numero.getType();
  if (type !== undefined && !TYPES_JOIGNABLES_PAR_SMS.has(type)) return null;

  return { e164: numero.number, pays: numero.country };
}

/** Pays d'un numéro déjà normalisé, pour le filtrage des envois SMS. */
export function paysDuTelephone(e164: string): CountryCode | undefined {
  return parsePhoneNumberFromString(e164)?.country;
}

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

const schemaEmail = z.email().max(254);

export function normaliserEmail(saisie: string): string | null {
  const texte = String(saisie ?? "").trim().toLowerCase();
  if (!texte || texte.length > 254) return null;
  return schemaEmail.safeParse(texte).success ? texte : null;
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * Reconnaît et normalise une saisie libre. Le choix se fait sur la présence
 * d'un « @ » : aucun numéro de téléphone n'en contient.
 */
export function analyserIdentifiant(saisie: unknown): Identifiant | null {
  const texte = String(saisie ?? "").trim();
  if (!texte || texte.length > 254) return null;

  if (texte.includes("@")) {
    const email = normaliserEmail(texte);
    return email ? { type: "EMAIL", valeur: email } : null;
  }

  const telephone = normaliserTelephone(texte);
  return telephone ? { type: "TELEPHONE", valeur: telephone.e164 } : null;
}

/** Identifiant vers lequel envoyer un code à un compte existant. */
export function identifiantDuCompte(user: {
  telephone: string | null;
  email: string | null;
}): Identifiant | null {
  if (user.telephone) return { type: "TELEPHONE", valeur: user.telephone };
  if (user.email) return { type: "EMAIL", valeur: user.email };
  return null;
}
