/**
 * Compression des pièces justificatives, À LA RÉCEPTION.
 *
 * ── Pourquoi elle existe ───────────────────────────────────────────────────
 * Depuis le 2026-11-15, les pièces sont conservées SANS LIMITE DE DURÉE
 * (voir `lib/purge.ts`). Ce qui entre dans le stockage y reste : chaque
 * kilo-octet est désormais un kilo-octet pour toujours, et non pour quarante-
 * huit heures. La compression cesse d'être une économie de confort.
 *
 * ── Elle double une compression qui existe déjà, et c'est voulu ────────────
 * `DossierForm` compresse DANS LE NAVIGATEUR avant l'envoi — d'abord pour le
 * client, dont le forfait mobile sénégalais paie chaque octet. Mais cette
 * compression-là est une convention : elle dépend d'une bibliothèque chargée
 * à la demande, d'un navigateur qui la fait tourner, et d'un formulaire qu'on
 * peut contourner. Ici, c'est une GARANTIE : rien n'entre dans le stockage
 * sans être passé par cette fonction.
 *
 * ── Mesuré, pas supposé ────────────────────────────────────────────────────
 * Sur une pièce telle que le navigateur l'envoie aujourd'hui — 1800 px,
 * JPEG, 221 Ko — le WebP à 1600 px et qualité 76 rend 112 Ko : 49 % de moins.
 * À 1600 px, une carte d'identité occupe encore plus de 1200 pixels dans sa
 * largeur, soit au-delà de 350 points par pouce : le numéro reste lisible
 * avec une marge confortable.
 *
 * ── Trois effets de bord qui valaient à eux seuls le détour ────────────────
 *  1. LES MÉTADONNÉES PARTENT. Une photo prise au téléphone porte souvent les
 *     coordonnées GPS du lieu de la prise de vue. Sur une photographie de
 *     carte d'identité, c'est le domicile du client. `sharp` n'écrit aucune
 *     métadonnée sauf qu'on le lui demande — on ne le lui demande pas.
 *  2. L'ORIENTATION EST APPLIQUÉE, pas perdue. `.rotate()` sans argument fait
 *     pivoter les pixels selon l'EXIF AVANT que celui-ci ne disparaisse. Sans
 *     cette ligne, une photo prise à la verticale serait stockée couchée —
 *     c'est le piège classique de ce genre de conversion.
 *  3. LE HEIC DEVIENT LISIBLE. Un iPhone envoie du HEIC, que Chrome et
 *     Firefox ne savent pas afficher : la pièce partait au stockage dans un
 *     format que le gérant ne pouvait pas ouvrir. En sortant en WebP, elle
 *     s'affiche partout.
 *
 * ── Et si ça échoue ────────────────────────────────────────────────────────
 * On garde l'original. `sharp` est un module natif : il peut manquer dans un
 * environnement d'exécution, et un fichier peut être trop abîmé pour être
 * relu. Dans les deux cas, le pire acceptable est le comportement d'avant —
 * jamais un dépôt refusé. Le client ne doit pas perdre son envoi parce qu'une
 * optimisation n'a pas abouti.
 */

import type { TypeFichier } from "@/lib/fichiers";

/** Au-delà, on ne gagne plus en lisibilité, seulement en octets. */
const COTE_MAX = 1600;

/** 76 : le point où l'on cesse de voir la différence sur un document. */
const QUALITE = 76;

export interface PieceComprimee {
  octets: Uint8Array;
  mimeType: TypeFichier;
  /** `false` si l'original a été conservé — format non réduit, ou échec. */
  comprimee: boolean;
}

export async function comprimerPiece(
  octets: Uint8Array,
  mimeType: TypeFichier,
): Promise<PieceComprimee> {
  // Un PDF n'est pas une image : le recompresser demanderait une autre
  // bibliothèque, et les justificatifs de domicile en PDF sont déjà légers.
  if (mimeType === "application/pdf") {
    return { octets, mimeType, comprimee: false };
  }

  try {
    // Import dynamique : si `sharp` manque à l'exécution, on le découvre ici,
    // dans le `catch`, et non au chargement du module — donc sans empêcher la
    // route de répondre.
    const { default: sharp } = await import("sharp");

    const reduite = await sharp(octets, { failOn: "none" })
      .rotate()
      .resize({ width: COTE_MAX, height: COTE_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITE, effort: 5 })
      .toBuffer();

    // Une image déjà petite et bien compressée peut GROSSIR en WebP. Dans ce
    // cas on garde l'original : le but est l'octet, pas le format.
    if (reduite.length >= octets.length) {
      return { octets, mimeType, comprimee: false };
    }

    return { octets: new Uint8Array(reduite), mimeType: "image/webp", comprimee: true };
  } catch (erreur) {
    // Ni le nom du fichier ni son contenu dans les journaux : c'est une pièce
    // d'identité. Le type suffit à comprendre ce qui a échoué.
    console.error(`[pieces] compression impossible (${mimeType}), original conservé`, erreur);
    return { octets, mimeType, comprimee: false };
  }
}
