import Image from "next/image";

/**
 * Image d'un modèle du catalogue.
 *
 * Les fichiers du site (`/assets/…`) passent par l'optimiseur d'images de
 * Next : le navigateur reçoit du WebP à la largeur de son écran, quel que soit
 * le PNG déposé au catalogue — y compris pour les modèles ajoutés plus tard
 * depuis l'administration. Un téléphone ne télécharge plus l'image prévue pour
 * un grand écran.
 *
 * Une adresse externe saisie dans le catalogue n'est pas autorisée par
 * l'optimiseur (domaines non déclarés) : elle est affichée telle quelle
 * plutôt que de casser la page.
 *
 * Remplit son conteneur, qui doit être positionné et dimensionné.
 */
export function ImageProduit({
  src,
  alt,
  sizes,
  className,
  prioritaire = false,
}: {
  src: string;
  alt: string;
  /** Largeur affichée selon l'écran, pour choisir la bonne taille de fichier. */
  sizes: string;
  className?: string;
  /** Image principale du haut de page : chargée avant le reste. */
  prioritaire?: boolean;
}) {
  const locale = src.startsWith("/") && !src.startsWith("//");

  if (!locale) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        loading={prioritaire ? "eager" : "lazy"}
        decoding="async"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      priority={prioritaire}
      style={{ objectFit: "contain" }}
    />
  );
}
