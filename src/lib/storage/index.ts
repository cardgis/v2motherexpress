/**
 * Stockage des pièces d'identité, contrats PDF, photos et tracés de signature.
 *
 * ── Trois règles de sécurité ───────────────────────────────────────────────
 * 1. AUCUNE URL de blob n'est jamais exposée. Cette couche ne sait que lire et
 *    écrire des octets ; tout affichage passe par une route serveur qui
 *    vérifie l'autorisation avant de relayer le flux.
 * 2. TOUT est chiffré par l'application (AES-256-GCM, voir `chiffrement.ts`)
 *    avant de quitter le serveur. Le fournisseur ne voit que du bruit.
 * 3. Les chemins sont validés : un identifiant mal construit ne peut pas
 *    remonter l'arborescence.
 *
 * ── Fournisseurs (STORAGE_DRIVER) ──────────────────────────────────────────
 *   local   dossier .storage/ — développement
 *   s3      tout stockage compatible S3 : OVHcloud Object Storage, Scaleway,
 *           AWS S3, Cloudflare R2, MinIO auto-hébergé
 *   azure   Azure Blob Storage
 *   vercel  Vercel Blob — hébergement actuel du site vitrine
 *
 * Le code métier ne connaît que les fonctions exportées ici : changer
 * d'hébergeur est une affaire de variables d'environnement et de copie des
 * blobs, pas de réécriture.
 */

import { createHash } from "node:crypto";
import { chiffrer, dechiffrer, estChiffre } from "./chiffrement";
import type { Blob, DriverStockage } from "./types";

export type { Blob, DriverStockage };

// ---------------------------------------------------------------------------
// Validation des chemins
// ---------------------------------------------------------------------------

function verifierChemin(chemin: string): string {
  const propre = chemin.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!propre || propre.length > 512 || propre.includes("..") || propre.includes("\0")) {
    throw new Error("Chemin de stockage invalide");
  }
  if (!/^[a-zA-Z0-9/_.-]+$/.test(propre)) {
    throw new Error("Chemin de stockage invalide");
  }
  return propre;
}

// ---------------------------------------------------------------------------
// Sélection du driver
// ---------------------------------------------------------------------------

let driverCharge: Promise<DriverStockage> | undefined;

/**
 * Chargement DYNAMIQUE et paresseux : seul le SDK du fournisseur choisi est
 * chargé en mémoire, et le driver disque (qui trace le dossier du projet) ne
 * se retrouve jamais dans le bundle de production.
 */
function driver(): Promise<DriverStockage> {
  driverCharge ??= (async () => {
    const nom = process.env.STORAGE_DRIVER ?? "local";
    switch (nom) {
      case "local":
        return (await import("./drivers/local")).driverLocal;
      case "s3":
        return (await import("./drivers/s3")).driverS3;
      case "azure":
        return (await import("./drivers/azure")).driverAzure;
      case "vercel":
        return (await import("./drivers/vercel")).driverVercel;
      default:
        throw new Error(`STORAGE_DRIVER inconnu : ${nom}`);
    }
  })();
  return driverCharge;
}

/**
 * Blobs écrits en clair avant l'introduction du chiffrement : relisibles en
 * développement seulement. En production, un blob non chiffré est anormal —
 * il est refusé plutôt que servi.
 */
function accepterNonChiffre(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.STORAGE_ACCEPTER_NON_CHIFFRE !== "non";
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export async function lireBlob(chemin: string): Promise<Blob> {
  const propre = verifierChemin(chemin);
  const brut = await (await driver()).lire(propre);

  if (estChiffre(brut.octets)) return dechiffrer(propre, brut.octets);

  if (!accepterNonChiffre()) throw new Error(`Blob non chiffré refusé : ${propre}`);
  return { octets: brut.octets, mimeType: brut.mimeType ?? "application/octet-stream" };
}

/**
 * Chiffre, écrit, et retourne l'empreinte SHA-256 du contenu EN CLAIR.
 * L'empreinte est stockée en base : elle atteste de l'intégrité d'une pièce
 * justificative ou d'un contrat indépendamment du chiffrement.
 */
export async function ecrireBlob(
  chemin: string,
  octets: Uint8Array,
  mimeType: string,
): Promise<{ chemin: string; sha256: string; taille: number }> {
  const propre = verifierChemin(chemin);
  await (await driver()).ecrire(propre, chiffrer(propre, octets, mimeType), "application/octet-stream");
  return { chemin, sha256: sha256(octets), taille: octets.byteLength };
}

export async function supprimerBlob(chemin: string): Promise<void> {
  return (await driver()).supprimer(verifierChemin(chemin));
}

export async function blobExiste(chemin: string): Promise<boolean> {
  return (await driver()).existe(verifierChemin(chemin));
}

export function sha256(octets: Uint8Array | Buffer): string {
  return createHash("sha256").update(octets).digest("hex");
}
