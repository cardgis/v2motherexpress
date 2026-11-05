/**
 * Contrôle de pré-production — la configuration, avant que des clients la subissent.
 *
 *   npm run verif:prod
 *
 * Ce script répond à une seule question : si on démarre l'application avec CET
 * environnement, qu'est-ce qui va mal se passer ? Il ne teste pas le métier,
 * déjà couvert par les autres contrôles ; il teste ce que personne ne pense à
 * relire le jour du déploiement.
 *
 * ── Pourquoi il n'importe PAS `./env-local` ────────────────────────────────
 * C'est la SEULE exception, et elle est voulue. Tous les autres scripts
 * s'attachent à `.env.local` pour ne jamais pouvoir écrire sur la production.
 * Celui-ci doit au contraire juger l'environnement RÉEL de la machine où il
 * tourne — sur l'hébergeur, après déploiement, ou en local contre un fichier
 * qu'on vient de préparer. Il reste sans danger parce qu'il NE LIT ET N'ÉCRIT
 * AUCUNE BASE : il ne regarde que des variables.
 *
 * ── Deux niveaux, et la différence compte ──────────────────────────────────
 *   BLOQUANT  l'application ne marchera pas, ou pas sûrement. Code de sortie 1.
 *   ALERTE    elle marchera, mais un choix est fait par défaut à votre place.
 */

let bloquants = 0;
let alertes = 0;

function ok(sujet: string, detail = "") {
  console.log(`  ✓ ${sujet}${detail ? ` — ${detail}` : ""}`);
}

function bloquant(sujet: string, explication: string) {
  bloquants += 1;
  console.error(`  BLOQUANT  ${sujet}`);
  console.error(`            ${explication}`);
}

function alerte(sujet: string, explication: string) {
  alertes += 1;
  console.warn(`  ALERTE    ${sujet}`);
  console.warn(`            ${explication}`);
}

function valeur(nom: string): string {
  return (process.env[nom] ?? "").trim();
}

/**
 * Un secret de développement recopié en production passe tous les contrôles de
 * LONGUEUR : « dev-only-client-secret-9f8e… » fait 48 caractères. Seule son
 * allure le trahit, d'où cette liste de mots qui n'ont rien à faire dans un
 * secret tiré au hasard.
 */
const MOTS_SUSPECTS = /dev-only|developpement|exemple|example|changeme|a-changer|motdepasse|password|123456|a1b2c3|xxxx/i;


/**
 * Vercel pose ses propres variables (`VERCEL`, `VERCEL_ENV`) : les détecter
 * permet de DURCIR certains contrôles. Un réglage simplement discutable
 * ailleurs y devient fatal — le disque, surtout, qui n'y survit pas à un
 * déploiement.
 */
const surVercel = Boolean(process.env.VERCEL);
function secretSuspect(v: string): boolean {
  return MOTS_SUSPECTS.test(v);
}

// ---------------------------------------------------------------------------

console.log("\nContrôle de pré-production\n");

// ── Le contexte d'exécution ────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  ok("NODE_ENV = production");
} else {
  alerte(
    `NODE_ENV = ${process.env.NODE_ENV ?? "(absent)"}`,
    "Hors production, les garde-fous du code ne s'arment pas : le driver « console » " +
      "est accepté, et le stockage non chiffré aussi. Un contrôle passé ici ne " +
      "prouve donc rien pour le site en ligne.",
  );
}

// ── La base de données ─────────────────────────────────────────────────────
const bdd = valeur("DATABASE_URL");
if (!bdd) {
  bloquant("DATABASE_URL absente", "Aucune page ne s'affichera.");
} else if (/localhost|127\.0\.0\.1/.test(bdd)) {
  alerte(
    "DATABASE_URL pointe sur localhost",
    "C'est la base de développement. En production, l'application démarrera et " +
      "répondra 500 sur tout — le symptôme ne dira pas que c'est l'adresse.",
  );
} else {
  ok("DATABASE_URL définie", "hors localhost");
}

// ── Le secret maître ───────────────────────────────────────────────────────
const secret = valeur("AUTH_SECRET");
if (!secret) {
  bloquant("AUTH_SECRET absent", "Aucune session ne peut être signée, aucun code OTP haché.");
} else if (secret.length < 32) {
  bloquant(`AUTH_SECRET trop court (${secret.length} caractères)`, "Minimum 32 : openssl rand -hex 32.");
} else if (secretSuspect(secret)) {
  bloquant(
    "AUTH_SECRET a l'allure d'un secret de développement",
    "La longueur ne suffit pas à juger un secret. Celui-ci contient un mot qui " +
      "n'apparaît jamais dans une valeur tirée au hasard. Il signe les sessions ET " +
      "hache les codes : s'il est devinable, les deux tombent. openssl rand -hex 32.",
  );
} else {
  ok("AUTH_SECRET", `${secret.length} caractères, sans motif suspect`);
}

// ── L'envoi des codes : SMS ────────────────────────────────────────────────
const sms = valeur("SMS_DRIVER") || valeur("OTP_DRIVER") || "console";

if (sms === "console") {
  bloquant(
    'SMS_DRIVER = "console"',
    "Ce driver affiche le code au lieu de l'envoyer : n'importe qui pourrait se " +
      "connecter sur n'importe quel compte. Le code le refuse en production, donc " +
      "l'application ne démarrera même pas.",
  );
} else if (sms === "dexchange") {
  const manquantes = ["DEXCHANGE_API_KEY", "DEXCHANGE_SIGNATURE"].filter((n) => !valeur(n));
  if (manquantes.length > 0) {
    bloquant(`Dexchange incomplet : ${manquantes.join(", ")}`, "Aucun SMS ne partira, donc aucune connexion.");
  } else {
    ok("SMS_DRIVER = dexchange", `expéditeur « ${valeur("DEXCHANGE_SIGNATURE")} »`);
    console.log("    → le SOLDE reste à surveiller séparément : npm run verif:solde");
  }
} else {
  alerte(`SMS_DRIVER = ${sms}`, "Driver non éprouvé pour ce projet. Seul « dexchange » a livré au Sénégal.");
}

// ── L'envoi des codes : e-mail ─────────────────────────────────────────────
const email = valeur("EMAIL_DRIVER") || "console";

if (email === "console") {
  alerte(
    'EMAIL_DRIVER = "console" — le canal e-mail est FERMÉ',
    "Conséquence concrète : un client qui s'identifie par une adresse e-mail ne " +
      "recevra jamais son code et ne pourra pas se connecter. Tant que le SMS " +
      "couvre tout le monde, c'est tenable ; dès qu'un visiteur étranger se " +
      "présente, il est bloqué (voir SMS_PAYS_AUTORISES plus bas).",
  );
} else if (email === "smtp") {
  const manquantes = ["SMTP_HOST", "SMTP_PASSWORD", "EMAIL_EXPEDITEUR"].filter((n) => !valeur(n));
  if (manquantes.length > 0) {
    bloquant(`SMTP incomplet : ${manquantes.join(", ")}`, "Le code lèvera une erreur au premier envoi.");
  } else {
    ok("EMAIL_DRIVER = smtp", valeur("SMTP_HOST"));
    console.log("    → rappel : sans DOMAINE D'ENVOI VÉRIFIÉ en DNS, aucun e-mail ne part,");
    console.log("      quel que soit le fournisseur. C'est une formalité, pas du code.");
  }
}

// ── Le stockage des pièces et des contrats ─────────────────────────────────
const stockage = valeur("STORAGE_DRIVER") || "local";

if (stockage === "local") {
  const texte =
    "Les pièces d'identité et les PDF signés vivent sur le disque de la machine. " +
    "À remplacer par s3 ou azure.";

  if (surVercel) {
    // Sur Vercel il n'y a pas de disque : le système de fichiers est en lecture
    // seule hors /tmp, et /tmp disparaît avec l'instance. Ce n'est donc pas
    // « risqué », c'est inopérant — d'où un bloquant et non une alerte.
    bloquant(
      'STORAGE_DRIVER = "local" sur Vercel',
      `${texte} Or Vercel n'a PAS de disque persistant : les fichiers seraient ` +
        "perdus à la première remise en route d'une instance, et les preuves des " +
        "contrats avec eux. Tout pilote S3 convient : Scaleway, OVH, R2, AWS.",
    );
  } else {
    alerte(
      'STORAGE_DRIVER = "local"',
      `${texte} Chez la plupart des hébergeurs, ce disque est effacé à chaque ` +
        "déploiement : les preuves des contrats disparaîtraient.",
    );
  }
} else if (stockage === "vercel") {
  // Le pilote écrit en accès PRIVÉ depuis le 2026-11-05 : un blob n'est plus
  // lisible sans jeton. Ces deux variables restent néanmoins nécessaires —
  // l'une pour accéder au stockage, l'autre comme couche supplémentaire.
  const sel = valeur("STORAGE_PATH_SALT");
  const jeton = valeur("BLOB_READ_WRITE_TOKEN");

  if (!sel) {
    bloquant(
      'STORAGE_PATH_SALT absent avec STORAGE_DRIVER="vercel"',
      "Le pilote REFUSE de démarrer sans lui en production, plutôt que de se " +
        "dégrader en silence sur un stockage de pièces d'identité. Il rend les " +
        "chemins non devinables : l'accès privé est la barrière principale, le sel " +
        "en est une seconde qui ne coûte rien. openssl rand -hex 16",
    );
  } else {
    ok("STORAGE_PATH_SALT", "présent — chemins non devinables");
  }

  if (!jeton && !surVercel) {
    alerte(
      "BLOB_READ_WRITE_TOKEN absent",
      "Vercel l'injecte automatiquement sur sa plateforme, mais pas en local : " +
        "hors Vercel, aucune lecture ni écriture de blob ne fonctionnera.",
    );
  } else {
    ok("Accès Vercel Blob", surVercel ? "jeton injecté par la plateforme" : "jeton présent");
  }

  console.log("    → les blobs sont écrits en accès PRIVÉ : une URL seule ne donne");
  console.log("      rien, et le contenu est chiffré par-dessus.");
} else {
  ok(`STORAGE_DRIVER = ${stockage}`);
}

const cles = valeur("STORAGE_CLES_CHIFFREMENT");
// Le format est « étiquette:clé ». Inspecter la clé elle-même n'a pas de sens —
// du hasard en base64 peut contenir n'importe quelle suite de lettres — mais
// l'ÉTIQUETTE est choisie par un humain, et « dev2026 » dit tout.
const etiquette = cles.split(":")[0] ?? "";

if (!cles) {
  bloquant("STORAGE_CLES_CHIFFREMENT absent", "Rien ne pourra être stocké : le chiffrement est obligatoire.");
} else if (secretSuspect(cles) || /^(dev|test|local|demo)/i.test(etiquette)) {
  bloquant(
    `STORAGE_CLES_CHIFFREMENT : étiquette « ${etiquette} », clé de développement`,
    "Elle chiffre les pièces d'identité. Attention : la remplacer PLUS TARD rendra " +
      "illisible tout ce qui aura été stocké avec. C'est maintenant ou jamais.",
  );
} else {
  ok("STORAGE_CLES_CHIFFREMENT", `étiquette « ${etiquette} », sans motif suspect`);
}

// ── Les garde-fous anti-fraude ─────────────────────────────────────────────
const pays = valeur("SMS_PAYS_AUTORISES");
if (!pays) {
  alerte(
    "SMS_PAYS_AUTORISES est vide",
    "Tout numéro du monde peut demander un code, donc faire payer un SMS. C'est la " +
      "fraude dite du « SMS pumping » : des robots visent des numéros surtaxés et " +
      "c'est vous qui réglez. Au minimum : SN.",
  );
} else {
  ok("SMS_PAYS_AUTORISES", `${pays.split(",").filter(Boolean).length} pays`);
}

const plafond = Number(valeur("OTP_PLAFOND_SMS_HEURE"));
if (!Number.isInteger(plafond) || plafond <= 0) {
  alerte("OTP_PLAFOND_SMS_HEURE non défini", "Le coupe-circuit retombe sur 300 SMS par heure, soit la facture correspondante.");
} else {
  ok("OTP_PLAFOND_SMS_HEURE", `${plafond} par heure`);
}

// ── La lecture de l'adresse IP ─────────────────────────────────────────────
// Elle fonde les quotas par IP : une IP mal lue, et le quota ne protège rien.
const sauts = valeur("PROXY_SAUTS_DE_CONFIANCE");
if (!sauts) {
  alerte(
    "PROXY_SAUTS_DE_CONFIANCE non défini",
    "Valeur retenue : 1. Juste derrière un hébergeur unique, faux derrière un CDN " +
      "(mettre 2) et faux en exposition directe (mettre 0). Mal réglé, l'adresse IP " +
      "des visiteurs devient falsifiable et les quotas par IP ne protègent plus.",
  );
} else {
  ok("PROXY_SAUTS_DE_CONFIANCE", sauts);
}

// ── Deux réglages qu'on découvre toujours trop tard ────────────────────────
const suivi = valeur("SUIVI_VERSEMENTS_DEPUIS");
if (!suivi) {
  alerte(
    "SUIVI_VERSEMENTS_DEPUIS est vide",
    "Chaque contrat sera suivi depuis son scellement, y compris les anciens : le " +
      "suivi réclamera des versements antérieurs à la mise en ligne. À fixer à la " +
      "date d'ouverture du service.",
  );
} else {
  ok("SUIVI_VERSEMENTS_DEPUIS", suivi);
}

const site = valeur("NEXT_PUBLIC_SITE_URL");
if (!site) {
  alerte("NEXT_PUBLIC_SITE_URL absente", "Les liens envoyés aux clients, dont celui de signature, seront incomplets.");
} else if (!site.startsWith("https://")) {
  bloquant(`NEXT_PUBLIC_SITE_URL en ${site.split(":")[0]}`, "Un lien de signature doit être en https : il porte une preuve.");
} else {
  ok("NEXT_PUBLIC_SITE_URL", site);
}


// ── Ce que le serverless impose ────────────────────────────────────────────
const cron = valeur("CRON_SECRET");
if (!cron) {
  alerte(
    "CRON_SECRET absent — le cron d'expiration ne tournera PAS",
    "La route /api/cron/expiration se désactive elle-même sans secret, plutôt que " +
      "de libérer des motos sur simple appel public. Conséquence : les réservations " +
      "non retirées resteront bloquées indéfiniment, et les motos avec elles. " +
      "openssl rand -hex 24.",
  );
} else if (cron.length < 24) {
  alerte(`CRON_SECRET court (${cron.length} caractères)`, "Il protège une route publique : 24 caractères au moins.");
} else {
  ok("CRON_SECRET", `${cron.length} caractères`);
}

// `Number("")` vaut 0 et non NaN : lire la chaîne brute AVANT de convertir, sans
// quoi une variable absente passerait le contrôle comme un 0 parfaitement valide.
const poolBrut = valeur("DATABASE_POOL_MAX");
const pool = poolBrut ? Number(poolBrut) : NaN;

if (surVercel && (!Number.isInteger(pool) || pool > 3)) {
  alerte(
    `DATABASE_POOL_MAX = ${poolBrut || "(absent, donc 10 par défaut)"}`,
    "En serverless, CHAQUE instance ouvre son propre pool, et Vercel en démarre " +
      "autant que le trafic l'exige : 10 connexions par instance saturent une base " +
      "managée en quelques dizaines d'instances. Descendre à 1-3 et passer par le " +
      "pooler du fournisseur (PgBouncer, pooler Neon).",
  );
} else if (Number.isInteger(pool) && pool > 0) {
  ok("DATABASE_POOL_MAX", String(pool));
}
// ── Verdict ────────────────────────────────────────────────────────────────
console.log("");

if (bloquants > 0) {
  console.error(`  ${bloquants} BLOQUANT(S) et ${alertes} alerte(s) — NE PAS DÉPLOYER en l'état.\n`);
  process.exitCode = 1;
} else if (alertes > 0) {
  console.log(`  Aucun bloquant, ${alertes} alerte(s) — chacune est un choix à assumer, pas une panne.\n`);
} else {
  console.log("  Configuration complète.\n");
}

console.log("  Ce contrôle ne touche AUCUNE base. Restent à faire sur l'hébergeur :");
console.log("    npx prisma migrate deploy     appliquer le schéma");
console.log("    npm run verif:solde           le crédit SMS, qui n'est pas de la configuration");
console.log("    npm run cron:expiration       à planifier une fois par jour\n");
