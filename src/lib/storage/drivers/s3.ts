/**
 * Driver S3 — tout stockage objet compatible S3.
 *
 *   OVHcloud     S3_ENDPOINT=https://s3.gra.io.cloud.ovh.net   S3_REGION=gra
 *   Scaleway     S3_ENDPOINT=https://s3.fr-par.scw.cloud      S3_REGION=fr-par
 *   AWS          S3_ENDPOINT vide                             S3_REGION=eu-west-3
 *   MinIO local  S3_ENDPOINT=http://localhost:9000            S3_FORCE_PATH_STYLE=true
 *
 * Variables : S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE, S3_CHIFFREMENT_SERVEUR (facultatif,
 * ex. « AES256 », en plus du chiffrement applicatif).
 *
 * Le bucket doit être PRIVÉ, sans aucune politique d'accès public.
 */

import type { S3Client } from "@aws-sdk/client-s3";
import { avecPrefixe, variableRequise, type DriverStockage } from "../types";

type Sdk = typeof import("@aws-sdk/client-s3");

let connexion: Promise<{ sdk: Sdk; client: S3Client }> | undefined;

/** Un seul client par processus : il mutualise les connexions HTTP. */
function s3() {
  connexion ??= import("@aws-sdk/client-s3").then((sdk) => {
    const cle = process.env.S3_ACCESS_KEY_ID;
    return {
      sdk,
      client: new sdk.S3Client({
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        // Sans clé explicite, le SDK recourt à l'identité de la machine
        // (rôle IAM) — préférable à une clé stockée quand l'hébergeur le permet.
        credentials: cle
          ? { accessKeyId: cle, secretAccessKey: variableRequise("S3_SECRET_ACCESS_KEY") }
          : undefined,
        // Les sommes de contrôle ajoutées par défaut depuis 2025 ne sont pas
        // reconnues par tous les fournisseurs compatibles S3.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        maxAttempts: 3,
      }),
    };
  });
  return connexion;
}

const bucket = () => variableRequise("S3_BUCKET");

function introuvable(erreur: unknown): boolean {
  const e = erreur as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound" || e?.name === "NoSuchKey";
}

export const driverS3: DriverStockage = {
  async lire(chemin) {
    const { sdk, client } = await s3();
    const reponse = await client.send(
      new sdk.GetObjectCommand({ Bucket: bucket(), Key: avecPrefixe(chemin) }),
    );
    if (!reponse.Body) throw new Error(`Blob vide : ${chemin}`);
    return { octets: await reponse.Body.transformToByteArray(), mimeType: reponse.ContentType };
  },

  async ecrire(chemin, octets, mimeType) {
    const { sdk, client } = await s3();
    const chiffrementServeur = process.env.S3_CHIFFREMENT_SERVEUR as
      | import("@aws-sdk/client-s3").ServerSideEncryption
      | undefined;

    await client.send(
      new sdk.PutObjectCommand({
        Bucket: bucket(),
        Key: avecPrefixe(chemin),
        Body: octets,
        ContentType: mimeType,
        ...(chiffrementServeur ? { ServerSideEncryption: chiffrementServeur } : {}),
      }),
    );
  },

  async supprimer(chemin) {
    const { sdk, client } = await s3();
    await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket(), Key: avecPrefixe(chemin) }));
  },

  async existe(chemin) {
    const { sdk, client } = await s3();
    try {
      await client.send(new sdk.HeadObjectCommand({ Bucket: bucket(), Key: avecPrefixe(chemin) }));
      return true;
    } catch (erreur) {
      if (introuvable(erreur)) return false;
      throw erreur;
    }
  },
};
