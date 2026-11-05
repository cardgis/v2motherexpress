/**
 * Affichage et masquage des identifiants — importable côté client.
 *
 * Utilise les métadonnées réduites de libphonenumber, suffisantes pour
 * formater un numéro déjà validé. La validation elle-même se fait côté
 * serveur, dans `identifiant.ts`.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/** Affichage lisible : +221 77 123 45 67, +33 6 12 34 56 78. */
export function formaterTelephone(e164: string | null | undefined): string {
  if (!e164) return "—";
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/**
 * Masque un numéro pour les journaux et les écrans intermédiaires :
 * +221 ••••• 45 67. Seuls l'indicatif et les quatre derniers chiffres
 * restent visibles — assez pour que le client reconnaisse son numéro, pas
 * assez pour qu'un tiers l'exploite. Les logs ne contiennent jamais un numéro
 * complet.
 */
export function masquerTelephone(e164: string): string {
  const numero = parsePhoneNumberFromString(e164);
  const national = numero?.nationalNumber ?? e164.replace(/\D/g, "");
  if (national.length < 6) return "•••";

  const fin = national.slice(-4);
  const indicatif = numero ? `+${numero.countryCallingCode} ` : "";
  return `${indicatif}${"•".repeat(national.length - 4)} ${fin.slice(0, 2)} ${fin.slice(2)}`;
}

/** alexandre@gmail.com → al•••••@gmail.com */
export function masquerEmail(email: string): string {
  const [local = "", domaine = ""] = email.split("@");
  if (!domaine) return "•••";
  const visible = local.length <= 3 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domaine}`;
}

export function masquerIdentifiant(valeur: string): string {
  return valeur.includes("@") ? masquerEmail(valeur) : masquerTelephone(valeur);
}

/** Identifiant principal d'un compte, prêt à afficher. */
export function afficherIdentifiant(user: {
  telephone: string | null;
  email: string | null;
}): string {
  return user.telephone ? formaterTelephone(user.telephone) : (user.email ?? "—");
}
