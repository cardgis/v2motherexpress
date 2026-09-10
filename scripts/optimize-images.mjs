// Génère les variantes WebP responsive de public/assets/img
// Usage : npm run optimize:images
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, extname, basename, dirname, sep } from "node:path";
import sharp from "sharp";

const IMG_DIR = join(process.cwd(), "public", "assets", "img");
const MANIFEST = join(process.cwd(), "src", "lib", "image-manifest.ts");

// Largeurs candidates. Une variante n'est générée que si elle est
// plus petite que l'original — on n'upscale jamais.
const BREAKPOINTS = [400, 768, 1200, 1600, 1920];
const MAX_WIDTH = 1920;
const QUALITY = 78;

const SOURCE_EXT = new Set([".png", ".jpg", ".jpeg"]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (SOURCE_EXT.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function widthsFor(originalWidth) {
  const target = Math.min(originalWidth, MAX_WIDTH);
  const widths = BREAKPOINTS.filter((w) => w < target);
  widths.push(target);
  return widths;
}

const files = await walk(IMG_DIR);
files.sort();

const manifest = {};
let bytesBefore = 0;
let bytesAfter = 0;

for (const file of files) {
  const { size: originalSize } = await stat(file);
  const image = sharp(file);
  const { width: originalWidth } = await image.metadata();
  if (!originalWidth) {
    console.warn(`  ! largeur illisible, ignoré : ${relative(process.cwd(), file)}`);
    continue;
  }

  const name = basename(file, extname(file));
  const dir = dirname(file);
  const widths = widthsFor(originalWidth);
  const generated = [];

  for (const width of widths) {
    const outPath = join(dir, `${name}-${width}.webp`);
    const info = await sharp(file)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(outPath);
    generated.push(width);
    bytesAfter += info.size;
  }

  bytesBefore += originalSize;

  // Clé du manifest = chemin public de l'original, ex "/assets/img/header1.png"
  const toPublicPath = (p) => "/" + relative(join(process.cwd(), "public"), p).split(sep).join("/");
  const key = toPublicPath(file);
  manifest[key] = { base: toPublicPath(join(dir, name)), widths: generated };

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`  ${basename(file)}  ${kb(originalSize)} → ${widths.length} variante(s) [${widths.join(", ")}px]`);
}

const body = `// Généré par scripts/optimize-images.mjs — ne pas éditer à la main.
// Associe chaque image source à ses variantes WebP disponibles.

export type ImageVariants = { base: string; widths: number[] };

export const IMAGE_MANIFEST: Record<string, ImageVariants> = ${JSON.stringify(manifest, null, 2)};
`;
await writeFile(MANIFEST, body, "utf8");

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
console.log(`\n  Originaux : ${mb(bytesBefore)}`);
console.log(`  WebP générés (toutes variantes) : ${mb(bytesAfter)}`);
console.log(`  Manifest : ${relative(process.cwd(), MANIFEST)}`);
