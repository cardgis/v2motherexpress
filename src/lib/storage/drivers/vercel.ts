/**
 * Driver Vercel Blob — le stockage retenu pour la production (décision
 * d'Alexandre, 2026-11-05 : « je reste que sur vercel »).
 *
 * ── Pourquoi c'est défendable ──────────────────────────────────────────────
 * Vercel Blob n'offre que des URL PUBLIQUES, non devinables. Trois couches le
 * rendent acceptable pour des pièces d'identité :
 *   1. le contenu est chiffré par l'application AVANT d'arriver ici
 *      (`index.ts` passe `chiffrer(...)` au pilote) : une URL qui fuiterait ne
 *      livrerait que du bruit, et la clé ne quitte jamais nos variables ;
 *   2. le type MIME est générisé en `application/octet-stream` : rien ne dit
 *      même qu'il s'agit d'un PDF ou d'une photo ;
 *   3. le chemin est préfixé par une empreinte salée, donc une URL connue ne
 *      permet pas de deviner ses voisines.
 *
 * ── Ce qu'on perd quand même, et il faut le savoir ─────────────────────────
 * Un conteneur réellement privé (s3, azure) ne livrerait RIEN à une URL
 * devinée ; ici il livrerait du chiffré. La défense est donc d'une couche plus
 * mince — acceptable, pas équivalent. Si la CDP sénégalaise exigeait un jour un
 * stockage à accès restreint, `STORAGE_DRIVER="s3"` suffit, sans toucher au
 * code métier.
 */

import { createHash } from "node:crypto";
import type { DriverStockage } from "../types";

/**
 * Préfixe dérivé d'un sel : même si une URL fuitait, elle ne permettrait pas
 * de deviner les chemins voisins.
 *
 * Sans sel, les chemins redeviennent PRÉVISIBLES — et sur des URL publiques,
 * prévisible veut dire énumérable : on pourrait aspirer tous les blobs chiffrés
 * sans jamais deviner une seule adresse. C'est pourquoi l'absence de sel est
 * une ERREUR en production, et non une dégradation silencieuse. En
 * développement, le repli reste commode et sans enjeu.
 */
function cle(chemin: string): string {
  const sel = process.env.STORAGE_PATH_SALT;

  if (!sel) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "STORAGE_PATH_SALT est obligatoire avec STORAGE_DRIVER=\"vercel\" : sans lui, " +
          "les chemins des blobs sont prévisibles alors que leurs URL sont publiques. " +
          "openssl rand -hex 16",
      );
    }
    return chemin;
  }

  const empreinte = createHash("sha256").update(sel + chemin).digest("hex").slice(0, 16);
  return `${empreinte}/${chemin}`;
}

export const driverVercel: DriverStockage = {
  async lire(chemin) {
    const { head } = await import("@vercel/blob");
    const infos = await head(cle(chemin));
    const reponse = await fetch(infos.url, { signal: AbortSignal.timeout(15_000) });
    if (!reponse.ok) throw new Error(`Blob illisible : ${chemin}`);
    return { octets: new Uint8Array(await reponse.arrayBuffer()), mimeType: infos.contentType };
  },

  async ecrire(chemin, octets, mimeType) {
    const { put } = await import("@vercel/blob");
    await put(cle(chemin), Buffer.from(octets), {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  },

  async supprimer(chemin) {
    const { del, head } = await import("@vercel/blob");
    const infos = await head(cle(chemin)).catch(() => null);
    if (infos) await del(infos.url);
  },

  async existe(chemin) {
    const { head } = await import("@vercel/blob");
    return head(cle(chemin))
      .then(() => true)
      .catch(() => false);
  },
};
