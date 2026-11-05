/**
 * Purge des données de test — base LOCALE uniquement.
 *
 *   npm run purge:test                     aperçu : compte ce qui serait supprimé
 *   npm run purge:test -- --go             supprime réellement
 *   npm run purge:test -- --go --tout      + remet les compteurs de références
 *                                            à zéro et vide `.storage/`
 *
 * ── Ce qui est SUPPRIMÉ ────────────────────────────────────────────────────
 * Tout le parcours client : dossiers, pièces, réservations, contrats,
 * signatures, constats de remise, versements, codes à usage unique — et les
 * comptes CLIENT eux-mêmes.
 *
 * ── Ce qui est GARDÉ ───────────────────────────────────────────────────────
 * Les comptes de l'équipe (administrateur et gérants), les boutiques, le
 * catalogue et la flotte. Les motos retenues par un contrat supprimé
 * redeviennent disponibles : sans cela, elles resteraient « réservées » pour
 * un dossier qui n'existe plus.
 *
 * ── Ce qui n'est touché qu'avec `--tout` ───────────────────────────────────
 * Les compteurs de références (`CompteurReference`) et les fichiers chiffrés
 * de `.storage/`. Les deux vont ENSEMBLE : remettre les numéros à zéro sans
 * vider le stockage ferait réutiliser une référence déjà imprimée sur un PDF
 * encore présent. Deux documents porteraient alors le même numéro — ce qui,
 * sur un contrat, est exactement ce qu'on ne veut jamais.
 *
 * Sans `--tout`, les séries continuent (LME-2026-THS-0024 plutôt que 0001) et
 * les fichiers restent, orphelins et sans ligne qui y renvoie.
 */

import "./env-local";

import { promises as fs } from "node:fs";
import path from "node:path";

import { prisma } from "../src/lib/prisma";
import type { Role } from "../src/generated/prisma";

/** Écrit en dur dans le driver local : `process.cwd()/.storage`. */
const STOCKAGE = path.join(process.cwd(), ".storage");

/** Compte les fichiers d'un dossier, sans le parcourir deux fois. */
async function compterFichiers(dossier: string): Promise<number> {
  const entrees = await fs.readdir(dossier, { withFileTypes: true }).catch(() => []);
  let total = 0;
  for (const e of entrees) {
    total += e.isDirectory() ? await compterFichiers(path.join(dossier, e.name)) : 1;
  }
  return total;
}

/** Rôles conservés : l'équipe garde ses identifiants et ses sessions. */
const ROLES_CONSERVES: Role[] = ["ADMIN", "GERANT"];

const EXECUTER = process.argv.includes("--go");
/** Repart de zéro : numéros de référence et fichiers stockés. */
const TOUT = process.argv.includes("--tout");

async function main() {
  console.log(`\nBase : ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@")}`);
  console.log(EXECUTER ? "Mode : SUPPRESSION\n" : "Mode : aperçu (rien ne sera supprimé)\n");

  const equipe = await prisma.user.findMany({
    where: { role: { in: ROLES_CONSERVES } },
    select: { id: true, role: true, telephone: true, email: true, nomAffichage: true },
    orderBy: { role: "asc" },
  });

  const [
    evenements,
    signatures,
    contrats,
    photos,
    constats,
    encaissements,
    echeances,
    reservations,
    documents,
    dossiers,
    comptesSupprimes,
    codes,
    motosRetenues,
  ] = await Promise.all([
    prisma.contractEvent.count(),
    prisma.signature.count(),
    prisma.contract.count(),
    prisma.handoverPhoto.count(),
    prisma.handover.count(),
    prisma.encaissement.count(),
    prisma.echeance.count(),
    prisma.reservation.count(),
    prisma.customerDocument.count(),
    prisma.customer.count(),
    prisma.user.count({ where: { role: { notIn: ROLES_CONSERVES } } }),
    prisma.otpCode.count(),
    prisma.vehicule.count({ where: { statut: { in: ["RESERVE", "EN_LOCATION"] } } }),
  ]);

  const aSupprimer: [string, number][] = [
    ["Événements de contrat", evenements],
    ["Signatures", signatures],
    ["Contrats", contrats],
    ["Photos de constat", photos],
    ["Constats de remise", constats],
    ["Versements", encaissements],
    ["Échéances", echeances],
    ["Réservations", reservations],
    ["Pièces justificatives", documents],
    ["Dossiers clients", dossiers],
    ["Comptes clients", comptesSupprimes],
    ["Codes à usage unique", codes],
  ];

  console.log("À SUPPRIMER");
  for (const [libelle, nombre] of aSupprimer) {
    console.log(`  ${String(nombre).padStart(5)}  ${libelle}`);
  }
  console.log(`\n  ${String(motosRetenues).padStart(5)}  motos à remettre en « Disponible »`);

  const [compteurs, fichiers] = await Promise.all([
    prisma.compteurReference.count(),
    compterFichiers(STOCKAGE),
  ]);

  if (TOUT) {
    console.log("\nREMISE À ZÉRO COMPLÈTE (--tout)");
    console.log(`  ${String(compteurs).padStart(5)}  compteurs de références — les numéros repartiront à 0001`);
    console.log(`  ${String(fichiers).padStart(5)}  fichiers de .storage/ — contrats, pièces, constats, signatures`);
  } else {
    console.log(
      `\n  Conservés : ${compteurs} compteur(s) de références et ${fichiers} fichier(s) dans .storage/.` +
        "\n  Ajouter `--tout` pour repartir à 0001 et vider le stockage.",
    );
  }

  console.log("\nÀ CONSERVER");
  for (const u of equipe) {
    console.log(`         ${u.role.padEnd(7)} ${u.telephone ?? u.email ?? "?"}  ${u.nomAffichage ?? ""}`);
  }
  const [boutiques, produits, motos] = await Promise.all([
    prisma.boutique.count(),
    prisma.produit.count(),
    prisma.vehicule.count(),
  ]);
  console.log(`         ${boutiques} boutique(s), ${produits} modèle(s), ${motos} moto(s)`);

  if (!EXECUTER) {
    console.log("\nAperçu seulement. Relancer avec `-- --go` pour supprimer.\n");
    return;
  }

  if (equipe.length === 0) {
    throw new Error(
      "Aucun compte administrateur ni gérant : la purge est refusée, elle laisserait la base sans accès.",
    );
  }

  // Ordre imposé par les clés étrangères : on part des feuilles.
  await prisma.$transaction([
    prisma.contractEvent.deleteMany(),
    prisma.signature.deleteMany(),
    prisma.encaissement.deleteMany(),
    prisma.echeance.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.handoverPhoto.deleteMany(),
    prisma.handover.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.customerDocument.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.user.deleteMany({ where: { role: { notIn: ROLES_CONSERVES } } }),
    prisma.otpCode.deleteMany(),
    // Une moto retenue par un contrat disparu doit retourner au stock.
    prisma.vehicule.updateMany({
      where: { statut: { in: ["RESERVE", "EN_LOCATION"] } },
      data: { statut: "DISPONIBLE" },
    }),
    // Supprimés plutôt que remis à 0 : `prochaineReference` recrée la ligne au
    // premier dossier de l'année, et la série repart proprement à 0001.
    ...(TOUT ? [prisma.compteurReference.deleteMany()] : []),
  ]);

  // Le stockage est vidé APRÈS la transaction : si elle échouait, les lignes
  // désigneraient encore des fichiers, et ceux-ci doivent rester lisibles.
  if (TOUT) {
    const entrees = await fs.readdir(STOCKAGE, { withFileTypes: true }).catch(() => []);
    for (const e of entrees) {
      await fs.rm(path.join(STOCKAGE, e.name), { recursive: true, force: true });
    }
    console.log(`\n  .storage/ vidé (${entrees.length} dossier(s) ou fichier(s) à la racine).`);
    console.log("  Les prochaines références repartiront à 0001.");
  }

  console.log("\nPurge effectuée. Les comptes de l'équipe et la flotte sont intacts.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
