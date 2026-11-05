/**
 * Codes à usage unique — connexion du client et signature du contrat.
 *
 * L'OTP est le maillon qui relie un tracé de signature à une personne : c'est
 * lui qui donne sa valeur probatoire au dispositif au regard de la loi
 * sénégalaise n° 2008-08 sur les transactions électroniques. Il est donc traité
 * avec la même rigueur qu'un mot de passe.
 *
 * ── Garde-fous ─────────────────────────────────────────────────────────────
 *   — le code n'est JAMAIS stocké en clair : seul un HMAC-SHA256 (clé dérivée
 *     de AUTH_SECRET, liée au destinataire et au but) est conservé. Une copie
 *     de la base ne permet pas de retrouver un code par force brute ;
 *   — comparaison à temps constant ;
 *   — 5 essais par code, RÉSERVÉS AVANT la comparaison par une mise à jour
 *     atomique : cent requêtes simultanées n'obtiennent pas cent essais ;
 *   — un code juste est consommé de manière atomique : il ne sert qu'une fois,
 *     même soumis deux fois dans la même milliseconde ;
 *   — un code de signature est lié à SON contrat ;
 *   — une demande invalide les codes précédents encore en attente.
 *
 * ── Limitation de débit (anti-abus et anti « SMS pumping ») ────────────────
 * Ouvrir la connexion aux numéros étrangers expose à une fraude connue : des
 * robots demandent en masse des codes vers des numéros surtaxés, et c'est
 * l'entreprise qui paie les SMS. D'où quatre verrous cumulés :
 *   — par destinataire : 3 codes / 15 min et 10 / 24 h ;
 *   — par adresse IP   : 10 codes / 15 min et 40 / 24 h ;
 *   — plafond GLOBAL de SMS par heure (OTP_PLAFOND_SMS_HEURE), qui coupe la
 *     facture net en cas d'attaque distribuée ;
 *   — liste facultative des pays autorisés par SMS (SMS_PAYS_AUTORISES) ; les
 *     autres visiteurs se connectent par e-mail, qui ne coûte rien.
 * Les compteurs vivent en base : ils valent pour toutes les instances.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cleDerivee } from "@/lib/secrets";
import { paysDuTelephone, type Identifiant } from "@/lib/identifiant";
import { masquerIdentifiant } from "@/lib/phone";
import { transportPour } from "@/lib/envoi";
import { messageCode } from "@/lib/envoi/modeles";
import type { ButOtp, CanalOtp } from "@/generated/prisma";

const LONGUEUR_CODE = 6;
const VALIDITE_MINUTES = 10;
const TENTATIVES_MAX = 5;

const QUART_HEURE = 15 * 60_000;
const JOUR = 24 * 3_600_000;

const LIMITES = {
  destinataireQuartHeure: 3,
  destinataireJour: 10,
  ipQuartHeure: 10,
  ipJour: 40,
} as const;

const PLAFOND_SMS_HEURE_DEFAUT = 300;

export type CodeErreurOtp =
  | "TROP_DE_DEMANDES"
  | "CODE_INVALIDE"
  | "CODE_EXPIRE"
  | "TROP_DE_TENTATIVES"
  | "PAYS_NON_DESSERVI"
  | "SERVICE_SATURE";

export class ErreurOtp extends Error {
  constructor(
    message: string,
    readonly code: CodeErreurOtp,
  ) {
    super(message);
    this.name = "ErreurOtp";
  }

  /** Statut HTTP correspondant, pour que les routes restent homogènes. */
  get statutHttp(): number {
    switch (this.code) {
      case "TROP_DE_DEMANDES":
      case "TROP_DE_TENTATIVES":
        return 429;
      case "SERVICE_SATURE":
        return 503;
      case "PAYS_NON_DESSERVI":
        return 422;
      default:
        return 400;
    }
  }
}

function hacher(code: string, destinataire: string, but: ButOtp): string {
  return createHmac("sha256", cleDerivee("otp")).update(`${but}\n${destinataire}\n${code}`).digest("hex");
}

function empreintesEgales(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// Filtrage des envois SMS
// ---------------------------------------------------------------------------

function paysAutorisesSms(): Set<string> | null {
  const liste = (process.env.SMS_PAYS_AUTORISES ?? "")
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  return liste.length > 0 ? new Set(liste) : null;
}

function verifierPaysSms(identifiant: Identifiant) {
  if (identifiant.type !== "TELEPHONE") return;
  const autorises = paysAutorisesSms();
  if (!autorises) return;

  const pays = paysDuTelephone(identifiant.valeur);
  if (!pays || !autorises.has(pays)) {
    throw new ErreurOtp(
      "L'envoi de code par SMS n'est pas disponible pour ce pays. " +
        "Connectez-vous avec votre adresse e-mail.",
      "PAYS_NON_DESSERVI",
    );
  }
}

function plafondSmsHeure(): number {
  const valeur = Number(process.env.OTP_PLAFOND_SMS_HEURE);
  return Number.isInteger(valeur) && valeur > 0 ? valeur : PLAFOND_SMS_HEURE_DEFAUT;
}

// ---------------------------------------------------------------------------
// Demande d'un code
// ---------------------------------------------------------------------------

export async function demanderCode(params: {
  identifiant: Identifiant;
  but: ButOtp;
  contractId?: string;
  /** `inconnue` si le serveur ne peut pas établir l'adresse du client. */
  ip?: string;
}): Promise<{ expiresAt: Date; canal: CanalOtp; codeDeDeveloppement?: string }> {
  const { identifiant, but, contractId } = params;
  const destinataire = identifiant.valeur;
  const ip = params.ip && params.ip !== "inconnue" ? params.ip : undefined;

  verifierPaysSms(identifiant);

  const transport = transportPour(identifiant.type);
  const code = String(randomInt(0, 10 ** LONGUEUR_CODE)).padStart(LONGUEUR_CODE, "0");
  const expiresAt = new Date(Date.now() + VALIDITE_MINUTES * 60_000);

  // Contrôle des quotas et création du code dans UNE transaction, sous un
  // verrou consultatif propre au destinataire : deux demandes simultanées
  // pour le même numéro ne peuvent pas passer toutes les deux sous le seuil.
  const otp = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${destinataire}`}, 0))`;

    const maintenant = Date.now();
    const [dest15, destJour, ip15, ipJour, smsHeure] = await Promise.all([
      tx.otpCode.count({ where: { destinataire, createdAt: { gte: new Date(maintenant - QUART_HEURE) } } }),
      tx.otpCode.count({ where: { destinataire, createdAt: { gte: new Date(maintenant - JOUR) } } }),
      ip ? tx.otpCode.count({ where: { ip, createdAt: { gte: new Date(maintenant - QUART_HEURE) } } }) : 0,
      ip ? tx.otpCode.count({ where: { ip, createdAt: { gte: new Date(maintenant - JOUR) } } }) : 0,
      transport.canal === "SMS"
        ? tx.otpCode.count({ where: { canal: "SMS", createdAt: { gte: new Date(maintenant - 3_600_000) } } })
        : 0,
    ]);

    if (dest15 >= LIMITES.destinataireQuartHeure || ip15 >= LIMITES.ipQuartHeure) {
      throw new ErreurOtp("Trop de demandes. Réessayez dans 15 minutes.", "TROP_DE_DEMANDES");
    }
    if (destJour >= LIMITES.destinataireJour || ipJour >= LIMITES.ipJour) {
      throw new ErreurOtp("Trop de demandes aujourd'hui. Réessayez demain.", "TROP_DE_DEMANDES");
    }
    if (smsHeure >= plafondSmsHeure()) {
      console.error("[otp] plafond horaire de SMS atteint — envois suspendus");
      throw new ErreurOtp(
        "Le service d'envoi de SMS est momentanément saturé. Réessayez plus tard ou utilisez votre e-mail.",
        "SERVICE_SATURE",
      );
    }

    // Un nouveau code annule les précédents : un seul code vivant à la fois.
    await tx.otpCode.updateMany({
      where: { destinataire, but, consommeAt: null },
      data: { consommeAt: new Date() },
    });

    return tx.otpCode.create({
      data: {
        destinataire,
        codeHash: hacher(code, destinataire, but),
        canal: transport.canal,
        but,
        contractId,
        expiresAt,
        ip,
      },
      select: { id: true },
    });
  });

  try {
    await transport.envoyer(
      messageCode({
        destinataire,
        code,
        but,
        validiteMinutes: VALIDITE_MINUTES,
        canal: identifiant.type === "EMAIL" ? "EMAIL" : "SMS",
      }),
    );
  } catch (error) {
    // Un code jamais parvenu ne doit pas rester utilisable. Il reste en
    // revanche compté dans les quotas : un échec d'envoi répété n'est pas un
    // moyen de contourner la limitation.
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consommeAt: new Date() } });
    console.error(`[otp] envoi impossible vers ${masquerIdentifiant(destinataire)}`, error);
    throw error;
  }

  return {
    expiresAt,
    canal: transport.canal,
    // Uniquement quand aucun message n'est réellement parti (développement).
    codeDeDeveloppement: transport.reel ? undefined : code,
  };
}

// ---------------------------------------------------------------------------
// Vérification
// ---------------------------------------------------------------------------

export async function verifierCode(params: {
  destinataire: string;
  code: string;
  but: ButOtp;
  /** Obligatoire pour une signature : le code ne vaut que pour ce contrat. */
  contractId?: string;
}): Promise<{ otpId: string; canal: CanalOtp }> {
  const { destinataire, but, contractId } = params;
  const code = String(params.code ?? "").replace(/\D/g, "");

  const otp = await prisma.otpCode.findFirst({
    where: {
      destinataire,
      but,
      consommeAt: null,
      ...(contractId ? { contractId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, canal: true, expiresAt: true, tentatives: true },
  });

  if (!otp) throw new ErreurOtp("Aucun code en attente. Demandez-en un nouveau.", "CODE_EXPIRE");

  if (otp.expiresAt <= new Date()) {
    throw new ErreurOtp("Ce code a expiré. Demandez-en un nouveau.", "CODE_EXPIRE");
  }

  // Réservation atomique d'un essai AVANT toute comparaison. Si le quota est
  // épuisé ou si le code vient d'être consommé ailleurs, rien n'est comparé.
  const reserve = await prisma.otpCode.updateMany({
    where: {
      id: otp.id,
      consommeAt: null,
      tentatives: { lt: TENTATIVES_MAX },
      expiresAt: { gt: new Date() },
    },
    data: { tentatives: { increment: 1 } },
  });

  if (reserve.count === 0) {
    await prisma.otpCode.updateMany({
      where: { id: otp.id, consommeAt: null },
      data: { consommeAt: new Date() },
    });
    throw new ErreurOtp("Trop d'essais. Demandez un nouveau code.", "TROP_DE_TENTATIVES");
  }

  const juste =
    code.length === LONGUEUR_CODE && empreintesEgales(otp.codeHash, hacher(code, destinataire, but));

  if (!juste) {
    const restantes = TENTATIVES_MAX - (otp.tentatives + 1);
    throw new ErreurOtp(
      restantes > 0 ? `Code incorrect. ${restantes} essai(s) restant(s).` : "Code incorrect.",
      "CODE_INVALIDE",
    );
  }

  const consomme = await prisma.otpCode.updateMany({
    where: { id: otp.id, consommeAt: null },
    data: { consommeAt: new Date() },
  });

  if (consomme.count === 0) {
    throw new ErreurOtp("Ce code a déjà été utilisé. Demandez-en un nouveau.", "CODE_EXPIRE");
  }

  return { otpId: otp.id, canal: otp.canal };
}

/** Purge des codes de plus de 24 h — appelée par le cron de maintenance. */
export async function purgerCodesExpires(): Promise<number> {
  const { count } = await prisma.otpCode.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 2 * JOUR) } },
  });
  return count;
}
