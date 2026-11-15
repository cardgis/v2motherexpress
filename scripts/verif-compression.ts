/**
 * Compression des pièces justificatives — ce qu'elle gagne, et surtout ce
 * qu'elle ne doit pas casser.
 *
 *   npm run verif:compression
 *
 * Depuis le 2026-11-15 les pièces sont conservées SANS LIMITE DE DURÉE : ce
 * qui entre dans le stockage y reste. `lib/pieces-compression.ts` ramène donc
 * chaque image à 1600 px en WebP avant de l'écrire. Ce script éprouve les six
 * propriétés sur lesquelles cette conversion peut silencieusement mal tourner.
 *
 * Les trois premières sont des pièges éprouvés :
 *
 *   — L'ORIENTATION. Une photo prise à la verticale porte son orientation
 *     dans l'EXIF, pas dans ses pixels. Convertir sans appliquer cet EXIF
 *     d'abord stocke la pièce COUCHÉE, et personne ne s'en aperçoit avant que
 *     le gérant n'ouvre le dossier.
 *   — LES MÉTADONNÉES. Une photo de téléphone porte souvent les coordonnées
 *     GPS du lieu de la prise de vue — sur une carte d'identité, le domicile
 *     du client. Elles doivent disparaître.
 *   — LE TYPE RÉEL. `lib/fichiers.ts` relit les octets stockés : si la sortie
 *     n'était pas reconnue, la pièce serait refusée à la relecture.
 *
 * LECTURE SEULE : aucune écriture, ni en base ni dans le stockage.
 */

import sharp from "sharp";
import { comprimerPiece } from "../src/lib/pieces-compression";
import { typeReel } from "../src/lib/fichiers";

const SOURCE = "public/assets/img/header1.png";

let ok = 0;
let ko = 0;

function resultat(bon: boolean, libelle: string, detail?: string) {
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (detail) console.log(`         ${detail}`);
}

const ko_ = (n: number) => `${Math.round(n / 1024)} ko`;

async function main() {
  console.log("\nCompression des pièces justificatives\n");

  // ── 1. Le gain, sur une pièce telle que le navigateur l'envoie ───────────
  const envoyee = await sharp(SOURCE).resize({ width: 1800 }).jpeg({ quality: 82 }).toBuffer();
  const piece = await comprimerPiece(new Uint8Array(envoyee), "image/jpeg");
  const gain = Math.round((1 - piece.octets.length / envoyee.length) * 100);
  resultat(
    piece.comprimee && gain >= 30,
    `une pièce de ${ko_(envoyee.length)} tombe à ${ko_(piece.octets.length)} — ${gain} % de moins`,
    gain < 30 ? "on attendait au moins 30 %" : undefined,
  );

  const apres = await sharp(Buffer.from(piece.octets)).metadata();
  resultat(
    (apres.width ?? 0) <= 1600 && (apres.height ?? 0) <= 1600,
    `ramenée à ${apres.width}x${apres.height}, sous 1600 px de côté`,
  );
  resultat(piece.mimeType === "image/webp", "stockée en WebP");

  // ── 2. L'orientation EXIF est APPLIQUÉE, pas perdue ─────────────────────
  // Le cas réel, et il n'est pas intuitif : un téléphone tenu à la VERTICALE
  // enregistre des pixels COUCHÉS, puis pose `orientation: 6` pour dire au
  // lecteur de les redresser d'un quart de tour. Les pixels mentent, l'EXIF
  // dit la vérité — et la conversion jette l'EXIF. Si elle ne redresse pas
  // les pixels d'abord, la carte d'identité est stockée couchée pour
  // toujours.
  const couchee = await sharp(SOURCE).resize({ width: 1200 }).jpeg().toBuffer();
  const commeUnTelephone = await sharp(couchee).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const avantRot = await sharp(commeUnTelephone).metadata();
  const redressee = await comprimerPiece(new Uint8Array(commeUnTelephone), "image/jpeg");
  const apresRot = await sharp(Buffer.from(redressee.octets)).metadata();
  resultat(
    (apresRot.height ?? 0) > (apresRot.width ?? 0) && !apresRot.orientation,
    `orientation appliquée puis oubliée : ${avantRot.width}x${avantRot.height} avec EXIF ${avantRot.orientation} devient ${apresRot.width}x${apresRot.height} sans EXIF`,
    (apresRot.height ?? 0) <= (apresRot.width ?? 0)
      ? "la pièce serait stockée COUCHÉE — il manque `.rotate()` avant la conversion"
      : undefined,
  );

  // ── 3. Les métadonnées, GPS compris, disparaissent ──────────────────────
  const avecGps = await sharp(SOURCE)
    .resize({ width: 1200 })
    // `withExif` n'expose pas l'IFD GPS ; peu importe, le contrôle porte sur
    // la présence de TOUTE métadonnée EXIF, dont le bloc GPS fait partie.
    .withExif({ IFD0: { Copyright: "LME", Make: "Phone" } })
    .jpeg()
    .toBuffer();
  const sansGps = await comprimerPiece(new Uint8Array(avecGps), "image/jpeg");
  const metaGps = await sharp(Buffer.from(sansGps.octets)).metadata();
  resultat(
    !metaGps.exif,
    "aucune métadonnée EXIF ne survit — ni GPS, ni appareil",
    metaGps.exif ? "le domicile du client voyagerait avec la photo de sa carte" : undefined,
  );

  // ── 4. Le type réel reste reconnu par `lib/fichiers.ts` ─────────────────
  resultat(
    typeReel(piece.octets) === "image/webp",
    "les octets stockés sont relus comme du WebP",
  );

  // ── 5. Un PDF passe intact ──────────────────────────────────────────────
  const pdf = new Uint8Array(Buffer.from("%PDF-1.4\n%âãÏÓ\n", "binary"));
  const pdfApres = await comprimerPiece(pdf, "application/pdf");
  resultat(
    pdfApres.octets.length === pdf.length && pdfApres.mimeType === "application/pdf",
    "un PDF traverse sans être touché",
  );

  // ── 6. Une image déjà minuscule ne doit pas GROSSIR ─────────────────────
  const minuscule = await sharp(SOURCE).resize({ width: 120 }).webp({ quality: 55 }).toBuffer();
  const apresMin = await comprimerPiece(new Uint8Array(minuscule), "image/webp");
  resultat(
    apresMin.octets.length <= minuscule.length,
    `une vignette de ${ko_(minuscule.length)} ne grossit pas (${ko_(apresMin.octets.length)})`,
  );

  console.log(`\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "DES ÉCARTS"} — ${ok} OK, ${ko} KO\n`);
  process.exit(ko === 0 ? 0 : 1);
}

void main();
