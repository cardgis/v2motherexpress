/**
 * Contrôle du stockage chiffré, sur le fournisseur désigné par STORAGE_DRIVER.
 *
 *   STORAGE_DRIVER=local npm run verif:stockage
 *   STORAGE_DRIVER=s3    npm run verif:stockage    (docker compose --profile s3 up -d)
 *   STORAGE_DRIVER=azure npm run verif:stockage    (docker compose --profile azure up -d)
 *
 * Vérifie, sur le VRAI fournisseur et pas sur un simulacre :
 *   — aller-retour exact des octets et du type MIME ;
 *   — le fournisseur ne voit que du chiffré (aucun octet en clair) ;
 *   — un octet altéré est détecté ;
 *   — un blob recopié sous un autre chemin est refusé ;
 *   — suppression effective.
 *
 * Rotation de clé (deux lancements, trousseau différent) :
 *   npm run verif:stockage -- --ecrire verif/rotation.bin
 *   STORAGE_CLES_CHIFFREMENT="neuve:...,ancienne:..." npm run verif:stockage -- --lire verif/rotation.bin <sha256>
 */

// `.env.local` UNIQUEMENT : ce script ne doit jamais hériter d'un accès de production.
import "./env-local";

import { randomBytes } from "node:crypto";
import { blobExiste, ecrireBlob, lireBlob, sha256, supprimerBlob } from "../src/lib/storage";
import type { DriverStockage } from "../src/lib/storage/types";

let echecs = 0;

function verifie(libelle: string, condition: boolean) {
  console.log(`${condition ? "  ✓" : "  ✗"} ${libelle}`);
  if (!condition) echecs++;
}

async function rejette(promesse: Promise<unknown>): Promise<boolean> {
  try {
    await promesse;
    return false;
  } catch {
    return true;
  }
}

async function driverBrut(): Promise<DriverStockage> {
  switch (process.env.STORAGE_DRIVER ?? "local") {
    case "s3":
      return (await import("../src/lib/storage/drivers/s3")).driverS3;
    case "azure": {
      // L'émulateur démarre sans conteneur : on le crée, privé.
      const { BlobServiceClient } = await import("@azure/storage-blob");
      await BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!)
        .getContainerClient(process.env.AZURE_STORAGE_CONTAINER!)
        .createIfNotExists();
      return (await import("../src/lib/storage/drivers/azure")).driverAzure;
    }
    default:
      return (await import("../src/lib/storage/drivers/local")).driverLocal;
  }
}

async function main() {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  const args = process.argv.slice(2);

  // ── Mode rotation ──────────────────────────────────────────────────────────
  if (args[0] === "--ecrire") {
    const octets = randomBytes(4096);
    const { sha256: empreinte } = await ecrireBlob(args[1]!, octets, "application/pdf");
    console.log(empreinte);
    return;
  }
  if (args[0] === "--lire") {
    const blob = await lireBlob(args[1]!);
    verifie("blob écrit avec l'ancienne clé relu avec le nouveau trousseau", sha256(blob.octets) === args[2]);
    process.exitCode = echecs ? 1 : 0;
    return;
  }

  // ── Contrôle complet ──────────────────────────────────────────────────────
  console.log(`\nStockage chiffré — driver « ${driver} »\n`);
  const brut = await driverBrut();

  const base = `verif/${Date.now()}`;
  const chemin = `${base}/piece.jpg`;
  // Contenu reconnaissable : un en-tête JPEG suivi d'une phrase en clair.
  const marqueur = Buffer.from("CARTE NATIONALE D'IDENTITE — DIOUF Papa Demba — 1 234 5678 90123");
  const clair = new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), marqueur, randomBytes(200_000)]));

  const ecrit = await ecrireBlob(chemin, clair, "image/jpeg");
  verifie("empreinte SHA-256 calculée sur le contenu en clair", ecrit.sha256 === sha256(clair));
  verifie("le blob existe", await blobExiste(chemin));

  const relu = await lireBlob(chemin);
  verifie("octets relus identiques", Buffer.from(relu.octets).equals(Buffer.from(clair)));
  verifie("type MIME restitué", relu.mimeType === "image/jpeg");

  const stocke = Buffer.from((await brut.lire(chemin)).octets);
  verifie("le fournisseur stocke un blob chiffré (en-tête LMEC)", stocke.subarray(0, 4).toString("ascii") === "LMEC");
  verifie("aucun texte en clair chez le fournisseur", !stocke.includes(marqueur));
  verifie("aucune signature JPEG en clair chez le fournisseur", !stocke.includes(Buffer.from([0xff, 0xd8, 0xff, 0xe0])));

  const altere = Buffer.from(stocke);
  altere[altere.length - 10]! ^= 0x01;
  await brut.ecrire(`${base}/altere.jpg`, altere, "application/octet-stream");
  verifie("un seul bit modifié → lecture refusée", await rejette(lireBlob(`${base}/altere.jpg`)));

  await brut.ecrire(`${base}/autre-client.jpg`, stocke, "application/octet-stream");
  verifie("blob recopié sous un autre chemin → lecture refusée", await rejette(lireBlob(`${base}/autre-client.jpg`)));

  verifie("chemin remontant l'arborescence refusé", await rejette(lireBlob("../.env.local")));

  for (const c of [chemin, `${base}/altere.jpg`, `${base}/autre-client.jpg`]) await supprimerBlob(c);
  verifie("suppression effective", !(await blobExiste(chemin)));

  console.log(echecs ? `\n${echecs} échec(s).\n` : "\nTout est conforme.\n");
  process.exitCode = echecs ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
