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
 *   — par destinataire : 5 codes / 15 min et 10 / 24 h ;
 *   — par adresse IP, ET SEULEMENT POUR LA CONNEXION : 10 / 15 min, 40 / 24 h ;
 *   — plafond GLOBAL de SMS par heure (OTP_PLAFOND_SMS_HEURE), qui coupe la
 *     facture net en cas d'attaque distribuée ;
 *   — liste des pays autorisés par SMS (SMS_PAYS_AUTORISES). Elle vaut SN
 *     seul depuis le 2026-11-20 : Dexchange ne dessert QUE le Sénégal, ce
 *     qu'un essai sur un numéro français a établi — « pays non disponible »,
 *     HTTP 400. La liste annonçait 63 pays ; elle promettait pour le compte
 *     d'un prestataire qui ne tenait pas.
 * Les compteurs vivent en base : ils valent pour toutes les instances.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cleDerivee } from "@/lib/secrets";
import { paysDuTelephone, type Identifiant } from "@/lib/identifiant";
import { masquerIdentifiant } from "@/lib/phone";
import { transportPour, ErreurPaysNonDesservi } from "@/lib/envoi";
import { messageCode } from "@/lib/envoi/modeles";
import type { ButOtp, CanalOtp } from "@/generated/prisma";

const LONGUEUR_CODE = 6;
const VALIDITE_MINUTES = 10;
const TENTATIVES_MAX = 5;

const QUART_HEURE = 15 * 60_000;
const JOUR = 24 * 3_600_000;

/**
 * Par destinataire — le verrou qui protège le CLIENT, et il vaut pour tous
 * les buts.
 *
 * 5 et non 3 par quart d'heure (2026-11-16) : un parcours réel consomme deux
 * codes, un pour la connexion et un pour la signature. À 3, il ne restait
 * qu'un seul renvoi de marge — or sur un réseau où un SMS peut mettre
 * plusieurs minutes, le client appuie sur « renvoyer » précisément parce que
 * rien n'arrive. Le plafond journalier et le plafond global tiennent la
 * facture ; celui-ci n'avait pas à être le plus serré des trois.
 */
const LIMITES = {
  destinataireQuartHeure: 5,
  destinataireJour: 10,
} as const;

/**
 * Par adresse IP — le verrou qui protège la FACTURE, et il ne vise qu'un
 * chemin : la connexion.
 *
 * ── Pourquoi la signature n'est pas logée à la même enseigne (2026-11-16) ──
 * Le « SMS pumping » suppose de CHOISIR le numéro surtaxé qu'on fait appeler.
 * À la connexion, l'appelant saisit librement ce numéro : le verrou par IP y
 * est la protection principale, et il reste strict.
 *
 * À la signature, le numéro n'est pas choisi — il vient du compte attaché au
 * contrat, et l'appel exige un jeton de signature qui est lui-même un secret.
 * Le verrou n'y protégeait donc presque rien, pendant qu'il pouvait bloquer
 * un vrai client : au retrait, le client signe SUR PLACE, souvent par le wifi
 * de la boutique. Tous les clients du jour y partagent une seule adresse —
 * à deux codes chacun, les 40 quotidiens tombaient au vingtième. Et le NAT
 * des opérateurs sénégalais fait partager une même adresse publique à des
 * abonnés sans aucun rapport entre eux. Le client se retrouvait devant le
 * gérant, incapable de signer, pour une fraude qu'il ne pouvait pas commettre.
 *
 * Un plafond large demeure quand même sur ce chemin : non pour la fraude, que
 * le quota par destinataire couvre déjà, mais pour qu'aucune boucle ne puisse
 * tourner sans fin.
 */
const LIMITES_IP: Record<ButOtp, { quartHeure: number; jour: number }> = {
  CONNEXION: { quartHeure: 10, jour: 40 },
  SIGNATURE: { quartHeure: 60, jour: 240 },
};

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
    // On ne renvoie PLUS vers l'e-mail : son onglet a été retiré le
    // 2026-11-19 et son canal est fermé (EMAIL_DRIVER=console). Proposer une
    // issue qui n'existe pas est pire que de dire la limite — la personne
    // cherche une porte au lieu d'appeler la boutique.
    throw new ErreurOtp(
      "Nos codes de connexion ne partent que vers des numéros sénégalais. " +
        "Avec un numéro étranger, appelez la boutique : elle ouvrira votre dossier avec vous.",
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
      // Comptés PAR BUT, comme les limites : sans cela, les codes de signature
      // de la journée gonfleraient le quota de connexion, et le chemin qu’on
      // vient de desserrer rebloquerait l’autre par la bande.
      ip ? tx.otpCode.count({ where: { ip, but, createdAt: { gte: new Date(maintenant - QUART_HEURE) } } }) : 0,
      ip ? tx.otpCode.count({ where: { ip, but, createdAt: { gte: new Date(maintenant - JOUR) } } }) : 0,
      transport.canal === "SMS"
        ? tx.otpCode.count({ where: { canal: "SMS", createdAt: { gte: new Date(maintenant - 3_600_000) } } })
        : 0,
    ]);

    const limitesIp = LIMITES_IP[but];

    if (dest15 >= LIMITES.destinataireQuartHeure || ip15 >= limitesIp.quartHeure) {
      throw new ErreurOtp("Trop de demandes. Réessayez dans 15 minutes.", "TROP_DE_DEMANDES");
    }
    if (destJour >= LIMITES.destinataireJour || ipJour >= limitesIp.jour) {
      throw new ErreurOtp("Trop de demandes aujourd'hui. Réessayez demain.", "TROP_DE_DEMANDES");
    }
    if (smsHeure >= plafondSmsHeure()) {
      // Ce plafond bloque TOUT LE MONDE, y compris un client debout devant son
      // gérant. Le journal doit donc dire qu'il a sauté, et à quel niveau :
      // c'est la seule trace qui permette de comprendre, après coup, pourquoi
      // une matinée entière n'a pas pu signer.
      console.error(
        `[otp] PLAFOND HORAIRE DE SMS ATTEINT (${smsHeure}/${plafondSmsHeure()}) — envois suspendus`,
      );
      // On n'oriente vers l'e-mail que si ce canal est RÉELLEMENT ouvert :
      // avec EMAIL_DRIVER=console, l'issue de secours proposée n'existe pas,
      // et le client cherche une porte qui n'est pas là.
      const emailOuvert = transportPour("EMAIL").reel;
      throw new ErreurOtp(
        emailOuvert
          ? "Le service d'envoi de SMS est momentanément saturé. Réessayez plus tard ou utilisez votre e-mail."
          : "Le service d'envoi de SMS est momentanément saturé. Réessayez dans quelques minutes, ou appelez votre boutique.",
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

    // LE FILET DE SÉCURITÉ DE `SMS_PAYS_AUTORISES` (2026-11-20). Les pays
    // desservis sont un réglage du COMPTE chez le fournisseur ; notre liste
    // n'en est qu'une copie, et elle peut être en avance sur la réalité —
    // CI, GN et CM y ont été ajoutés sur la foi de la grille tarifaire de
    // DexNotify, sans qu'un numéro de ces pays ait pu être essayé. Si le
    // fournisseur dément, le client lit la même phrase que si le filtre
    // l'avait arrêté, et non une panne.
    if (error instanceof ErreurPaysNonDesservi) {
      throw new ErreurOtp(
        "Nos codes de connexion ne partent pas vers ce pays. " +
          "Appelez la boutique : elle ouvrira votre dossier avec vous.",
        "PAYS_NON_DESSERVI",
      );
    }

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
