/**
 * Driver Azure Blob Storage.
 *
 * Variables : AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER.
 *
 * Côté Azure : conteneur en accès « Privé », et `allowBlobPublicAccess=false`
 * sur le compte de stockage, pour qu'aucune erreur de configuration ne puisse
 * rendre un conteneur public. Région recommandée : France Central, la plus
 * proche du Sénégal parmi celles soumises au RGPD.
 */

import type { ContainerClient } from "@azure/storage-blob";
import { avecPrefixe, variableRequise, type DriverStockage } from "../types";

let conteneur: Promise<ContainerClient> | undefined;

function acces(): Promise<ContainerClient> {
  conteneur ??= import("@azure/storage-blob").then(({ BlobServiceClient }) =>
    BlobServiceClient.fromConnectionString(
      variableRequise("AZURE_STORAGE_CONNECTION_STRING"),
    ).getContainerClient(variableRequise("AZURE_STORAGE_CONTAINER")),
  );
  return conteneur;
}

const blob = async (chemin: string) => (await acces()).getBlockBlobClient(avecPrefixe(chemin));

export const driverAzure: DriverStockage = {
  async lire(chemin) {
    const octets = await (await blob(chemin)).downloadToBuffer();
    return { octets: new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength) };
  },

  async ecrire(chemin, octets, mimeType) {
    await (await blob(chemin)).uploadData(Buffer.from(octets), {
      blobHTTPHeaders: { blobContentType: mimeType },
    });
  },

  async supprimer(chemin) {
    await (await blob(chemin)).deleteIfExists();
  },

  async existe(chemin) {
    return (await blob(chemin)).exists();
  },
};
