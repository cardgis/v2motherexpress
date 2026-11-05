/**
 * Génère des photos de test pour l'état des lieux.
 *
 * Chaque angle reçoit une couleur et une étiquette différentes, afin de
 * vérifier d'un coup d'œil, sur le constat produit, que chaque photo est
 * bien placée dans sa case.
 *
 *   node scripts/photo-test.mjs <dossier>
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const LARGEUR = 320;
const HAUTEUR = 240;

const ANGLES = [
  { cle: "avant", couleur: [220, 38, 38] },
  { cle: "arriere", couleur: [22, 163, 74] },
  { cle: "gauche", couleur: [37, 99, 235] },
  { cle: "droite", couleur: [217, 119, 6] },
  { cle: "compteur", couleur: [109, 40, 217] },
  { cle: "chassis", couleur: [15, 118, 110] },
];

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const o of buf) crc = table[(crc ^ o) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function bloc(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, "latin1"), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, controle]);
}

function image(couleur, index) {
  const pixels = Buffer.alloc(LARGEUR * HAUTEUR * 3);

  for (let y = 0; y < HAUTEUR; y++) {
    for (let x = 0; x < LARGEUR; x++) {
      const i = (y * LARGEUR + x) * 3;
      // Dégradé, plus un damier léger : une image unie compresse trop bien
      // pour éprouver sérieusement l'incrustation dans le PDF.
      const attenuation = 0.55 + (y / HAUTEUR) * 0.45;
      const damier = ((x >> 4) + (y >> 4)) % 2 === 0 ? 1 : 0.88;
      pixels[i] = Math.round(couleur[0] * attenuation * damier);
      pixels[i + 1] = Math.round(couleur[1] * attenuation * damier);
      pixels[i + 2] = Math.round(couleur[2] * attenuation * damier);
    }
  }

  // Barres blanches pour distinguer les angles à l'œil sur le constat.
  for (let n = 0; n <= index; n++) {
    for (let y = 20; y < 50; y++) {
      for (let x = 20 + n * 26; x < 40 + n * 26; x++) {
        const i = (y * LARGEUR + x) * 3;
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
      }
    }
  }

  const brut = Buffer.alloc(HAUTEUR * (LARGEUR * 3 + 1));
  for (let y = 0; y < HAUTEUR; y++) {
    brut[y * (LARGEUR * 3 + 1)] = 0;
    pixels.copy(brut, y * (LARGEUR * 3 + 1) + 1, y * LARGEUR * 3, (y + 1) * LARGEUR * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(LARGEUR, 0);
  ihdr.writeUInt32BE(HAUTEUR, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", zlib.deflateSync(brut)),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

const sortie = process.argv[2] ?? "photos-test";
fs.mkdirSync(sortie, { recursive: true });

for (const [i, a] of ANGLES.entries()) {
  const destination = path.join(sortie, `${a.cle}.png`);
  fs.writeFileSync(destination, image(a.couleur, i));
  console.log(`${a.cle}.png`);
}
