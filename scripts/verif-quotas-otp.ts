/**
 * Les quatre verrous anti-abus de l'OTP — et surtout celui qui a été
 * desserré le 2026-11-16.
 *
 *   npm run verif:quotas
 *
 * ── Ce qu'on protège, et contre quoi ───────────────────────────────────────
 * Le « SMS pumping » suppose de CHOISIR le numéro surtaxé qu'on fait appeler.
 * À la CONNEXION, l'appelant saisit librement ce numéro : le verrou par IP y
 * est la protection principale et doit rester strict. À la SIGNATURE, le
 * numéro vient du compte attaché au contrat et l'appel exige un jeton secret :
 * le verrou n'y protégeait presque rien, pendant qu'il pouvait bloquer un vrai
 * client — au retrait, tous les clients du jour partagent le wifi de la
 * boutique, et les 40 codes quotidiens tombaient au vingtième.
 *
 * Desserrer un verrou qui garde une facture ne se fait pas sans preuve. Ce
 * script vérifie donc les deux sens : que la connexion reste tenue, et que la
 * signature ne l'est plus par la même corde.
 *
 * ── Le piège qu'il garde ───────────────────────────────────────────────────
 * Les compteurs par IP sont filtrés PAR BUT. Sans ce filtre, les codes de
 * signature de la journée gonfleraient le quota de connexion : le chemin
 * qu'on vient d'élargir rebloquerait l'autre par la bande, et personne ne le
 * verrait avant une matinée de retraits.
 *
 * Données TEMPORAIRES, supprimées à la fin même en cas d'échec. Aucun message
 * n'est envoyé : le script force le pilote `console` pour lui-même.
 */

// `.env.local` UNIQUEMENT : ce script écrit en base.
import "./env-local";

// Aucun SMS ne doit partir d'un contrôle de quotas — il en demande quarante.
process.env.SMS_DRIVER = "console";

import { prisma } from "../src/lib/prisma";
import { demanderCode, ErreurOtp } from "../src/lib/otp";
import { analyserIdentifiant } from "../src/lib/identifiant";
import type { ButOtp } from "../src/generated/prisma";

/** Hors des plages attribuées, et propre à cette exécution. */
const PREFIXE = `+2217001${String(Date.now() % 1000).padStart(3, "0")}`;

/** Numéro ivoirien d'exemple — aucun envoi réel, le pilote est `console`. */
const IVOIRIEN = "+2250701020304";

let ok = 0;
let ko = 0;

function resultat(bon: boolean, libelle: string, detail?: string) {
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (!bon && detail) console.log(`         ${detail}`);
}

/** Une demande de code. Renvoie `true` si elle est passée, `false` si refusée. */
async function demander(numero: string, but: ButOtp, ip: string): Promise<boolean> {
  const identifiant = analyserIdentifiant(numero);
  if (!identifiant) throw new Error(`numéro invalide : ${numero}`);
  try {
    await demanderCode({ identifiant, but, ip });
    return true;
  } catch (erreur) {
    if (erreur instanceof ErreurOtp) return false;
    throw erreur;
  }
}

/** Combien de demandes passent avant le premier refus. */
async function combienPassent(numeros: string[], but: ButOtp, ip: string): Promise<number> {
  let passees = 0;
  for (const numero of numeros) {
    if (!(await demander(numero, but, ip))) break;
    passees++;
  }
  return passees;
}

const numeros = (n: number, decalage = 0) =>
  Array.from({ length: n }, (_, i) => `${PREFIXE}${String(decalage + i).padStart(2, "0")}`);

/** L'erreur levée, pour pouvoir juger son code ET son texte. */
async function refusPour(numero: string): Promise<ErreurOtp | null> {
  const identifiant = analyserIdentifiant(numero);
  if (!identifiant) throw new Error(`numéro invalide : ${numero}`);
  try {
    await demanderCode({ identifiant, but: "CONNEXION", ip: "10.0.9.1" });
    return null;
  } catch (erreur) {
    if (erreur instanceof ErreurOtp) return erreur;
    throw erreur;
  }
}

async function main() {
  console.log("\nQuotas anti-abus de l'OTP\n");

  try {
    // ── 0. Le pays, avant tout quota ─────────────────────────────────────
    // Dexchange ne dessert QUE le Sénégal (établi le 2026-11-20 sur un vrai
    // envoi : « pays non disponible », HTTP 400). La liste annonçait 63 pays
    // et promettait donc pour le compte d'un prestataire qui ne tenait pas.
    console.log("=== Les pays desservis ===");
    // Numéro d’exemple, celui de la documentation de Dexchange : aucun
    // numéro réel n’a sa place dans un fichier versionné.
    const etranger = await refusPour("+33612345678");
    resultat(
      etranger?.code === "PAYS_NON_DESSERVI",
      `un numéro français est refusé AVANT l'envoi (${etranger?.code ?? "accepté !"})`,
      "sinon le refus viendrait du fournisseur, et le client lirait une panne technique",
    );
    // Le message ne doit plus orienter vers l'e-mail : son onglet est retiré
    // et son canal est fermé. Une issue qui n'existe pas est pire que la
    // limite elle-même.
    resultat(
      !!etranger && !/e-?mail/i.test(etranger.message),
      "et son message ne renvoie pas vers l'e-mail",
      etranger ? `message : « ${etranger.message} »` : undefined,
    );
    resultat(
      (await refusPour(`${PREFIXE}99`)) === null,
      "un numéro sénégalais passe",
    );

    // CI, GN et CM ont été ajoutés le 2026-11-20 sur la foi de la grille
    // « Prix par destination » de DexNotify — 0,128 € HT contre 0,016 € au
    // Sénégal. AUCUN numéro de ces pays n'a pu être essayé : l'ouverture est
    // un réglage du compte chez le fournisseur, et notre liste n'en est
    // qu'une copie. Ce contrôle vérifie donc le FILTRE, pas la réalité du
    // routage — c'est `lib/envoi` qui rattrape un démenti du fournisseur et
    // le traduit dans la même phrase que ce refus-ci.
    resultat(
      (await refusPour(IVOIRIEN)) === null,
      "un numéro ivoirien passe le filtre (CI, GN, CM ajoutés)",
      "le fournisseur peut encore le refuser : ce contrôle ne juge que notre liste",
    );

    // ── 1. Par destinataire : 5 par quart d'heure, tous buts confondus ────
    console.log("=== Le verrou qui protège le CLIENT ===");
    const unSeul = `${PREFIXE}90`;
    const passees = await combienPassent(Array(8).fill(unSeul), "CONNEXION", "10.0.0.1");
    resultat(passees === 5, `un même numéro obtient 5 codes par quart d'heure (${passees})`);

    // Le même numéro reste bloqué même en changeant de but : le verrou
    // protège la personne, pas le chemin.
    const apresBut = await demander(unSeul, "SIGNATURE", "10.0.0.2");
    resultat(!apresBut, "et changer de but ne le débloque pas");

    // ── 2. Par IP, à la CONNEXION : strict, et il doit le rester ──────────
    console.log("\n=== Le verrou qui protège la FACTURE — connexion ===");
    const ipConnexion = "10.0.1.1";
    const passeesIp = await combienPassent(numeros(14), "CONNEXION", ipConnexion);
    resultat(
      passeesIp === 10,
      `une même adresse n'obtient que 10 codes de connexion par quart d'heure (${passeesIp})`,
      "c'est le chemin où l'appelant CHOISIT le numéro appelé : il doit rester tenu",
    );

    // ── 3. Par IP, à la SIGNATURE : desserré, et c'est l'objet du jour ────
    console.log("\n=== Le même verrou — signature ===");
    const ipBoutique = "10.0.2.1";
    const passeesSignature = await combienPassent(numeros(14, 20), "SIGNATURE", ipBoutique);
    resultat(
      passeesSignature === 14,
      `la boutique dépasse 10 signatures sans être bloquée (${passeesSignature}/14)`,
      "au retrait, tous les clients du jour partagent une seule adresse",
    );

    // ── 4. Le piège : pas de contamination d'un but à l'autre ─────────────
    console.log("\n=== Les deux budgets ne se mélangent pas ===");
    // Cette adresse vient d'émettre 14 codes de signature. Une connexion
    // depuis la même adresse doit rester possible.
    const connexionApres = await demander(`${PREFIXE}80`, "CONNEXION", ipBoutique);
    resultat(
      connexionApres,
      "14 signatures n'empêchent pas une connexion depuis la même adresse",
      "les compteurs par IP doivent être filtrés par but",
    );

    // Et l'inverse : l'adresse saturée en connexion peut encore signer.
    const signatureApres = await demander(`${PREFIXE}81`, "SIGNATURE", ipConnexion);
    resultat(
      signatureApres,
      "une adresse saturée en connexion peut encore faire signer un client",
    );
  } finally {
    const efface = await prisma.otpCode.deleteMany({
      where: { OR: [{ destinataire: { startsWith: PREFIXE } }, { destinataire: IVOIRIEN }] },
    });
    console.log(`\n=== Nettoyage ===\n  OK   ${efface.count} code(s) temporaire(s) effacé(s)`);
  }

  console.log(`\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "DES ÉCARTS"} — ${ok} OK, ${ko} KO\n`);
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

void main();
