/**
 * Génère un tracé de signature en PNG, pour les tests de bout en bout.
 *
 * Encode le PNG à la main (en-tête, IHDR, IDAT compressé, IEND) plutôt que
 * d'ajouter une dépendance graphique au projet pour un besoin de test.
 *
 *   node scripts/trace-signature.mjs <fichier.png>
 */

import fs from "node:fs";
import zlib from "node:zlib";

const LARGEUR = 260;
const HAUTEUR = 90;

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const octet of buf) crc = table[(crc ^ octet) & 0xff] ^ (crc >>> 8);
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

// RGBA transparent, sur lequel on trace une signature sombre.
const pixels = Buffer.alloc(LARGEUR * HAUTEUR * 4, 0);

function point(x, y) {
  const px = Math.round(x);
  const py = Math.round(y);
  // Trait épais de 3 pixels, pour rester lisible une fois réduit dans le PDF.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const i = ((py + dy) * LARGEUR + (px + dx)) * 4;
      if (i >= 0 && i + 3 < pixels.length) {
        pixels[i] = 15;
        pixels[i + 1] = 23;
        pixels[i + 2] = 42;
        pixels[i + 3] = 255;
      }
    }
  }
}

// Une courbe cursive plausible plutôt qu'une droite : le test doit ressembler
// à ce que produirait un doigt sur l'écran.
for (let t = 0; t < 1000; t++) {
  const p = t / 1000;
  const x = 20 + p * (LARGEUR - 45);
  const y =
    HAUTEUR / 2 +
    Math.sin(p * Math.PI * 5) * 22 +
    Math.sin(p * Math.PI * 13) * 7 -
    p * 10;
  point(x, y);
}

// Chaque ligne d'un PNG est précédée de son octet de filtre (0 = aucun).
const brut = Buffer.alloc(HAUTEUR * (LARGEUR * 4 + 1));
for (let y = 0; y < HAUTEUR; y++) {
  brut[y * (LARGEUR * 4 + 1)] = 0;
  pixels.copy(brut, y * (LARGEUR * 4 + 1) + 1, y * LARGEUR * 4, (y + 1) * LARGEUR * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(LARGEUR, 0);
ihdr.writeUInt32BE(HAUTEUR, 4);
ihdr[8] = 8; // 8 bits par canal
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  bloc("IHDR", ihdr),
  bloc("IDAT", zlib.deflateSync(brut)),
  bloc("IEND", Buffer.alloc(0)),
]);

const destination = process.argv[2] ?? "trace-signature.png";
fs.writeFileSync(destination, png);
console.log(`${destination} — ${png.length} octets`);
