/**
 * Moteur de composition des actes — La Mother Express.
 *
 * Petite couche de typographie au-dessus de pdf-lib : titres, articles,
 * paragraphes justifiés au fil du texte, listes à puces, champs, cases à
 * cocher et blocs de signature. Elle gère seule les retours à la ligne et les
 * sauts de page, de sorte que chaque modèle de contrat s'écrive comme le
 * document se lit, sans jamais manipuler de coordonnées.
 *
 * ── Choix de police ────────────────────────────────────────────────────────
 * Times est la police à empattements des 14 polices standard du format PDF.
 * Elle reproduit fidèlement l'aspect des actes Word existants sans avoir à
 * embarquer de fichier de fonte, ce qui garde les PDF légers — important pour
 * un client qui les télécharge en 3G.
 *
 * ── Encodage ───────────────────────────────────────────────────────────────
 * Les polices standard utilisent WinAnsi, qui couvre le français mais pas
 * certains signes typographiques (cases à cocher, espaces insécables fines).
 * `securiser()` les remplace en amont : sans cela, pdf-lib lève une exception
 * au milieu d'une génération et le contrat n'est jamais produit.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** A4 en points PostScript. */
const LARGEUR = 595.28;
const HAUTEUR = 841.89;

const MARGE_GAUCHE = 62;
const MARGE_DROITE = 62;
const MARGE_HAUT = 62;
const MARGE_BAS = 58;

const LARGEUR_UTILE = LARGEUR - MARGE_GAUCHE - MARGE_DROITE;

const NOIR = rgb(0, 0, 0);
const GRIS = rgb(0.42, 0.42, 0.42);
const GRIS_FILET = rgb(0.75, 0.75, 0.75);

/**
 * Signes absents de WinAnsi, remplacés par un équivalent imprimable.
 * Les cases à cocher sont dessinées, jamais écrites — voir `cases()`.
 */
const REMPLACEMENTS: [RegExp, string][] = [
  [/☐|☑|☒/g, "[ ]"], // cases à cocher résiduelles
  [/ | | /g, " "], // espaces fines et insécables
  [/•/g, "-"], // puce (les listes dessinent la leur)
  [/→/g, "->"],
  [/œ/g, "oe"],
  [/Œ/g, "OE"],
];

export function securiser(texte: string): string {
  let sortie = texte ?? "";
  for (const [motif, remplacement] of REMPLACEMENTS) {
    sortie = sortie.replace(motif, remplacement);
  }
  // Filet de sécurité : tout caractère hors Latin-1 restant est retiré plutôt
  // que de faire échouer la génération complète de l'acte.
  return sortie.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

export interface OptionsTexte {
  taille?: number;
  gras?: boolean;
  italique?: boolean;
  gris?: boolean;
  interligne?: number;
  /** Retrait à gauche, en points. */
  retrait?: number;
  /** Espace ajouté avant le bloc. */
  avant?: number;
  /** Espace ajouté après le bloc. */
  apres?: number;
  centre?: boolean;
}

export class ActePdf {
  private constructor(
    private readonly pdf: PDFDocument,
    private readonly normal: PDFFont,
    private readonly gras: PDFFont,
    private readonly italique: PDFFont,
    private readonly grasItalique: PDFFont,
  ) {
    this.page = pdf.addPage([LARGEUR, HAUTEUR]);
    this.y = HAUTEUR - MARGE_HAUT;
  }

  private page: PDFPage;
  private y: number;

  static async creer(): Promise<ActePdf> {
    const pdf = await PDFDocument.create();
    const [normal, gras, italique, grasItalique] = await Promise.all([
      pdf.embedFont(StandardFonts.TimesRoman),
      pdf.embedFont(StandardFonts.TimesRomanBold),
      pdf.embedFont(StandardFonts.TimesRomanItalic),
      pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    ]);
    return new ActePdf(pdf, normal, gras, italique, grasItalique);
  }

  // -------------------------------------------------------------------------
  // Gestion du flux
  // -------------------------------------------------------------------------

  private police(o: OptionsTexte): PDFFont {
    if (o.gras && o.italique) return this.grasItalique;
    if (o.gras) return this.gras;
    if (o.italique) return this.italique;
    return this.normal;
  }

  /** Ouvre une page si la hauteur demandée ne tient plus sur la page courante. */
  private reserver(hauteur: number) {
    if (this.y - hauteur < MARGE_BAS) {
      this.page = this.pdf.addPage([LARGEUR, HAUTEUR]);
      this.y = HAUTEUR - MARGE_HAUT;
    }
  }

  espace(points = 10) {
    this.y -= points;
  }

  /** Découpe un texte en lignes tenant dans la largeur donnée. */
  private decouper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
    const lignes: string[] = [];

    // Les retours à la ligne explicites du texte source sont respectés.
    for (const paragraphe of securiser(texte).split("\n")) {
      let ligne = "";
      for (const mot of paragraphe.split(/\s+/)) {
        const essai = ligne ? `${ligne} ${mot}` : mot;
        if (police.widthOfTextAtSize(essai, taille) <= largeur) {
          ligne = essai;
        } else {
          if (ligne) lignes.push(ligne);
          ligne = mot;
        }
      }
      lignes.push(ligne);
    }
    return lignes;
  }

  // -------------------------------------------------------------------------
  // Blocs
  // -------------------------------------------------------------------------

  /** Titre principal de l'acte, centré et en capitales. */
  titre(texte: string, sousTitre?: string) {
    this.texte(texte, { taille: 14, gras: true, centre: true, apres: sousTitre ? 4 : 16 });
    if (sousTitre) this.texte(sousTitre, { taille: 11, gras: true, centre: true, apres: 16 });
  }

  /** En-tête d'article : « Article 4 – Redevance journalière ». */
  article(numero: number, intitule: string) {
    // Un article ne doit jamais rester seul en bas de page, séparé de son
    // premier paragraphe : on réserve de quoi loger les deux.
    this.reserver(46);
    this.texte(`Article ${numero} - ${intitule}`, {
      taille: 11,
      gras: true,
      avant: 12,
      apres: 6,
    });
  }

  /** Intertitre simple, sans numéro. */
  section(intitule: string, options: OptionsTexte = {}) {
    this.texte(intitule, { taille: 11, gras: true, avant: 12, apres: 6, ...options });
  }

  texte(contenu: string, options: OptionsTexte = {}) {
    const taille = options.taille ?? 10.5;
    const interligne = options.interligne ?? taille * 1.35;
    const police = this.police(options);
    const retrait = options.retrait ?? 0;

    if (options.avant) this.espace(options.avant);

    const lignes = this.decouper(contenu, police, taille, LARGEUR_UTILE - retrait);

    for (const ligne of lignes) {
      this.reserver(interligne);
      const x = options.centre
        ? MARGE_GAUCHE + (LARGEUR_UTILE - police.widthOfTextAtSize(ligne, taille)) / 2
        : MARGE_GAUCHE + retrait;

      this.page.drawText(ligne, {
        x,
        y: this.y - taille,
        size: taille,
        font: police,
        color: options.gris ? GRIS : NOIR,
      });
      this.y -= interligne;
    }

    if (options.apres) this.espace(options.apres);
  }

  /** Liste à puces, telle qu'elle figure dans les actes. */
  puces(items: string[], options: OptionsTexte = {}) {
    const taille = options.taille ?? 10.5;
    for (const item of items) {
      this.reserver(taille * 1.35);
      this.page.drawText("-", {
        x: MARGE_GAUCHE + 12,
        y: this.y - taille,
        size: taille,
        font: this.normal,
      });
      this.texte(item, { ...options, taille, retrait: 24 });
    }
  }

  /**
   * Ligne « Libellé : valeur ». Le libellé est en romain, la valeur aussi :
   * c'est la présentation des actes existants.
   */
  champ(libelle: string, valeur: string, options: OptionsTexte = {}) {
    this.texte(`${libelle} : ${valeur}`, { taille: 10.5, ...options });
  }

  /**
   * Rangée de cases à cocher. Les cases sont DESSINÉES, jamais écrites : le
   * caractère « case à cocher » n'existe pas dans l'encodage des polices
   * standard et ferait échouer la génération.
   */
  cases(libelle: string, choix: { libelle: string; cochee?: boolean }[], taille = 10.5) {
    const cote = taille * 0.82;
    this.reserver(taille * 1.6);

    let x = MARGE_GAUCHE;
    const yTexte = this.y - taille;

    if (libelle) {
      const intitule = securiser(`${libelle} : `);
      this.page.drawText(intitule, { x, y: yTexte, size: taille, font: this.normal });
      x += this.normal.widthOfTextAtSize(intitule, taille);
    }

    for (const c of choix) {
      const etiquette = securiser(` ${c.libelle}`);
      const largeurChoix = cote + this.normal.widthOfTextAtSize(etiquette, taille) + 14;

      // Passage à la ligne si la rangée déborde
      if (x + largeurChoix > LARGEUR - MARGE_DROITE) {
        this.y -= taille * 1.5;
        this.reserver(taille * 1.6);
        x = MARGE_GAUCHE + 12;
      }

      this.page.drawRectangle({
        x,
        y: this.y - taille + 1,
        width: cote,
        height: cote,
        borderColor: NOIR,
        borderWidth: 0.7,
      });

      if (c.cochee) {
        // Croix tracée dans la case — plus lisible qu'un glyphe à l'impression
        const m = 1.6;
        const commun = { thickness: 0.9, color: NOIR };
        this.page.drawLine({
          start: { x: x + m, y: this.y - taille + 1 + m },
          end: { x: x + cote - m, y: this.y - taille + 1 + cote - m },
          ...commun,
        });
        this.page.drawLine({
          start: { x: x + m, y: this.y - taille + 1 + cote - m },
          end: { x: x + cote - m, y: this.y - taille + 1 + m },
          ...commun,
        });
      }

      this.page.drawText(etiquette, {
        x: x + cote,
        y: this.y - taille,
        size: taille,
        font: this.normal,
      });
      x += largeurChoix;
    }

    this.y -= taille * 1.6;
  }

  /** Filet horizontal de séparation, comme dans les actes d'origine. */
  separateur(options: { avant?: number; apres?: number } = {}) {
    this.espace(options.avant ?? 10);
    this.reserver(6);
    this.page.drawLine({
      start: { x: MARGE_GAUCHE, y: this.y },
      end: { x: LARGEUR - MARGE_DROITE, y: this.y },
      thickness: 0.7,
      color: GRIS_FILET,
    });
    this.espace(options.apres ?? 10);
  }

  /** Ligne pointillée sur laquelle une signature manuscrite peut être apposée. */
  ligneDeSignature(largeur = LARGEUR_UTILE) {
    this.reserver(8);
    this.page.drawLine({
      start: { x: MARGE_GAUCHE, y: this.y },
      end: { x: MARGE_GAUCHE + largeur, y: this.y },
      thickness: 0.7,
      color: GRIS_FILET,
      dashArray: [1, 2],
    });
    this.espace(8);
  }

  /**
   * Réserve l'espace d'une signature et retourne le rectangle où l'image du
   * tracé viendra s'incruster au lot 5. Les coordonnées sont mémorisées avec
   * l'indice de la page, seule façon de les retrouver plus tard.
   */
  blocSignature(intitule: string, sousTitre?: string): EmplacementSignature {
    this.reserver(112);
    this.texte(intitule, { taille: 10.5, gras: true, apres: 2 });
    if (sousTitre) this.texte(sousTitre, { taille: 10.5, apres: 2 });
    this.texte("Signature :", { taille: 10.5, italique: true, apres: 4 });

    const emplacement: EmplacementSignature = {
      page: this.pdf.getPages().indexOf(this.page),
      x: MARGE_GAUCHE,
      y: this.y - 62,
      largeur: 200,
      hauteur: 58,
    };

    this.y -= 66;
    this.ligneDeSignature();
    return emplacement;
  }

  /**
   * Grille de photos, comme sur le constat d'état.
   *
   * Les images viennent des téléphones des gérants : formats et proportions
   * varient. Chaque photo est donc inscrite dans sa case sans déformation,
   * et centrée sur le fond restant.
   */
  async grilleImages(
    images: { octets: Uint8Array; mimeType: string; legende?: string }[],
    colonnes = 2,
  ) {
    if (images.length === 0) return;

    const gouttiere = 8;
    const largeurCase = (LARGEUR_UTILE - gouttiere * (colonnes - 1)) / colonnes;
    const hauteurCase = largeurCase * 0.72;

    for (let i = 0; i < images.length; i += colonnes) {
      const rangee = images.slice(i, i + colonnes);
      this.reserver(hauteurCase + 14);

      const hautRangee = this.y;

      for (const [j, image] of rangee.entries()) {
        const x = MARGE_GAUCHE + j * (largeurCase + gouttiere);
        const yCase = hautRangee - hauteurCase;

        this.page.drawRectangle({
          x,
          y: yCase,
          width: largeurCase,
          height: hauteurCase,
          borderColor: GRIS_FILET,
          borderWidth: 0.7,
        });

        try {
          const incorporee = image.mimeType.includes("png")
            ? await this.pdf.embedPng(image.octets)
            : await this.pdf.embedJpg(image.octets);

          // Marge intérieure pour ne pas coller au filet du cadre.
          const dims = incorporee.scaleToFit(largeurCase - 6, hauteurCase - 6);
          this.page.drawImage(incorporee, {
            x: x + (largeurCase - dims.width) / 2,
            y: yCase + (hauteurCase - dims.height) / 2,
            width: dims.width,
            height: dims.height,
          });
        } catch {
          // Photo illisible : le constat reste valable, la case porte la mention.
          this.page.drawText("(photo illisible)", {
            x: x + 10,
            y: yCase + hauteurCase / 2,
            size: 8,
            font: this.normal,
            color: GRIS,
          });
        }

        if (image.legende) {
          this.page.drawText(securiser(image.legende), {
            x,
            y: yCase - 9,
            size: 7,
            font: this.normal,
            color: GRIS,
          });
        }
      }

      this.y = hautRangee - hauteurCase - (rangee.some((r) => r.legende) ? 16 : 8);
    }
  }

  /**
   * Deux cadres de signature côte à côte, comme le tableau du constat d'état.
   * Retourne les emplacements où incruster les tracés.
   */
  blocsSignatureCoteACote(
    gauche: string,
    droite: string,
  ): { gauche: EmplacementSignature; droite: EmplacementSignature } {
    const hauteur = 86;
    this.reserver(hauteur + 6);

    const largeurCase = LARGEUR_UTILE / 2;
    const haut = this.y;
    const bas = haut - hauteur;

    for (const [i, intitule] of [gauche, droite].entries()) {
      const x = MARGE_GAUCHE + i * largeurCase;

      this.page.drawRectangle({
        x,
        y: bas,
        width: largeurCase,
        height: hauteur,
        borderColor: NOIR,
        borderWidth: 0.7,
      });

      const texte = securiser(intitule);
      const largeurTexte = this.gras.widthOfTextAtSize(texte, 9.5);
      this.page.drawText(texte, {
        x: x + (largeurCase - largeurTexte) / 2,
        y: haut - 15,
        size: 9.5,
        font: this.gras,
      });
    }

    this.y = bas - 6;
    const page = this.pdf.getPages().indexOf(this.page);

    return {
      gauche: { page, x: MARGE_GAUCHE + 12, y: bas + 8, largeur: largeurCase - 24, hauteur: 52 },
      droite: {
        page,
        x: MARGE_GAUCHE + largeurCase + 12,
        y: bas + 8,
        largeur: largeurCase - 24,
        hauteur: 52,
      },
    };
  }

  /** Bandeau encadré, pour les clauses que le constat met en évidence. */
  encadre(contenu: string, taille = 9.5) {
    const lignes = this.decouper(contenu, this.normal, taille, LARGEUR_UTILE - 20);
    const hauteur = lignes.length * (taille * 1.35) + 16;

    this.reserver(hauteur + 6);
    const haut = this.y;

    this.page.drawRectangle({
      x: MARGE_GAUCHE,
      y: haut - hauteur,
      width: LARGEUR_UTILE,
      height: hauteur,
      borderColor: NOIR,
      borderWidth: 0.9,
    });

    let y = haut - 8;
    for (const ligne of lignes) {
      this.page.drawText(ligne, {
        x: MARGE_GAUCHE + 10,
        y: y - taille,
        size: taille,
        font: this.normal,
      });
      y -= taille * 1.35;
    }

    this.y = haut - hauteur - 6;
  }

  /** Nombre de pages produites — journalisé avec le contrat. */
  get nombreDePages(): number {
    return this.pdf.getPageCount();
  }

  async octets(metadonnees: {
    titre: string;
    reference: string;
  }): Promise<Uint8Array> {
    this.pdf.setTitle(`${metadonnees.titre} - ${metadonnees.reference}`);
    this.pdf.setProducer("La Mother Express");
    this.pdf.setCreator("La Mother Express");
    this.pdf.setCreationDate(new Date());
    return this.pdf.save();
  }
}

export interface EmplacementSignature {
  /** Indice de la page, base 0. */
  page: number;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
