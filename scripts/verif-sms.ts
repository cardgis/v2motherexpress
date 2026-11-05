/**
 * Contrôle de l'envoi de SMS, sur le VRAI fournisseur configuré.
 *
 *   npm run verif:sms -- "+221 77 123 45 67"
 *
 * Envoie UN message de test au numéro donné. Ce n'est pas un code OTP : aucun
 * compte n'est touché, rien n'est écrit en base, aucun quota n'est consommé.
 *
 * Les contrôles suivent l'ordre où un vrai envoi échouerait, pour dire OÙ ça
 * casse plutôt que de constater qu'aucun SMS n'arrive :
 *   1. le numéro est normalisable en E.164 ;
 *   2. son pays figure dans SMS_PAYS_AUTORISES — sinon l'OTP le refuse AVANT
 *      d'appeler le fournisseur, et aucune trace n'apparaît chez lui ;
 *   3. le driver configuré envoie réellement ;
 *   4. les variables du fournisseur sont présentes ;
 *   5. le fournisseur accepte l'envoi.
 */

// `.env.local` UNIQUEMENT : ce script ne doit jamais hériter d'un accès de production.
import "./env-local";

import { transportPour } from "../src/lib/envoi";
import { normaliserTelephone, paysDuTelephone } from "../src/lib/identifiant";
import { masquerTelephone } from "../src/lib/phone";

async function main() {
  const saisie = process.argv[2];
  if (!saisie) {
    console.error('\nUsage : npm run verif:sms -- "+221 77 123 45 67"\n');
    process.exit(1);
  }

  // 1. Le numéro
  const numero = normaliserTelephone(saisie);
  if (!numero) {
    console.error(`\n  KO   numéro illisible : « ${saisie} »`);
    console.error("       Attendu : un numéro sénégalais (77 123 45 67) ou international (+33 6 …).\n");
    process.exit(1);
  }

  const pays = numero.pays ?? paysDuTelephone(numero.e164);
  console.log(`\nEnvoi de SMS — ${masquerTelephone(numero.e164)}${pays ? ` (${pays})` : ""}\n`);
  console.log(`  ✓ numéro normalisé en E.164`);

  // 2. Le garde-fou pays, appliqué comme l'OTP l'applique
  const autorises = (process.env.SMS_PAYS_AUTORISES ?? "")
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);

  if (autorises.length === 0) {
    console.log("  ⚠  SMS_PAYS_AUTORISES est VIDE : aucun filtre de pays, tout numéro passe.");
  } else if (!pays || !autorises.includes(pays)) {
    console.error(`  KO   ${pays ?? "pays indéterminé"} absent de SMS_PAYS_AUTORISES.`);
    console.error("       L'OTP refuserait ce numéro sans jamais appeler le fournisseur.\n");
    process.exit(1);
  } else {
    console.log(`  ✓ ${pays} autorisé (${autorises.length} pays dans la liste)`);
  }

  // 3 et 4. Le fournisseur
  const driver = process.env.SMS_DRIVER ?? process.env.OTP_DRIVER ?? "console";
  console.log(`  ✓ SMS_DRIVER = ${driver}`);

  let transport;
  try {
    transport = transportPour("TELEPHONE");
  } catch (erreur) {
    console.error(`  KO   ${erreur instanceof Error ? erreur.message : erreur}\n`);
    process.exit(1);
  }

  if (!transport.reel) {
    console.log("\n  ⚠  Ce driver n'envoie RIEN. Le message sort ci-dessous, dans la console.");
    console.log('     Pour un envoi réel : SMS_DRIVER="dexchange" dans .env.local.');
  }

  // 5. L'envoi
  try {
    await transport.envoyer({
      destinataire: numero.e164,
      sujet: "Test La Mother Express",
      texte: "La Mother Express - test d'envoi. Ce message ne demande aucune action.",
    });
  } catch (erreur) {
    console.error(`\n  KO   ${erreur instanceof Error ? erreur.message : erreur}`);
    if (driver === "dexchange") {
      console.error("       Dexchange refuse le plus souvent pour : solde prépayé épuisé");
      console.error("       (npm run verif:solde le dit en une ligne), signature non validée,");
      console.error("       ou clé d'API refusée. Un 401 sur une clé que vous savez bonne tient");
      console.error("       à l'en-tête : leur doc annonce X-Api-Key, mais seul Bearer marche.\n");
    } else {
      console.error("");
    }
    process.exitCode = 1;
    return;
  }

  if (transport.reel) {
    console.log("\n  ✓ Le fournisseur a ACCEPTÉ l'envoi.");
    console.log("     Un accusé d'acceptation n'est pas une réception : si le SMS n'arrive pas,");
    console.log(
      driver === "dexchange"
        ? "     citez l'identifiant [dexchange] affiché ci-dessus à leur support : c'est\n" +
            "     la seule prise pour retrouver un envoi dans leurs journaux.\n"
        : "     la suite se lit chez le fournisseur, dans son journal d'envois.\n",
    );
  } else {
    console.log("\n  ✓ Message affiché (driver de développement) — rien n'est parti.\n");
  }
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
