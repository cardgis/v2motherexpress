/**
 * Contrôle du contenu RÉEL des fichiers reçus.
 *
 * Le type MIME annoncé par le navigateur (`File.type`) est une simple
 * déclaration : n'importe quel script peut envoyer une page HTML en la
 * présentant comme « image/jpeg ». Servie ensuite depuis notre domaine, elle
 * s'exécuterait avec les droits de la session du gérant qui l'ouvre. On lit
 * donc les premiers octets (signature de format) et c'est CE type-là qui est
 * retenu et stocké, jamais celui du navigateur.
 */

export type TypeFichier = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf";

const MARQUES_HEIF = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);

function commencePar(octets: Uint8Array, signature: number[], decalage = 0): boolean {
  if (octets.length < decalage + signature.length) return false;
  return signature.every((o, i) => octets[decalage + i] === o);
}

const ascii = (texte: string) => [...texte].map((c) => c.charCodeAt(0));

/** Type déduit des octets, ou `null` si le format n'est pas reconnu. */
export function typeReel(octets: Uint8Array): TypeFichier | null {
  if (commencePar(octets, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (commencePar(octets, ascii("RIFF")) && commencePar(octets, ascii("WEBP"), 8)) return "image/webp";
  if (commencePar(octets, ascii("%PDF-"))) return "application/pdf";

  if (commencePar(octets, ascii("ftyp"), 4) && octets.length >= 12) {
    const marque = String.fromCharCode(...octets.slice(8, 12));
    if (MARQUES_HEIF.has(marque)) return "image/heic";
  }

  return null;
}

export const EXTENSIONS: Record<TypeFichier, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

// ---------------------------------------------------------------------------
// Tracés de signature
// ---------------------------------------------------------------------------

/** Un tracé au doigt pèse quelques dizaines de Ko ; au-delà, c'est suspect. */
const TRACE_MAX_OCTETS = 1024 * 1024;
const TRACE_MIN_OCTETS = 200;

export type ResultatTrace = { ok: true; png: Buffer } | { ok: false; erreur: string };

/**
 * Décode un tracé reçu en data-URL depuis le canevas du navigateur.
 *
 * Plafonné AVANT décodage : une chaîne base64 de 200 Mo ferait sinon tomber
 * le processus en mémoire. Et vérifié APRÈS : `pdf-lib` ne doit recevoir
 * qu'un vrai PNG.
 */
export function decoderTracePng(valeur: unknown): ResultatTrace {
  const texte = typeof valeur === "string" ? valeur : "";
  const base64 = texte.replace(/^data:image\/png;base64,/, "");

  if (!base64) return { ok: false, erreur: "Signature manquante." };
  if (base64.length > Math.ceil((TRACE_MAX_OCTETS * 4) / 3)) {
    return { ok: false, erreur: "Signature trop volumineuse." };
  }

  const png = Buffer.from(base64, "base64");
  if (png.byteLength < TRACE_MIN_OCTETS) {
    return { ok: false, erreur: "Le tracé est trop court. Signez dans le cadre prévu." };
  }
  if (typeReel(png) !== "image/png") {
    return { ok: false, erreur: "Signature illisible." };
  }

  return { ok: true, png };
}
