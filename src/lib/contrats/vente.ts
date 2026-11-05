/**
 * Contrat de vente de moto électrique avec paiement échelonné.
 *
 * Texte reproduit à l'identique de l'acte fourni par le client.
 * Échéancier de l'article 3 : 60 % à la signature, puis 10 % à 30, 60, 90 et
 * 120 jours — conforme à ce que calcule `echeancierVenteEchelonnee`.
 *
 * Note : l'acte d'origine énonce les versements en POURCENTAGES, sans porter
 * les montants. Cette présentation est conservée telle quelle. Les montants
 * chiffrés sont affichés au client dans son espace personnel, où ils ne
 * modifient pas la portée juridique du document.
 *
 * ⚠ Toute modification du texte ci-dessous change un document juridiquement
 * engageant. Elle doit être validée par le client avant d'être livrée.
 */

import { ActePdf } from "./mise-en-page";
import type { SnapshotContrat } from "./snapshot";
import type { ActeCompose } from "./accession";

export async function composerContratVente(s: SnapshotContrat): Promise<ActeCompose> {
  const doc = await ActePdf.creer();

  let n = 0;
  const article = (intitule: string) => doc.article(++n, intitule);

  const etatVehicule = s.etatVenteVehicule ?? "Neuf";

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.titre("CONTRAT DE VENTE DE MOTO ÉLECTRIQUE", "AVEC PAIEMENT ÉCHELONNÉ");

  doc.texte("ENTRE LES SOUSSIGNÉS :", { gras: true, apres: 8 });

  doc.texte(`${s.bailleurRaisonSociale}, ci-après dénommée « le Vendeur »`, { gras: true });
  doc.champ("NINEA", s.bailleurNinea);
  doc.champ("Adresse du siège", s.bailleurSiege);
  doc.champ("Représentée par", s.bailleurRepresentant, { apres: 10 });

  doc.texte("ET", { gras: true, centre: true, apres: 10 });

  doc.texte("L'Acheteur", { gras: true });
  doc.champ("Nom et prénom", s.clientNomComplet);
  doc.champ("Numéro de pièce d'identité", s.clientNumeroPiece);
  doc.champ("Adresse", s.clientAdresse);
  doc.champ("Téléphone", s.clientTelephone);

  doc.separateur({ avant: 14, apres: 6 });

  // ── Article 1 ────────────────────────────────────────────────────────────
  article("Objet du contrat");
  doc.texte(
    `Le présent contrat a pour objet la vente par ${s.bailleurRaisonSociale} à l'Acheteur d'une ` +
      "moto électrique dont les caractéristiques sont définies ci-dessous, avec paiement échelonné " +
      "conformément aux modalités prévues au présent contrat.",
  );

  // ── Article 2 ────────────────────────────────────────────────────────────
  article("Identification du véhicule");
  doc.champ("Marque / Modèle", s.vehiculeMarqueModele);
  doc.champ("Numéro de série", s.vehiculeNumeroSerie);
  doc.champ("CMC", s.vehiculeCmc);
  // Saisi par le gérant. Les motos vendues sont neuves : à défaut de valeur —
  // les snapshots figés avant l'ajout du champ — l'acte imprime « Neuf »,
  // exactement ce qu'il portait en dur auparavant.
  doc.champ("État du véhicule au moment de la vente", etatVehicule);
  doc.champ("Date de remise effective du véhicule", s.dateDebut);

  // ── Article 3 ────────────────────────────────────────────────────────────
  article("Prix de vente");
  doc.texte(`Le prix total est fixé à : ${s.prixTotal}`);
  doc.texte(
    "L'Acheteur reconnaît avoir pris connaissance du prix total du véhicule et accepte les " +
      "modalités de paiement suivantes :",
    { avant: 6 },
  );
  doc.puces([
    "Premier versement : 60 % du prix total à la signature du contrat.",
    "Deuxième versement : 10 % du prix total dans un délai de trente (30) jours à partir de la date de signature.",
    "Troisième versement : 10 % du prix total dans un délai de soixante (60) jours à partir de la date de signature.",
    "Quatrième versement : 10 % du prix total dans un délai de quatre-vingt-dix (90) jours à partir de la date de signature.",
    "Cinquième et dernier versement : 10 % du prix total dans un délai de cent vingt (120) jours à partir de la date de signature.",
  ]);

  // ── Article 4 ────────────────────────────────────────────────────────────
  article("Modalités de paiement");
  // Libellés inchangés : seules les cases convenues sont cochées par le gérant.
  const modes = s.modesPaiement ?? [];
  doc.texte("Les paiements seront effectués par :");
  doc.cases("", [
    { libelle: "Espèces", cochee: modes.includes("ESPECES") },
    { libelle: "Wave", cochee: modes.includes("WAVE") },
    { libelle: "Orange Money", cochee: modes.includes("ORANGE_MONEY") },
    { libelle: "Virement", cochee: modes.includes("VIREMENT") },
  ]);
  doc.texte(
    "Chaque versement donnera lieu à la délivrance d'une attestation de versement signée par le Vendeur.",
  );

  // ── Article 5 ────────────────────────────────────────────────────────────
  article("Réserve de propriété");
  doc.texte(
    `La moto demeure la propriété exclusive de ${s.bailleurRaisonSociale} jusqu'au paiement ` +
      "intégral du prix de vente, des pénalités éventuelles et des frais accessoires.",
  );
  doc.texte(
    "L'Acheteur ne pourra ni vendre, ni céder, ni mettre en garantie la moto avant le règlement " +
      "complet du prix convenu.",
    { avant: 6 },
  );
  doc.texte(
    "L'Acheteur recevra une copie du Certificat de Mise en Circulation (CMC) lors du premier " +
      "versement. L'original du CMC ne lui sera remis qu'après paiement intégral du prix de vente " +
      "et règlement complet de toutes les sommes dues au titre du présent contrat.",
    { avant: 6 },
  );

  // ── Article 6 ────────────────────────────────────────────────────────────
  article("Défaut de paiement");
  doc.texte("En cas de retard ou de défaut de paiement d'un versement :");
  doc.puces([
    "le Vendeur pourra exiger le paiement immédiat des sommes restantes dues ;",
    "le Vendeur pourra reprendre possession du véhicule sans décision judiciaire préalable, sous réserve du respect des lois applicables ;",
    "les sommes déjà versées pourront être conservées à titre de compensation des frais, de l'usure et du préjudice subi.",
  ]);
  doc.texte("Tout retard pourra également entraîner des frais supplémentaires.", { avant: 6 });

  // ── Article 7 ────────────────────────────────────────────────────────────
  article("Obligations de l'Acheteur");
  doc.texte("L'Acheteur s'engage à :");
  doc.puces([
    "utiliser la moto conformément aux lois et règlements en vigueur en République du Sénégal ;",
    "entretenir correctement le véhicule ;",
    "ne pas utiliser la moto à des fins illégales ;",
    "informer immédiatement le Vendeur en cas d'accident, de panne ou de vol.",
  ]);

  // ── Article 8 ────────────────────────────────────────────────────────────
  article("Assurance et responsabilité");
  doc.texte(
    "À compter de la remise du véhicule, l'Acheteur devient responsable des dommages causés à la " +
      "moto ou par la moto, même avant le transfert définitif de propriété.",
  );
  doc.texte(
    "L'Acheteur supporte l'ensemble des frais liés à l'utilisation du véhicule, notamment les " +
      "amendes, réparations, assurances et frais administratifs.",
    { avant: 6 },
  );
  doc.texte(
    "En cas de perte totale du véhicule (vol, destruction, accident irréparable) survenant avant " +
      "le paiement intégral du prix de vente, le solde restant dû demeure exigible dans son " +
      "intégralité. L'Acheteur reste tenu de régler les versements restants conformément au " +
      "calendrier prévu à l'Article 3, indépendamment de tout sinistre affectant le véhicule.",
    { avant: 6 },
  );

  // ── Article 9 ────────────────────────────────────────────────────────────
  article("État du véhicule");
  doc.texte(
    "L'Acheteur reconnaît avoir reçu le véhicule et atteste avoir procédé à la vérification de " +
      "l'état des éléments suivants :",
  );
  // Les deux libellés de l'acte restent imprimés ; seule la case constatée
  // porte la croix. Auparavant aucune des deux n'était cochée : le document
  // posait la question sans jamais y répondre.
  doc.cases("État général", [
    { libelle: "Neuf", cochee: etatVehicule === "Neuf" },
    { libelle: "D'occasion", cochee: etatVehicule === "D'occasion" },
  ]);

  // ── Article 10 ───────────────────────────────────────────────────────────
  article("Garantie");
  doc.texte(
    "Sauf disposition contraire écrite, la moto est vendue dans l'état où elle se trouve au " +
      "moment de la remise.",
  );
  doc.texte(
    "Le Vendeur reste tenu des garanties légales prévues par les lois sénégalaises applicables.",
    { avant: 6 },
  );

  // ── Article 11 ───────────────────────────────────────────────────────────
  article("Résiliation");
  doc.texte(
    "Le présent contrat pourra être résilié de plein droit par le Vendeur en cas de non-respect " +
      "par l'Acheteur de ses obligations contractuelles, notamment en cas de défaut de paiement.",
  );

  // ── Article 12 ───────────────────────────────────────────────────────────
  article("Règlement des litiges");
  doc.texte(
    "Les parties s'engagent à rechercher une solution amiable à tout différend relatif au présent contrat.",
  );
  doc.texte(
    "À défaut d'accord amiable, les juridictions compétentes de la République du Sénégal seront " +
      "seules compétentes.",
    { avant: 6 },
  );

  // ── Article 13 ───────────────────────────────────────────────────────────
  article("Droit applicable");
  doc.texte("Le présent contrat est régi par les lois en vigueur en République du Sénégal.");

  // ── Signatures ───────────────────────────────────────────────────────────
  doc.separateur({ avant: 18, apres: 10 });
  doc.texte("SIGNATURES", { gras: true, centre: true, apres: 12 });
  doc.champ("Fait à", `${s.lieuSignature}          Le : ${s.dateSignature}`, { apres: 10 });

  const gerant = doc.blocSignature(
    `LE VENDEUR - ${s.bailleurRaisonSociale}`,
    `Représenté par : ${s.bailleurRepresentant}`,
  );

  doc.espace(10);
  const client = doc.blocSignature("L'ACHETEUR", `Nom : ${s.clientNomComplet}`);

  return {
    octets: await doc.octets({ titre: "Contrat de vente", reference: s.reference }),
    emplacements: { client, gerant },
    pages: doc.nombreDePages,
  };
}
