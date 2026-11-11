/**
 * Contrat de location journalière de moto électrique.
 *
 * Texte reproduit à l'identique de l'acte fourni par le client
 * (`Contrat_location_journaliere_moto_LA_MOTHER_EXPRESS.pdf`), dix-sept
 * articles, dans le même ordre.
 *
 * ── Ce qui distingue cet acte des deux autres ──────────────────────────────
 * Il porte dix valeurs que ni la location-accession ni la vente ne demandent :
 * adresse de la boutique, heures de départ et de retour, durée, tarif,
 * caution, limite de kilométrage, forfait de dépassement, zone d'utilisation
 * et état général. Aucune ne se déduit du catalogue : elles se conviennent au
 * comptoir, et c'est le gérant qui les saisit avant de générer l'acte.
 *
 * Seule adaptation de forme : l'article 4 énonce « Mode de paiement : …… » en
 * champ libre sur le papier ; il est imprimé ici en cases à cocher, comme sur
 * les deux autres actes, puisque le gérant coche déjà ces modes. Le fond est
 * identique, la saisie est simplement homogène.
 *
 * ⚠ Toute modification du texte ci-dessous change un document juridiquement
 * engageant. Elle doit être validée par le client avant d'être livrée.
 */

import { ActePdf } from "./mise-en-page";
import type { SnapshotContrat } from "./snapshot";
import type { ActeCompose } from "./accession";
import { texteTemoin } from "./temoin";

export async function composerContratJournaliere(s: SnapshotContrat): Promise<ActeCompose> {
  const doc = await ActePdf.creer();

  let n = 0;
  const article = (intitule: string) => doc.article(++n, intitule);

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.titre("CONTRAT DE LOCATION JOURNALIÈRE DE MOTO ÉLECTRIQUE");

  doc.champ("Entreprise", `${s.bailleurRaisonSociale} (NINEA ${s.bailleurNinea})`);
  doc.champ("Adresse de la boutique", s.bailleurAdresseBoutique);
  doc.champ("Représentant", s.bailleurRepresentant, { apres: 10 });

  doc.texte("ET", { gras: true, centre: true, apres: 10 });

  doc.champ("Nom et prénom du Locataire", s.clientNomComplet);
  doc.champ("Numéro de pièce d'identité", s.clientNumeroPiece);
  doc.champ("Adresse", s.clientAdresse);
  doc.champ("Téléphone", s.clientTelephone);

  doc.separateur({ avant: 14, apres: 6 });

  // ── Article 1 ────────────────────────────────────────────────────────────
  article("Objet");
  doc.texte(
    "Le présent contrat a pour objet la location d'une moto électrique appartenant à " +
      `${s.bailleurRaisonSociale} au Locataire, pour une durée et un tarif définis ci-dessous.`,
  );

  // ── Article 2 ────────────────────────────────────────────────────────────
  article("Identification du véhicule");
  doc.champ("Marque / Modèle", s.vehiculeMarqueModele);
  doc.champ("Numéro de série / identification", s.vehiculeNumeroSerie);
  doc.champ("Numéro d'immatriculation", s.vehiculeImmatriculation);

  // ── Article 3 ────────────────────────────────────────────────────────────
  article("Durée de location");
  doc.champ("Date et heure de départ", s.departLe);
  doc.champ("Date et heure de retour", s.retourLe);
  doc.champ("Durée de location", s.dureeLocation);

  // ── Article 4 ────────────────────────────────────────────────────────────
  article("Tarif et paiement");
  doc.champ("Tarif de location (FCFA)", s.tarifLocation);
  // Libellés inchangés : seules les cases convenues sont cochées par le gérant.
  const modes = s.modesPaiement ?? [];
  doc.cases("Mode de paiement", [
    { libelle: "Espèces", cochee: modes.includes("ESPECES") },
    { libelle: "Wave", cochee: modes.includes("WAVE") },
    { libelle: "Orange Money", cochee: modes.includes("ORANGE_MONEY") },
    { libelle: "Virement", cochee: modes.includes("VIREMENT") },
  ]);

  // ── Article 5 ────────────────────────────────────────────────────────────
  article("Dépôt de garantie (caution)");
  doc.champ("Montant de la caution (FCFA)", s.montantCaution, { apres: 6 });
  doc.texte(
    "La caution couvre les dommages, pertes, vols, dépassements de kilométrage, retards de " +
      "restitution ou tout autre préjudice causé au Loueur. La caution sert de garantie partielle. " +
      "Si son montant est insuffisant pour couvrir l'intégralité des dommages ou frais, le " +
      `Locataire s'engage à payer la différence restante à ${s.bailleurRaisonSociale}.`,
  );

  // ── Article 6 ────────────────────────────────────────────────────────────
  article("Limite de kilométrage");
  doc.champ("Limite de kilométrage (km)", s.limiteKm, { apres: 6 });
  doc.texte(
    `Tout dépassement pourra être facturé selon les conditions fixées par ${s.bailleurRaisonSociale}.`,
  );
  doc.champ("Forfait km supplémentaires", s.forfaitKmSupplementaires, { avant: 6 });

  // ── Article 7 ────────────────────────────────────────────────────────────
  article("Utilisation autorisée");
  doc.texte(
    "Le Locataire s'engage à utiliser la moto conformément aux lois et règlements de la " +
      "République du Sénégal. Il est strictement interdit de prêter ou sous-louer la moto, de " +
      "transporter des marchandises illégales, d'utiliser la moto sous l'effet d'alcool ou de " +
      "drogues, et de participer à des courses ou compétitions.",
  );

  // ── Article 8 ────────────────────────────────────────────────────────────
  article("Zone d'utilisation");
  doc.champ("La moto doit être utilisée dans la zone suivante", s.zoneUtilisation, { apres: 6 });
  doc.texte("Toute sortie de cette zone sans autorisation écrite du Loueur est interdite.");

  // ── Article 9 ────────────────────────────────────────────────────────────
  article("Infractions routières");
  doc.texte(
    "Toutes les amendes, contraventions ou sanctions liées à l'utilisation du véhicule pendant la " +
      "période de location sont à la charge exclusive du Locataire.",
  );

  // ── Article 10 ───────────────────────────────────────────────────────────
  article("Accident, panne ou vol");
  doc.texte(
    `Le Locataire doit informer immédiatement ${s.bailleurRaisonSociale} en cas d'accident, panne ` +
      "ou vol du véhicule et coopérer avec les autorités.",
  );

  // ── Article 11 ───────────────────────────────────────────────────────────
  article("Batterie et recharge");
  doc.texte(
    "La batterie doit être utilisée et rechargée conformément aux instructions du Loueur. Toute " +
      "détérioration due à une mauvaise utilisation pourra être facturée.",
  );

  // ── Article 12 ───────────────────────────────────────────────────────────
  article("Retard de restitution");
  doc.texte(
    "Tout retard pourra entraîner une facturation supplémentaire ainsi qu'une retenue sur la caution.",
  );

  // ── Article 13 ───────────────────────────────────────────────────────────
  article("Suivi GPS");
  doc.texte(
    "Le Locataire accepte que le véhicule puisse être équipé d'un système de géolocalisation GPS " +
      "à des fins de sécurité et de protection du véhicule.",
  );

  // ── Article 14 ───────────────────────────────────────────────────────────
  article("Vol ou non restitution");
  doc.texte(
    "En cas de vol ou de non restitution du véhicule, le Locataire pourra être tenu responsable " +
      "du remboursement de la valeur totale du véhicule.",
  );

  // ── Article 15 ───────────────────────────────────────────────────────────
  article("État du véhicule (Checklist)");
  doc.champ("État général", s.etatGeneral);

  // ── Article 16 ───────────────────────────────────────────────────────────
  article("Résiliation");
  doc.texte(
    "Le Loueur peut mettre fin immédiatement au contrat en cas de non-respect des obligations du Locataire.",
  );

  // ── Article 17 ───────────────────────────────────────────────────────────
  article("Droit applicable");
  doc.texte("Le présent contrat est régi par les lois en vigueur en République du Sénégal.");

  // ── Signatures ───────────────────────────────────────────────────────────
  doc.separateur({ avant: 18, apres: 10 });
  doc.texte("SIGNATURES", { gras: true, centre: true, apres: 12 });
  doc.champ("Fait à", `${s.lieuSignature}          Date : ${s.dateSignature}`, { apres: 10 });

  const gerant = doc.blocSignature(
    `LE LOUEUR - ${s.bailleurRaisonSociale}`,
    `Nom : ${s.bailleurRepresentant}`,
  );

  doc.espace(10);
  const client = doc.blocSignature("LE LOCATAIRE", `Nom : ${s.clientNomComplet}`);

  // Le témoin n'apparaît que si le gérant en a désigné un. Un contrat produit
  // avant l'introduction du témoin n'en porte pas, et son instantané étant
  // figé, il ne doit pas en faire apparaître un vide.
  const temoin = s.temoinNom
    ? (() => {
        doc.espace(10);
        doc.texte(texteTemoin("Locataire"), { taille: 9.5, apres: 8 });
        return doc.blocSignature("LE TÉMOIN", `Nom : ${s.temoinNom}`);
      })()
    : undefined;

  return {
    octets: await doc.octets({
      titre: "Contrat de location journalière",
      reference: s.reference,
    }),
    emplacements: { client, gerant, temoin },
    pages: doc.nombreDePages,
  };
}
