import { IMAGE_MANIFEST } from "./image-manifest";

export type ResponsiveImageProps = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

/**
 * Résout une image source (`/assets/img/header1.png`) vers ses variantes WebP.
 *
 * Les variantes sont produites par `npm run optimize:images`. Si l'image n'est
 * pas dans le manifest — image externe, upload récent, chemin inattendu — on
 * renvoie la source d'origine inchangée plutôt que de casser l'affichage.
 *
 * `sizes` décrit la largeur d'affichage réelle pour que le navigateur puisse
 * choisir la plus petite variante suffisante. Sans lui, il suppose 100vw.
 */
export function responsiveImage(src: string, sizes?: string): ResponsiveImageProps {
  const key = src.replace(/^assets\//, "/assets/");
  const entry = IMAGE_MANIFEST[key];
  if (!entry) return { src };

  const widest = entry.widths[entry.widths.length - 1];
  return {
    src: `${entry.base}-${widest}.webp`,
    srcSet: entry.widths.map((w) => `${entry.base}-${w}.webp ${w}w`).join(", "),
    sizes,
  };
}
