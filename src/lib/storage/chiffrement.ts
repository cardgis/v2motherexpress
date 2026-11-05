/**
 * Chiffrement applicatif des blobs — AES-256-GCM.
 *
 * ── Pourquoi chiffrer nous-mêmes ───────────────────────────────────────────
 * Tous les fournisseurs (Azure, OVH, AWS, Scaleway) chiffrent déjà les disques.
 * Cela protège contre le vol d'un disque dans leur datacenter, pas contre une
 * clé d'accès qui fuite, un conteneur rendu public par erreur, une sauvegarde
 * mal rangée ou un employé du fournisseur. Ici, le fournisseur ne stocke que
 * du bruit : sans nos clés, une carte d'identité est illisible. C'est aussi
 * ce qui rend le choix de l'hébergeur réversible sans risque.
 *
 * ── Format d'un blob chiffré ───────────────────────────────────────────────
 *   "LMEC" | version (1 o) | long. id clé (1 o) | id clé | long. MIME (1 o) |
 *   MIME | IV (12 o) | tag GCM (16 o) | données chiffrées
 *
 * L'en-tête ET le chemin logique du blob sont authentifiés (données associées
 * GCM) : un blob recopié à la place d'un autre, ou un type MIME altéré, est
 * détecté et refusé au déchiffrement.
 *
 * ── Trousseau et rotation ──────────────────────────────────────────────────
 *   STORAGE_CLES_CHIFFREMENT="k2026b:BASE64,k2026a:BASE64"
 * La PREMIÈRE clé chiffre les nouveaux blobs ; toutes servent à relire. Pour
 * faire tourner : ajouter une clé en tête, redéployer, puis (facultatif)
 * rechiffrer les anciens blobs et retirer l'ancienne clé. Chaque clé fait
 * 32 octets : `openssl rand -base64 32`.
 *
 * Évolution prévue : remplacer ce trousseau en variable d'environnement par
 * un coffre de clés (Azure Key Vault, OVH KMS) sans changer le format.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("LMEC", "ascii");
const VERSION = 1;
const LONGUEUR_IV = 12;
const LONGUEUR_TAG = 16;

interface Cle {
  id: string;
  octets: Buffer;
}

interface Trousseau {
  active: Cle;
  parId: Map<string, Buffer>;
}

let trousseauCache: Trousseau | undefined;
let avertissementDev = false;

function chargerTrousseau(): Trousseau {
  if (trousseauCache) return trousseauCache;

  const brut = process.env.STORAGE_CLES_CHIFFREMENT?.trim();

  if (!brut) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "STORAGE_CLES_CHIFFREMENT doit être défini en production : les pièces " +
          "d'identité ne sont jamais stockées en clair.",
      );
    }
    // Développement sans clé configurée : clé fixe, connue, NON secrète.
    if (!avertissementDev) {
      console.warn("[stockage] STORAGE_CLES_CHIFFREMENT absent — clé de développement utilisée.");
      avertissementDev = true;
    }
    const octets = createHash("sha256").update("lme-cle-de-developpement").digest();
    trousseauCache = { active: { id: "dev", octets }, parId: new Map([["dev", octets]]) };
    return trousseauCache;
  }

  const cles: Cle[] = brut.split(",").map((entree) => {
    const [id, base64] = entree.trim().split(":");
    if (!id || !base64 || !/^[a-zA-Z0-9_-]{1,32}$/.test(id)) {
      throw new Error("STORAGE_CLES_CHIFFREMENT : format attendu « id:base64,id:base64 ».");
    }
    const octets = Buffer.from(base64, "base64");
    if (octets.length !== 32) {
      throw new Error(`STORAGE_CLES_CHIFFREMENT : la clé « ${id} » doit faire 32 octets.`);
    }
    return { id, octets };
  });

  trousseauCache = { active: cles[0]!, parId: new Map(cles.map((c) => [c.id, c.octets])) };
  return trousseauCache;
}

function donneesAssociees(entete: Buffer, chemin: string): Buffer {
  return Buffer.concat([entete, Buffer.from(`\0${chemin}`, "utf-8")]);
}

export function estChiffre(octets: Uint8Array): boolean {
  return octets.length > MAGIC.length && Buffer.from(octets.subarray(0, MAGIC.length)).equals(MAGIC);
}

export function chiffrer(chemin: string, clair: Uint8Array, mimeType: string): Uint8Array {
  const { active } = chargerTrousseau();
  const id = Buffer.from(active.id, "ascii");
  const mime = Buffer.from(mimeType.slice(0, 255), "ascii");

  const entete = Buffer.concat([
    MAGIC,
    Buffer.from([VERSION, id.length]),
    id,
    Buffer.from([mime.length]),
    mime,
  ]);

  const iv = randomBytes(LONGUEUR_IV);
  const chiffreur = createCipheriv("aes-256-gcm", active.octets, iv);
  chiffreur.setAAD(donneesAssociees(entete, chemin));
  const donnees = Buffer.concat([chiffreur.update(clair), chiffreur.final()]);

  return Buffer.concat([entete, iv, chiffreur.getAuthTag(), donnees]);
}

export function dechiffrer(chemin: string, blob: Uint8Array): { octets: Uint8Array; mimeType: string } {
  const b = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
  let pos = MAGIC.length;

  const version = b[pos++];
  if (version !== VERSION) throw new Error(`Blob chiffré de version inconnue (${version}).`);

  const longueurId = b[pos++]!;
  const id = b.subarray(pos, pos + longueurId).toString("ascii");
  pos += longueurId;

  const longueurMime = b[pos++]!;
  const mimeType = b.subarray(pos, pos + longueurMime).toString("ascii");
  pos += longueurMime;

  const entete = b.subarray(0, pos);
  const iv = b.subarray(pos, pos + LONGUEUR_IV);
  pos += LONGUEUR_IV;
  const tag = b.subarray(pos, pos + LONGUEUR_TAG);
  pos += LONGUEUR_TAG;

  const cle = chargerTrousseau().parId.get(id);
  if (!cle) throw new Error(`Clé de chiffrement « ${id} » absente du trousseau.`);

  const dechiffreur = createDecipheriv("aes-256-gcm", cle, iv);
  dechiffreur.setAAD(donneesAssociees(entete, chemin));
  dechiffreur.setAuthTag(tag);

  // `final()` lève une exception si un seul octet a été modifié.
  const octets = Buffer.concat([dechiffreur.update(b.subarray(pos)), dechiffreur.final()]);
  return { octets: new Uint8Array(octets), mimeType };
}
