/**
 * Contrat de location-accession de moto électrique.
 *
 * Le texte reproduit mot pour mot les actes fournis par le client. Trois
 * variantes existent, qui ne diffèrent que par la durée et par la présence
 * d'un article supplémentaire :
 *
 *   24 mois  — 5 000 F/j, sans engagement          articles 1 à 13
 *   14 mois  — 3 000 F/j, A10 sans engagement      articles 1 à 13
 *   12 mois  — 2 500 F/j, A10 AVEC engagement      articles 1 à 14
 *
 * La formule avec engagement insère un article 5 « Tarif préférentiel et
 * différentiel dû en cas de rupture anticipée », ce qui décale d'un rang tous
 * les articles suivants. La numérotation est donc calculée, jamais écrite en
 * dur : ajouter une clause conditionnelle ne doit pas obliger à renuméroter
 * l'acte à la main.
 *
 * ⚠ Toute modification du texte ci-dessous change un document juridiquement
 * engageant. Elle doit être validée par le client avant d'être livrée.
 */

import { ActePdf, type EmplacementSignature } from "./mise-en-page";
import type { SnapshotContrat } from "./snapshot";
import { texteTemoin } from "./temoin";

/** Durées en toutes lettres, telles qu'elles figurent sur les actes. */
const EN_LETTRES: Record<number, string> = {
  12: "douze",
  14: "quatorze",
  24: "vingt-quatre",
};

function enLettres(mois: number): string {
  return `${EN_LETTRES[mois] ?? mois} (${mois})`;
}

export interface ActeCompose {
  octets: Uint8Array;
  /**
   * Emplacements des tracés de signature. `temoin` est ABSENT quand l'acte
   * n'en porte pas — contrat produit avant l'introduction du témoin, ou
   * généré sans en désigner un. L'optionnalité est donc porteuse de sens :
   * elle dit « cet acte n'attend pas de témoin ».
   */
  emplacements: {
    client: EmplacementSignature;
    gerant: EmplacementSignature;
    temoin?: EmplacementSignature;
  };
  pages: number;
}

export async function composerContratAccession(s: SnapshotContrat): Promise<ActeCompose> {
  const doc = await ActePdf.creer();
  const duree = enLettres(s.dureeMois ?? 24);

  // Compteur d'articles : la variante avec engagement en compte un de plus.
  let n = 0;
  const article = (intitule: string) => doc.article(++n, intitule);

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.titre(
    "CONTRAT DE LOCATION-ACCESSION DE MOTO ÉLECTRIQUE",
    s.avecEngagement ? "FORMULE AVEC ENGAGEMENT - DOUZE (12) MOIS" : undefined,
  );

  doc.texte("ENTRE LES SOUSSIGNÉS :", { gras: true, apres: 8 });

  doc.texte(`${s.bailleurRaisonSociale}, « le Bailleur »`, { gras: true });
  doc.champ("NINEA", s.bailleurNinea);
  doc.champ("Adresse", s.bailleurSiege);
  doc.champ("Représentée par", s.bailleurRepresentant, { apres: 10 });

  doc.texte("ET", { gras: true, centre: true, apres: 10 });

  doc.texte("Le Locataire-Accédant, « le Locataire »", { gras: true });
  doc.champ("Nom et prénom", s.clientNomComplet);
  doc.champ("Numéro de pièce d'identité", s.clientNumeroPiece);
  doc.champ("Adresse", s.clientAdresse);
  doc.champ("Téléphone", s.clientTelephone);

  doc.separateur({ avant: 14, apres: 6 });

  // ── Article 1 — Objet ────────────────────────────────────────────────────
  article("Objet");
  doc.texte(
    "Le présent contrat a pour objet la mise à disposition d'une moto électrique appartenant " +
      `à ${s.bailleurRaisonSociale} dans le cadre d'une location-accession permettant au Locataire ` +
      "d'acquérir la propriété du véhicule après exécution complète des obligations prévues au contrat.",
  );

  if (s.avecEngagement) {
    doc.texte(
      "Il est conclu sous la formule avec engagement, qui ouvre droit à une durée réduite et à " +
        "un tarif journalier préférentiel, en contrepartie de l'engagement ferme du Locataire " +
        "d'aller jusqu'au terme du contrat.",
      { avant: 6 },
    );
  }

  // ── Article 2 — Identification du véhicule ───────────────────────────────
  article("Identification du véhicule");
  doc.champ("Marque / Modèle", s.vehiculeMarqueModele);
  doc.champ("Numéro de série", s.vehiculeNumeroSerie);
  doc.champ("Immatriculation", s.vehiculeImmatriculation);
  doc.champ("Valeur de référence du véhicule", s.vehiculeValeurReference);

  // ── Article 3 — Durée ────────────────────────────────────────────────────
  article(s.avecEngagement ? "Durée et engagement" : "Durée");
  doc.texte(
    `Le présent contrat est conclu pour une durée ${s.avecEngagement ? "ferme " : ""}de ${duree} mois :`,
  );
  doc.texte(`Date de début : ${s.dateDebut}          Date de fin : ${s.dateFin}`, { avant: 4 });

  if (s.avecEngagement) {
    doc.texte(
      "Le Locataire s'engage expressément à exécuter le contrat pendant toute cette durée. " +
        `Le contrat prend fin de plein droit à l'échéance des ${duree} mois, sans qu'il soit ` +
        "besoin d'un congé ou d'une mise en demeure.",
      { avant: 6 },
    );
  } else {
    doc.texte(
      `Le contrat prend fin de plein droit à l'échéance des ${duree} mois, sans qu'il soit besoin ` +
        "d'un congé ou d'une mise en demeure.",
      { avant: 6 },
    );
  }

  // ── Article 4 — Redevance journalière ────────────────────────────────────
  article("Redevance journalière");
  doc.texte("Le Locataire s'engage à verser au Bailleur une redevance journalière de :");
  doc.texte(`${s.redevanceJournaliere} par jour`, { gras: true, avant: 4, apres: 4 });
  doc.texte(
    "La redevance est due six (6) jours sur sept (7) par semaine. Le Locataire reconnaît que " +
      "l'obligation de paiement porte sur six (6) jours de location par semaine pendant toute " +
      "la durée du contrat.",
  );

  // ── Article 5 — Tarif préférentiel (variante avec engagement) ────────────
  //
  // C'est la clause qui rend le différentiel de 500 F/j opposable. Sans elle,
  // la remise serait définitivement acquise dès le premier jour.
  let numeroArticleDifferentiel: number | null = null;

  if (s.avecEngagement) {
    article("Tarif préférentiel et différentiel dû en cas de rupture anticipée");
    numeroArticleDifferentiel = n;

    doc.texte(
      `Le tarif de ${s.redevanceJournaliere} par jour est un tarif préférentiel, consenti par ` +
        `${s.bailleurRaisonSociale} en contrepartie exclusive de l'engagement du Locataire sur ` +
        `la durée ferme de ${duree} mois prévue à l'article 3.`,
    );
    doc.texte(
      `Le tarif de référence de ${s.bailleurRaisonSociale} pour le même véhicule, en formule sans ` +
        `engagement, est de ${s.tarifSansEngagement} par jour. La différence entre les deux tarifs, ` +
        `soit cinq cents (500) FCFA par jour, constitue une remise conditionnelle, qui n'est ` +
        "définitivement acquise au Locataire qu'au terme complet du contrat.",
      { avant: 6 },
    );
    doc.texte(
      "En conséquence, en cas de rupture du contrat avant son terme pour une cause imputable au " +
        "Locataire - notamment abandon volontaire, restitution anticipée du véhicule, résiliation " +
        "pour défaut de paiement ou pour tout autre manquement contractuel - la remise est réputée " +
        `non acquise et le Locataire devra à ${s.bailleurRaisonSociale} un différentiel de cinq cents ` +
        "(500) FCFA par jour, calculé sur la totalité des jours de location facturés depuis la date " +
        "de début du contrat jusqu'à la date de restitution effective du véhicule.",
      { avant: 6 },
    );
    doc.texte(
      "Ce différentiel a pour seul objet de replacer le Locataire au tarif sans engagement pour la " +
        "période effectivement utilisée. Il s'ajoute aux redevances échues et impayées ainsi qu'aux " +
        "éventuels frais de remise en état, et devient exigible dès la date de rupture du contrat.",
      { avant: 6 },
    );
    doc.texte(
      "Le paiement de ce différentiel n'ouvre au Locataire aucun droit de propriété ni aucun droit " +
        "au remboursement des sommes déjà versées.",
      { avant: 6 },
    );
  }

  // ── Modalités de paiement ────────────────────────────────────────────────
  article("Modalités de paiement");
  // Libellés inchangés : seules les cases convenues sont cochées par le gérant.
  const modes = s.modesPaiement ?? [];
  doc.texte("Les versements sont effectués :");
  doc.cases("", [
    { libelle: "En espèces", cochee: modes.includes("ESPECES") },
    { libelle: "Par Wave", cochee: modes.includes("WAVE") },
    { libelle: "Par Orange Money", cochee: modes.includes("ORANGE_MONEY") },
    { libelle: "Par virement bancaire", cochee: modes.includes("VIREMENT") },
  ]);
  doc.texte(
    `Chaque paiement fera l'objet d'une attestation ou d'un reçu délivré par ${s.bailleurRaisonSociale}.`,
  );
  doc.texte("Un carnet ou registre de suivi des paiements pourra être tenu par les parties.");

  // ── Acquisition de la propriété ──────────────────────────────────────────
  article("Acquisition de la propriété");
  doc.texte(
    `Sous réserve du paiement intégral de toutes les redevances prévues pendant la durée de ${duree} ` +
      "mois, le Locataire deviendra propriétaire de la moto.",
  );
  doc.texte("Le transfert de propriété interviendra uniquement après :", { avant: 6 });
  doc.puces([
    "vérification du paiement complet des sommes dues ;",
    "absence de dettes ou pénalités ;",
    "signature d'un procès-verbal de transfert.",
  ]);
  doc.texte(`À cette date, ${s.bailleurRaisonSociale} remettra au Locataire :`, { avant: 6 });
  doc.puces([
    "l'original du Certificat de Mise en Circulation (CMC) ;",
    "les documents administratifs nécessaires au transfert de propriété.",
  ]);

  // ── Réserve de propriété ─────────────────────────────────────────────────
  article("Réserve de propriété");
  doc.texte(
    `Pendant toute la durée du contrat, la moto demeure la propriété exclusive de ${s.bailleurRaisonSociale}.`,
  );
  doc.texte("Le Locataire ne peut, sans l'autorisation écrite du Bailleur :", { avant: 6 });
  doc.puces([
    "vendre le véhicule ;",
    "le donner en garantie ;",
    "le céder ;",
    "le louer à un tiers.",
  ]);

  // ── Entretien ────────────────────────────────────────────────────────────
  article("Entretien du véhicule");
  doc.texte("Le Locataire est responsable :");
  doc.puces([
    "de l'entretien courant ;",
    "du nettoyage ;",
    "de la recharge de la batterie ;",
    "des petites réparations liées à l'usage normal.",
  ]);
  doc.texte("Toute négligence entraînant une dégradation du véhicule sera à sa charge.", {
    avant: 6,
  });

  // ── Sinistres ────────────────────────────────────────────────────────────
  article("Accident, vol ou destruction");
  doc.texte(
    `Le Locataire doit informer immédiatement ${s.bailleurRaisonSociale} de tout accident, panne, ` +
      "vol ou sinistre. En cas de vol ou de destruction résultant d'une faute du Locataire, " +
      "celui-ci pourra être tenu de rembourser la valeur résiduelle du véhicule.",
  );

  // ── GPS ──────────────────────────────────────────────────────────────────
  article("Système GPS");
  doc.texte("Le Locataire accepte que le véhicule soit équipé d'un dispositif GPS destiné à :");
  doc.puces([
    "la sécurité du conducteur ;",
    "la protection du véhicule ;",
    "la prévention des vols.",
  ]);

  // ── Absence de paiement ──────────────────────────────────────────────────
  article("Absence de paiement");
  doc.texte("Tout retard supérieur à deux (2) jours pourra entraîner :");
  doc.puces([
    "la suspension du contrat ;",
    "l'immobilisation du véhicule ;",
    `la reprise du véhicule par ${s.bailleurRaisonSociale}.`,
  ]);
  doc.texte(
    "Les sommes déjà versées resteront acquises à titre de contrepartie de la jouissance du " +
      "véhicule et des frais engagés.",
    { avant: 6 },
  );
  doc.texte(
    "En cas de défaut de paiement cumulé supérieur à six (6) jours ou de disparition du véhicule, " +
      `${s.bailleurRaisonSociale} pourra reprendre immédiatement possession de la moto, sans que le ` +
      "Locataire puisse prétendre au remboursement des sommes déjà versées, celles-ci étant " +
      "considérées comme contrepartie de la mise à disposition du véhicule et de son utilisation.",
    { avant: 6 },
  );

  if (numeroArticleDifferentiel) {
    doc.texte(
      `La résiliation prononcée sur ce fondement rend exigible le différentiel prévu à l'article ${numeroArticleDifferentiel}.`,
      { avant: 6 },
    );
  }

  // ── Résiliation anticipée ────────────────────────────────────────────────
  article("Résiliation anticipée");
  doc.texte(
    `En cas d'abandon volontaire du contrat par le Locataire avant le terme des ${duree} mois :`,
  );
  doc.puces([
    "le véhicule devra être restitué immédiatement ;",
    "les sommes déjà versées ne seront pas remboursées ;",
    numeroArticleDifferentiel
      ? "aucun droit de propriété ne pourra être revendiqué ;"
      : "aucun droit de propriété ne pourra être revendiqué.",
    ...(numeroArticleDifferentiel
      ? [
          `le différentiel de ${s.differentielJournalier} par jour prévu à l'article ` +
            `${numeroArticleDifferentiel} devient immédiatement exigible.`,
        ]
      : []),
  ]);

  // ── Droit applicable ─────────────────────────────────────────────────────
  article("Droit applicable");
  doc.texte("Le présent contrat est régi par les lois en vigueur en République du Sénégal.");
  doc.texte(
    "Tout litige sera soumis aux juridictions compétentes du Sénégal après tentative de règlement amiable.",
    { avant: 6 },
  );

  // ── Signatures ───────────────────────────────────────────────────────────
  doc.separateur({ avant: 18, apres: 10 });
  doc.texte("SIGNATURES", { gras: true, centre: true, apres: 12 });
  doc.champ("Fait à", `${s.lieuSignature}          Le : ${s.dateSignature}`, { apres: 10 });

  const gerant = doc.blocSignature(
    `LE BAILLEUR - ${s.bailleurRaisonSociale}`,
    `Représenté par : ${s.bailleurRepresentant}`,
  );

  doc.espace(10);
  const client = doc.blocSignature("LE LOCATAIRE-ACCÉDANT", `Nom : ${s.clientNomComplet}`);

  // Le témoin n'apparaît que si le gérant en a désigné un : un acte produit
  // avant son introduction ne doit pas afficher un cadre vide.
  const temoin = s.temoinNom
    ? (() => {
        doc.espace(10);
        doc.texte(texteTemoin("Accédant"), { taille: 9.5, apres: 8 });
        return doc.blocSignature("LE TÉMOIN", `Nom : ${s.temoinNom}`);
      })()
    : undefined;

  // Mention manuscrite exigée par la formule avec engagement : la signature
  // seule ne suffit pas à rendre l'article du différentiel opposable.
  if (s.avecEngagement && numeroArticleDifferentiel) {
    doc.texte(
      `Signature précédée de la mention « Lu et approuvé, je reconnais avoir pris connaissance ` +
        `de l'article ${numeroArticleDifferentiel} »`,
      { taille: 10, avant: 6 },
    );
  }

  return {
    octets: await doc.octets({
      titre: "Contrat de location-accession",
      reference: s.reference,
    }),
    emplacements: { client, gerant, temoin },
    pages: doc.nombreDePages,
  };
}
