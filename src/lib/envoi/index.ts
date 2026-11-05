/**
 * Acheminement des messages vers les clients : SMS et e-mail.
 *
 * ── Un contrat, plusieurs fournisseurs ─────────────────────────────────────
 * Le reste du code ne connaît que `transportPour(type)`. Changer d'opérateur
 * SMS ou de service d'e-mail se fait par variable d'environnement, sans
 * toucher une ligne métier — c'est ce qui permet de choisir l'hébergeur plus
 * tard sans rien réécrire.
 *
 *   SMS_DRIVER    console | dexchange | orange
 *   EMAIL_DRIVER  console | smtp
 *
 * ── Un seul fournisseur de SMS, et c'est voulu ─────────────────────────────
 * `dexchange` est la route du Sénégal et la seule dont la livraison soit
 * établie. Infobip et Twilio ont été RETIRÉS le 2026-11-04 : ils n'avaient
 * jamais délivré un seul SMS, ni au Sénégal ni en France, et garder deux
 * pilotes morts donnait l'illusion d'un repli qui n'existait pas. Le détail de
 * leurs échecs est conservé en mémoire du projet, pas dans ce fichier.
 *
 * Remettre un fournisseur revient à écrire un `Transport` et une ligne dans le
 * sélecteur, en bas : c'est tout ce que l'abstraction demande.
 *
 * `smtp` couvre tous les services d'e-mail du marché : Brevo, Mailjet, Amazon
 * SES, Azure Communication Services, OVH, Scaleway TEM…
 *
 * ── Garde-fou de production ────────────────────────────────────────────────
 * Le driver `console` renvoie le code à l'écran pour qu'on puisse développer
 * sans compte opérateur. En production, cela reviendrait à afficher le code de
 * n'importe quel compte à n'importe qui : il y est donc REFUSÉ.
 */

import type { CanalOtp } from "@/generated/prisma";
import type { TypeIdentifiant } from "@/lib/identifiant";
import { masquerIdentifiant } from "@/lib/phone";

export interface Message {
  destinataire: string;
  /** Objet de l'e-mail ; ignoré pour un SMS. */
  sujet: string;
  texte: string;
  html?: string;
}

export interface Transport {
  canal: CanalOtp;
  /** `false` : le message n'atteint personne, il sort dans les logs. */
  reel: boolean;
  envoyer(message: Message): Promise<void>;
}

const DELAI_FOURNISSEUR_MS = 10_000;

function requis(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return valeur;
}

/**
 * Une URL de base se termine parfois par une barre, et doubler les barres fait
 * répondre 404 sans explication — une demi-heure perdue, déjà, sur ce piège.
 */
function sansBarreFinale(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Un seul caractère hors alphabet GSM-7 fait basculer TOUT le SMS en UCS-2 :
 * 70 caractères au lieu de 160, et 67 par segment s'il est découpé. Un accent
 * oublié double donc la facture. Les diacritiques sont retirés plutôt que de
 * laisser passer la surfacture.
 *
 * `modeles.ts` écrit déjà sans accent : ce filet n'attrape que les textes
 * ajoutés plus tard, et le dit dans les journaux pour qu'on corrige à la
 * source au lieu de s'en remettre indéfiniment au filet.
 */
function gsm7(texte: string): string {
  const propre = texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");

  if (propre !== texte) {
    console.warn("[sms] caractères hors GSM-7 retirés — à corriger dans modeles.ts");
  }
  return propre;
}

// ---------------------------------------------------------------------------
// Développement
// ---------------------------------------------------------------------------

function transportConsole(type: TypeIdentifiant): Transport {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${type === "EMAIL" ? "EMAIL_DRIVER" : "SMS_DRIVER"}="console" est interdit en production : ` +
        "le code serait visible par n'importe qui.",
    );
  }

  return {
    canal: "CONSOLE",
    reel: false,
    async envoyer({ destinataire, texte }) {
      // Seul endroit du système où un code apparaît en clair — driver de dev.
      console.info(
        `\n┌─ ${type === "EMAIL" ? "E-MAIL" : "SMS"} (développement) ─────────────────────\n` +
          `│  ${masquerIdentifiant(destinataire)}\n` +
          `│  ${texte}\n` +
          `└──────────────────────────────────────────────\n`,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

/**
 * Dexchange — fournisseur basé à Dakar, et désormais la route PRINCIPALE du
 * Sénégal. Expéditeur « LM-EXPRESS » validé le 2026-11-03, livraison constatée
 * sur Orange (77), Expresso (70) et Free (76) : c'est le premier fournisseur
 * dont un SMS soit réellement arrivé sur un téléphone sénégalais.
 *
 * Variables : DEXCHANGE_API_KEY, DEXCHANGE_SIGNATURE, et si besoin
 * DEXCHANGE_BASE_URL, DEXCHANGE_AUTH_HEADER, DEXCHANGE_AUTH_PREFIX.
 *
 * ⚠ TROIS PIÈGES, tous constatés sur le fournisseur réel.
 *
 *  1. Leur documentation annonce `X-Api-Key` et présente `Authorization:
 *     Bearer` comme déprécié. C'EST L'INVERSE : seul Bearer est accepté, le
 *     reste répond 401. L'en-tête et son préfixe sont donc des VARIABLES, pour
 *     qu'on bascule le jour où leur migration aboutit sans retoucher au code.
 *  2. L'API attend le numéro SANS le « + » (221772922620), là où nous stockons
 *     de l'E.164 (+221772922620). Le « + » est retiré ici, au plus près du
 *     fournisseur, pour que le reste du code ignore cette bizarrerie.
 *  3. Le compte est PRÉPAYÉ : un solde à zéro, c'est plus personne qui se
 *     connecte ni qui signe. D'où `soldeDexchange()` et `npm run verif:solde`.
 *
 * Leur réponse ne porte aucun statut par message, à la différence d'autres API :
 * un 200 vaut donc acceptation, et rien de plus. La preuve de livraison reste
 * le téléphone, et le solde est notre seule alerte avancée.
 */
/**
 * Délai PROPRE à l'envoi Dexchange. Les 10 s communes suffisent à lire le
 * solde, mais pas à faire partir un SMS : leur endpoint parle à l'opérateur
 * avant de répondre, et 10 s le coupe en pleine course. Le piège est qu'un
 * délai dépassé N'ANNULE PAS le travail déjà lancé chez eux — le SMS peut
 * partir quand même, avec un code que `demanderCode` vient d'invalider. Mieux
 * vaut donc attendre franchement que raccrocher trop tôt.
 */
const DELAI_DEXCHANGE_MS = 25_000;

function dexchangeEnTetes(): Record<string, string> {
  const entete = process.env.DEXCHANGE_AUTH_HEADER ?? "Authorization";
  const prefixe = process.env.DEXCHANGE_AUTH_PREFIX ?? "Bearer ";
  return {
    [entete]: `${prefixe}${requis("DEXCHANGE_API_KEY")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function dexchangeBase(): string {
  return sansBarreFinale(process.env.DEXCHANGE_BASE_URL ?? "https://api.dexchange-sms.com/api/v1");
}

const transportDexchange: Transport = {
  canal: "SMS",
  reel: true,
  async envoyer({ destinataire, texte }) {
    const reponse = await fetch(`${dexchangeBase()}/send/sms`, {
      method: "POST",
      headers: dexchangeEnTetes(),
      body: JSON.stringify({
        signature: requis("DEXCHANGE_SIGNATURE"),
        content: gsm7(texte),
        number: [destinataire.replace(/\D/g, "")],
      }),
      signal: AbortSignal.timeout(DELAI_DEXCHANGE_MS),
    });

    const corps = (await reponse.json().catch(() => null)) as
      | { message?: unknown; smsID?: unknown; messageID?: unknown }
      | null;

    if (!reponse.ok) {
      // Leur message d'erreur ne contient pas le numéro : il peut être cité.
      const detail = typeof corps?.message === "string" ? ` — ${corps.message}` : "";
      throw new Error(`Dexchange a refusé l'envoi (HTTP ${reponse.status}${detail}).`);
    }

    // Les DEUX identifiants sont conservés : leur support réclame l'un ou
    // l'autre selon l'interlocuteur, et c'est la seule prise pour retrouver un
    // envoi quand le SMS n'arrive pas.
    const reference = [corps?.smsID, corps?.messageID]
      .filter((valeur): valeur is string => typeof valeur === "string" && valeur.length > 0)
      .join("/");

    console.info(`[dexchange] envoi accepté — ${reference || "sans identifiant"}`);
  },
};

/**
 * Solde prépayé restant, exprimé en SMS.
 *
 * `null` signifie « je n'ai pas pu savoir » — fournisseur injoignable, réponse
 * inattendue —, ce qui ne se confond pas avec zéro : rendre 0 dans ce cas
 * déclencherait une alerte de solde vide chaque fois que le réseau tousse.
 */
export async function soldeDexchange(): Promise<number | null> {
  // La réponse décrit un compte, pas un client : la journaliser ne divulgue
  // aucune donnée personnelle, et sans elle « solde illisible » n'est pas un
  // diagnostic. Un contrôle qui ne sait pas expliquer sa cécité ne sert à rien.
  try {
    const reponse = await fetch(`${dexchangeBase()}/balance`, {
      headers: dexchangeEnTetes(),
      signal: AbortSignal.timeout(DELAI_FOURNISSEUR_MS),
    });

    const texte = await reponse.text();

    if (!reponse.ok) {
      console.warn(`[dexchange] solde — HTTP ${reponse.status} : ${texte.slice(0, 300)}`);
      return null;
    }

    let corps: unknown;
    try {
      corps = JSON.parse(texte);
    } catch {
      console.warn(`[dexchange] solde — réponse non JSON : ${texte.slice(0, 300)}`);
      return null;
    }

    const solde = (corps as { solde_sms?: unknown })?.solde_sms;
    if (typeof solde === "number") return solde;

    // Le champ attendu vient du module fourni et n'a jamais été vérifié sur
    // l'API réelle : si leur nom diffère, il est ici, dans ce journal.
    console.warn(`[dexchange] solde — champ solde_sms absent : ${texte.slice(0, 300)}`);
    return null;
  } catch (erreur) {
    console.warn(`[dexchange] solde — appel impossible : ${erreur instanceof Error ? erreur.message : erreur}`);
    return null;
  }
}

/** Emplacement réservé : l'API Orange exige un contrat d'entreprise au Sénégal. */
const transportOrange: Transport = {
  canal: "SMS",
  reel: true,
  async envoyer() {
    throw new Error("Orange SMS API non configurée. Utilisez SMS_DRIVER=dexchange ou console.");
  },
};

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

type Transporteur = import("nodemailer").Transporter;
let transporteurSmtp: Promise<Transporteur> | undefined;

/**
 * Connexion SMTP mutualisée : ouverte une fois par processus, et non à chaque
 * code envoyé. Le chiffrement TLS est exigé — un code transmis en clair entre
 * notre serveur et le relais serait interceptable.
 *
 * Variables : SMTP_HOST, SMTP_PORT (587 par défaut), SMTP_USER, SMTP_PASSWORD,
 * EMAIL_EXPEDITEUR (« La Mother Express <no-reply@lamotherexpress.com> »).
 */
function smtp(): Promise<Transporteur> {
  transporteurSmtp ??= import("nodemailer").then(({ default: nodemailer }) => {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const utilisateur = process.env.SMTP_USER;
    return nodemailer.createTransport({
      host: requis("SMTP_HOST"),
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      pool: true,
      auth: utilisateur ? { user: utilisateur, pass: requis("SMTP_PASSWORD") } : undefined,
      connectionTimeout: DELAI_FOURNISSEUR_MS,
    });
  });
  return transporteurSmtp;
}

const transportSmtp: Transport = {
  canal: "EMAIL",
  reel: true,
  async envoyer({ destinataire, sujet, texte, html }) {
    const transporteur = await smtp();
    await transporteur.sendMail({
      from: requis("EMAIL_EXPEDITEUR"),
      to: destinataire,
      subject: sujet,
      text: texte,
      html,
    });
  },
};

// ---------------------------------------------------------------------------
// Sélection
// ---------------------------------------------------------------------------

export function transportPour(type: TypeIdentifiant): Transport {
  if (type === "EMAIL") {
    const driver = process.env.EMAIL_DRIVER ?? "console";
    switch (driver) {
      case "smtp":
        return transportSmtp;
      case "console":
        return transportConsole("EMAIL");
      default:
        throw new Error(`EMAIL_DRIVER inconnu : ${driver}`);
    }
  }

  // OTP_DRIVER est l'ancien nom de la variable, conservé pour compatibilité.
  const driver = process.env.SMS_DRIVER ?? process.env.OTP_DRIVER ?? "console";
  switch (driver) {
    case "dexchange":
      return transportDexchange;
    case "orange":
      return transportOrange;
    case "console":
      return transportConsole("TELEPHONE");
    default:
      throw new Error(`SMS_DRIVER inconnu : ${driver}`);
  }
}
