/**
 * Aperçu des actes générés, pour relecture visuelle.
 *
 * Compose les contrats ET leurs annexes — constats, attestation — avec des
 * données d'exemple reprises des
 * contrats réels fournis par le client, afin qu'ils puissent être comparés
 * côte à côte avec les originaux.
 *
 * N'écrit RIEN en base et ne touche pas au stockage : c'est un rendu pur.
 *
 *   npm run apercu:contrats [dossier-de-sortie]
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { composerContratAccession } from "../src/lib/contrats/accession";
import { composerContratVente } from "../src/lib/contrats/vente";
import { composerContratJournaliere } from "../src/lib/contrats/journaliere";
import { BAILLEUR, type SnapshotContrat } from "../src/lib/contrats/snapshot";
import { composerConstatRemise, type DonneesConstat } from "../src/lib/contrats/pv-remise";
import {
  composerConstatRestitution,
  type DonneesConstatRestitution,
} from "../src/lib/contrats/pv-restitution";
import { composerAttestation, type DonneesAttestation } from "../src/lib/contrats/attestation";

/** Base commune : les mentions qui ne varient pas d'un acte à l'autre. */
const COMMUN = {
  dateEmission: "10/09/2026",
  bailleurRaisonSociale: BAILLEUR.raisonSociale,
  bailleurNinea: BAILLEUR.ninea,
  bailleurSiege: BAILLEUR.siege,
  lieuSignature: "Mbour",
  dateSignature: "17/08/2026",
  echeances: [],
  montantTotalIndicatif: "0 FCFA",
  joursFacturesIndicatif: null,
  bailleurAdresseBoutique: "Route de Fatick, quartier Téfess, Mbour",
  // Propres à la location journalière : « Néant » sur les autres actes, qui
  // ne les impriment pas.
  departLe: "Néant",
  retourLe: "Néant",
  dureeLocation: "Néant",
  tarifLocation: "Néant",
  montantCaution: "Néant",
  limiteKm: "Néant",
  forfaitKmSupplementaires: "Néant",
  zoneUtilisation: "Néant",
  etatGeneral: "Néant",
} satisfies Partial<SnapshotContrat>;

/** Locataire repris du contrat SARR Abdoulaye. */
const LOCATAIRE = {
  clientNomComplet: "SARR Abdoulaye",
  clientNumeroPiece: "1 07 20011011 000060",
  clientAdresse: "Grand Mbour",
  clientTelephone: "+221 78 455 92 90",
};

const CAS: { fichier: string; libelle: string; snapshot: SnapshotContrat }[] = [
  {
    fichier: "1-accession-24mois-B12.pdf",
    libelle: "Location-accession 24 mois - B12 a 5 000 F/j",
    snapshot: {
      ...COMMUN,
      ...LOCATAIRE,
      reference: "LME-2026-MBR-0001",
      formule: "LOCATION_ACCESSION",
      bailleurRepresentant: "NASSALAN Frédéric Olivier",
      vehiculeMarqueModele: "REVOO / B12",
      vehiculeNumeroSerie: "HB3BH2108S9110183",
      vehiculeImmatriculation: "Néant",
      vehiculeCmc: "Néant",
      vehiculeValeurReference: "860 000 FCFA",
      dureeMois: 24,
      dateDebut: "17/08/2026",
      dateFin: "17/08/2028",
      redevanceJournaliere: "5 000 FCFA",
      avecEngagement: false,
      tarifSansEngagement: "Néant",
      differentielJournalier: "Néant",
      prixTotal: "860 000 FCFA",
    },
  },
  {
    fichier: "2-accession-14mois-A10.pdf",
    libelle: "Location-accession 14 mois - A10 a 3 000 F/j, sans engagement",
    snapshot: {
      ...COMMUN,
      ...LOCATAIRE,
      reference: "LME-2026-THS-0002",
      formule: "LOCATION_ACCESSION",
      bailleurRepresentant: "MENDY Lazare Evariste",
      lieuSignature: "Thiès",
      vehiculeMarqueModele: "REVOO / A10",
      vehiculeNumeroSerie: "HB3BH2104T9103507",
      vehiculeImmatriculation: "Néant",
      vehiculeCmc: "Néant",
      vehiculeValeurReference: "410 000 FCFA",
      dureeMois: 14,
      dateDebut: "17/08/2026",
      dateFin: "17/10/2027",
      redevanceJournaliere: "3 000 FCFA",
      avecEngagement: false,
      tarifSansEngagement: "Néant",
      differentielJournalier: "Néant",
      prixTotal: "410 000 FCFA",
    },
  },
  {
    fichier: "3-accession-12mois-A10-ENGAGEMENT.pdf",
    libelle: "Location-accession 12 mois - A10 a 2 500 F/j, AVEC engagement",
    snapshot: {
      ...COMMUN,
      ...LOCATAIRE,
      reference: "LME-2026-THS-0003",
      formule: "LOCATION_ACCESSION",
      bailleurRepresentant: "MENDY Lazare Evariste",
      lieuSignature: "Thiès",
      vehiculeMarqueModele: "REVOO / A10",
      vehiculeNumeroSerie: "HB3BH2104T9103508",
      vehiculeImmatriculation: "Néant",
      vehiculeCmc: "Néant",
      vehiculeValeurReference: "410 000 FCFA",
      dureeMois: 12,
      dateDebut: "17/08/2026",
      dateFin: "17/08/2027",
      redevanceJournaliere: "2 500 FCFA",
      avecEngagement: true,
      tarifSansEngagement: "3 000 FCFA",
      differentielJournalier: "500 FCFA",
      prixTotal: "410 000 FCFA",
    },
  },
  {
    fichier: "4-vente-echelonnee.pdf",
    libelle: "Vente avec paiement echelonne - 60 % + 4 x 10 %",
    snapshot: {
      ...COMMUN,
      reference: "LME-2026-MBR-0004",
      formule: "VENTE_ECHELONNEE",
      bailleurRepresentant: "NASSALAN Frédéric Olivier",
      clientNomComplet: "DIOP Omar",
      clientNumeroPiece: "1596200100848",
      clientAdresse: "Mbour Keur Samba",
      clientTelephone: "+221 77 592 34 09",
      vehiculeMarqueModele: "REVOO / B12",
      vehiculeNumeroSerie: "HB3BH2105S9120069",
      vehiculeImmatriculation: "Néant",
      vehiculeCmc: "2026 14V 12239",
      vehiculeValeurReference: "860 000 FCFA",
      dureeMois: null,
      dateDebut: "25/06/2026",
      dateFin: "Néant",
      redevanceJournaliere: "Néant",
      avecEngagement: false,
      tarifSansEngagement: "Néant",
      differentielJournalier: "Néant",
      prixTotal: "860 000 FCFA",
      dateSignature: "25/06/2026",
    },
  },
  {
    fichier: "5-location-journaliere.pdf",
    libelle: "Location journaliere - 3 jours, caution et zone d'utilisation",
    snapshot: {
      ...COMMUN,
      reference: "LME-2026-THS-0210",
      formule: "LOCATION_JOURNALIERE",
      bailleurRepresentant: "MENDY Lazare Evariste",
      bailleurAdresseBoutique: "Avenue Général de Gaulle, Thiès",
      lieuSignature: "Thiès",
      dateSignature: "12/09/2026",
      clientNomComplet: "FALL Aminata",
      clientNumeroPiece: "2 04 19980312 000771",
      clientAdresse: "Cité Malick Sy, Thiès",
      clientTelephone: "+221 77 884 21 06",
      vehiculeMarqueModele: "REVOO / A10",
      vehiculeNumeroSerie: "HB3BH2109T9104412",
      vehiculeImmatriculation: "R 4412",
      vehiculeCmc: "Néant",
      vehiculeValeurReference: "410 000 FCFA",
      dureeMois: null,
      dateDebut: "12/09/2026",
      dateFin: "15/09/2026",
      redevanceJournaliere: "Néant",
      avecEngagement: false,
      tarifSansEngagement: "Néant",
      differentielJournalier: "Néant",
      prixTotal: "27 000 FCFA",
      modesPaiement: ["WAVE"],

      departLe: "12/09/2026 à 08h30",
      retourLe: "15/09/2026 à 18h00",
      dureeLocation: "3 jours",
      tarifLocation: "27 000 FCFA",
      montantCaution: "50 000 FCFA",
      limiteKm: "300 km",
      forfaitKmSupplementaires: "1 000 FCFA par km",
      zoneUtilisation: "Région de Thiès",
      etatGeneral: "Bon état, rayure légère sur le garde-boue arrière",
    },
  },
];

/** Chaque formule a son composeur ; aucun acte n'est improvisé. */
async function composer(snapshot: SnapshotContrat) {
  switch (snapshot.formule) {
    case "VENTE_ECHELONNEE":
      return composerContratVente(snapshot);
    case "LOCATION_JOURNALIERE":
      return composerContratJournaliere(snapshot);
    case "LOCATION_ACCESSION":
      return composerContratAccession(snapshot);
  }
}

// ---------------------------------------------------------------------------
// Actes annexes : constats et attestation. Ils ne partent pas d'un snapshot de
// contrat, chacun a ses propres données — d'où une seconde liste.
// ---------------------------------------------------------------------------

const CLIENT_CONSTAT = {
  clientNomComplet: "SARR Abdoulaye",
  clientNumeroPiece: "1 07 20011011 000060",
  clientTelephone: "+221 78 455 92 90",
  vehiculeMarqueModele: "REVOO / A10",
  vehiculeNumeroSerie: "HB3BH2108S9110183",
  bailleurSignataire: "MENDY Lazare Evariste",
  formule: "LOCATION_ACCESSION" as const,
  dureeMois: 12,
  photos: [] as { octets: Uint8Array; mimeType: string; legende?: string }[],
};

const CONSTAT_REMISE: DonneesConstat = {
  ...CLIENT_CONSTAT,
  reference: "LME-2026-THS-0003",
  pieceVerifieePar: "MENDY Lazare Evariste",
  pieceVerifieeLe: "17/08/2026 14:22:07",
  signaturesReprisesDu:
    "Signatures reprises du contrat LME-2026-THS-0003, signé le 17/08/2026.",
  dateRemise: "17/08/2026",
  heureRemise: "14h30",
  compteurKm: 12,
  carrosserie: "NEUF",
  freinsPneus: "NEUF",
  batterieChargeur: "OCCASION",
  accessoires: "COMPLETS",
  accessoiresPrecision: null,
  observations: null,
};

const CONSTAT_RESTITUTION: DonneesConstatRestitution = {
  ...CLIENT_CONSTAT,
  reference: "LME-2026-THS-0003",
  contratReference: "LME-2026-THS-0003",
  contratSigneLe: "17/08/2026",
  motif: "RUPTURE_ANTICIPEE",
  motifPrecision: null,
  dateRestitution: "27/09/2026",
  heureRestitution: "16h10",
  compteurKm: 4300,
  compteurKmRemise: 12,
  carrosserie: "USURE_NORMALE",
  freinsPneus: "DEGRADATIONS",
  batterieChargeur: "USURE_NORMALE",
  accessoires: "COMPLETS",
  accessoiresPrecision: null,
  dommagesConstates: true,
  dommagesPrecision: "Plaquettes de frein avant hors d'usage, jante arrière voilée.",
  redevancesImpayees: "45 000 FCFA",
  coutReparations: "30 000 FCFA",
  differentielRupture: "156 000 FCFA",
  differentielJours: 312,
  totalDu: "231 000 FCFA",
  observations: null,
};

const ECHEANCES_VENTE = ["1er (60 %)", "2e (10 %)", "3e (10 %)", "4e (10 %)", "5e (10 %)"];

/** Cases CUMULATIVES : au n-ième versement, les n premières sont cochées. */
const attestation = (rang: number, verse: string, restant: string): DonneesAttestation => ({
  reference: "LME-2026-MBR-0004",
  formule: "VENTE_ECHELONNEE",
  bailleurRaisonSociale: BAILLEUR.raisonSociale,
  bailleurNinea: BAILLEUR.ninea,
  bailleurSiege: BAILLEUR.siege,
  bailleurRepresentant: "NASSALAN Frédéric Olivier",
  clientNomComplet: "DIOP Omar",
  clientNumeroPiece: "2 12 19900412 000318",
  montantVerse: verse,
  datePaiement: "25/06/2026",
  mode: "ESPECES",
  montantRestantDu: restant,
  echeances: ECHEANCES_VENTE.map((libelle, i) => ({ libelle, cochee: i < rang })),
  signaturesReprisesDu:
    "Signatures reprises du contrat LME-2026-MBR-0004, signé le 25/06/2026.",
  lieuSignature: "Mbour",
  dateSignature: "25/06/2026",
});

const ANNEXES: { fichier: string; libelle: string; rendre: () => Promise<{ octets: Uint8Array; pages: number }> }[] = [
  {
    fichier: "6-constat-remise.pdf",
    libelle: "Constat d'etat - REMISE (signatures reprises du contrat)",
    rendre: () => composerConstatRemise(CONSTAT_REMISE),
  },
  {
    fichier: "7-constat-restitution.pdf",
    libelle: "Constat d'etat - RESTITUTION (rupture, degats, sommes dues)",
    rendre: () => composerConstatRestitution(CONSTAT_RESTITUTION),
  },
  {
    fichier: "8-attestation-1er-versement.pdf",
    libelle: "Attestation de versement - 1er (60 %)",
    rendre: () => composerAttestation(attestation(1, "516 000 FCFA", "344 000 FCFA")),
  },
  {
    fichier: "9-attestation-2e-versement.pdf",
    libelle: "Attestation de versement - 2e (cases CUMULATIVES : 1er et 2e coches)",
    rendre: () => composerAttestation(attestation(2, "86 000 FCFA", "258 000 FCFA")),
  },
];

async function main() {
  const sortie = path.resolve(process.argv[2] ?? "apercu-contrats");
  await fs.mkdir(sortie, { recursive: true });

  console.log(`\nComposition des actes dans ${sortie}\n`);

  for (const cas of CAS) {
    const acte = await composer(cas.snapshot);

    const destination = path.join(sortie, cas.fichier);
    await fs.writeFile(destination, acte.octets);

    const ko = (acte.octets.byteLength / 1024).toFixed(1);
    console.log(`  OK  ${cas.libelle}`);
    console.log(`      ${cas.fichier} - ${acte.pages} page(s), ${ko} Ko`);
  }

  for (const annexe of ANNEXES) {
    const acte = await annexe.rendre();
    await fs.writeFile(path.join(sortie, annexe.fichier), acte.octets);

    const ko = (acte.octets.byteLength / 1024).toFixed(1);
    console.log(`  OK  ${annexe.libelle}`);
    console.log(`      ${annexe.fichier} - ${acte.pages} page(s), ${ko} Ko`);
  }

  console.log(`\n${CAS.length + ANNEXES.length} documents composés.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
