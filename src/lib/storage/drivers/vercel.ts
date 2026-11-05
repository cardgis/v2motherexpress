/**
 * Driver Vercel Blob — le stockage de production (décision d'Alexandre,
 * 2026-11-05 : « je reste que sur vercel »).
 *
 * ── Accès PRIVÉ, et c'est récent ───────────────────────────────────────────
 * La version 2 du SDK permet `access: "private"` : le blob exige alors une
 * authentification pour être lu, et son URL seule ne donne rien. La version
 * précédente n'offrait que des URL publiques non devinables, ce qui obligeait
 * à faire reposer toute la confidentialité sur le chiffrement applicatif.
 *
 * Trois couches protègent donc désormais les pièces d'identité, là où il n'y
 * en avait qu'une et demie :
 *   1. l'accès au blob est refusé sans jeton ;
 *   2. le contenu est chiffré par l'application AVANT d'arriver ici
 *      (`index.ts` passe `chiffrer(...)`), et la clé ne quitte jamais nos
 *      variables d'environnement ;
 *   3. le type MIME est générisé en `application/octet-stream` : rien ne dit
 *      même qu'il s'agit d'un PDF ou d'une photo.
 *
 * Le chemin reste préfixé d'une empreinte salée. Ce n'est plus la barrière
 * principale — l'accès privé l'est — mais une couche qui ne coûte rien.
 */

import { createHash } from "node:crypto";
import type { DriverStockage } from "../types";

/** Tous les appels partagent le même niveau d'accès : jamais public, ici. */
const ACCES = "private" as const;

/**
 * Préfixe dérivé d'un sel, pour qu'un chemin connu ne permette pas de deviner
 * ses voisins. Obligatoire en production : se dégrader en silence sur un
 * stockage de pièces d'identité n'est pas acceptable, même quand l'accès privé
 * rend l'énumération inoffensive.
 */
function cle(chemin: string): string {
  const sel = process.env.STORAGE_PATH_SALT;

  if (!sel) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        'STORAGE_PATH_SALT est obligatoire avec STORAGE_DRIVER="vercel". openssl rand -hex 16',
      );
    }
    return chemin;
  }

  const empreinte = createHash("sha256").update(sel + chemin).digest("hex").slice(0, 16);
  return `${empreinte}/${chemin}`;
}

export const driverVercel: DriverStockage = {
  async lire(chemin) {
    const { get } = await import("@vercel/blob");
    const resultat = await get(cle(chemin), { access: ACCES });

    // `null` : le blob n'existe pas. 304 : non modifié, donc sans corps — ce
    // qui ne peut pas arriver ici puisqu'on n'envoie aucune requête
    // conditionnelle, mais le type l'autorise et on ne devine pas.
    if (!resultat || resultat.statusCode !== 200) {
      throw new Error(`Blob illisible : ${chemin}`);
    }

    const octets = new Uint8Array(await new Response(resultat.stream).arrayBuffer());
    return { octets, mimeType: resultat.blob.contentType };
  },

  async ecrire(chemin, octets, mimeType) {
    const { put } = await import("@vercel/blob");
    await put(cle(chemin), Buffer.from(octets), {
      access: ACCES,
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  },

  async supprimer(chemin) {
    const { del } = await import("@vercel/blob");
    // `del` accepte un chemin : plus besoin de résoudre l'URL par `head`.
    await del(cle(chemin));
  },

  async existe(chemin) {
    const { head } = await import("@vercel/blob");
    return head(cle(chemin))
      .then(() => true)
      .catch(() => false);
  },
};
