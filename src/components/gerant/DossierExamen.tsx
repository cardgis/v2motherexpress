"use client";

/**
 * Écran de vérification d'un dossier client par le gérant.
 *
 * Conçu pour l'usage réel : le gérant a le client devant lui, souvent sur un
 * téléphone. La pièce d'identité est donc affichée EN GRAND, à côté du numéro
 * saisi par le client, pour que la confrontation se fasse d'un coup d'œil.
 *
 * Code couleur : vert pour valider (décision définitive), rouge pour renvoyer
 * le dossier (refus), gris verrouillé pour les valeurs d'un acte déjà signé.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif,
 * aucune manipulation directe du DOM.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, FileText, Undo2 } from "lucide-react";
import { LIBELLES_DOCUMENT, LIBELLES_PIECE } from "@/lib/dossier";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { fcfa, dateFr } from "@/lib/formatters";
import { formaterTelephone } from "@/lib/phone";
import { LIBELLES_MODE_PAIEMENT, MODES_PAIEMENT, normaliserModes } from "@/lib/modes-paiement";
import ContratActions from "./ContratActions";
import BoutonAttestation from "./BoutonAttestation";
import BoutonAnnulation from "./BoutonAnnulation";
import { cheminFlotte, FIL_DOSSIERS, FIL_RACINE, type BaseBackOffice } from "./espace-backoffice";
import type { TypeDocument, Formule, ModePaiement } from "@/generated/prisma";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton, LienBouton } from "@/components/ui/Bouton";
import { StatutBadge } from "@/components/ui/Badge";
import { Info, Infos } from "@/components/ui/Infos";
import { EtatVide } from "@/components/ui/EtatVide";

interface DocumentVu {
  id: string;
  type: TypeDocument;
  mimeType: string;
  tailleOctets: number;
  uploadedAt: string;
}

interface ReservationVue {
  id: string;
  reference: string;
  produit: string;
  modele: string;
  /** « REVOO / A10 » — ce que l'acte imprime si le gérant ne saisit rien. */
  modeleCatalogue: string;
  modeleContrat: string | null;
  formule: Formule;
  statut: string;
  montantTotal: number;
  redevanceJournaliere: number | null;
  /** Vente : état porté aux articles 2 et 9. « Neuf » par défaut. */
  etatVenteContrat: "NEUF" | "OCCASION";
  dureeMois: number | null;
  engagementMois: number | null;
  dateDebut: string | null;
  dateFin: string | null;
  /** « Fait à …, le … » au bas de l'acte. */
  dateSignatureContrat: string | null;
  numeroSerieContrat: string | null;
  immatriculationContrat: string | null;
  modesPaiementContrat: ModePaiement[];
  /** Location journalière : valeurs convenues au comptoir, portées sur l'acte. */
  heureDepart: string | null;
  heureRetour: string | null;
  montantCaution: number;
  limiteKm: number | null;
  forfaitKmSupp: number | null;
  zoneUtilisation: string | null;
  etatGeneralDepart: string | null;
  vehicule: { id: string; numeroChassis: string; immatriculation: string | null } | null;
  contrat: { id: string; statut: string } | null;
  /** Le constat de remise a été établi : il se rouvre depuis la fiche. */
  constatEtabli: boolean;
  /** Le contrat a été clos : son constat de restitution se rouvre de même. */
  restitutionEtablie: boolean;
  /** Le dossier peut encore être annulé par la boutique. */
  annulable: boolean;
  /** Renseigné s'il a été annulé : la raison reste lisible. */
  annuleMotif: string | null;
  /** Ce qui est dû et ce qui a été reçu, à la date d'affichage. */
  echeances: { id: string; numero: number; libelle: string; montantDu: number; echeanceLe: string }[];
  encaissements: {
    id: string;
    montant: number;
    mode: ModePaiement;
    recuLe: string;
    reference: string | null;
    recuRef: string | null;
    recuPdfPath: string | null;
    saisiParNom: string;
    annuleLe: string | null;
    annuleMotif: string | null;
  }[];
  solde: {
    duTotal: number;
    duADate: number;
    encaisse: number;
    restant: number;
    retard: number;
    joursDeRetard: number | null;
    solde: boolean;
    suiviPartiel: boolean;
  };
  vehiculesDisponibles: {
    id: string;
    numeroChassis: string;
    immatriculation: string | null;
    couleur: string | null;
  }[];
}

export interface DossierVu {
  id: string;
  nomComplet: string;
  prenom: string | null;
  nom: string | null;
  dateNaissance: string | null;
  lieuNaissance: string | null;
  nationalite: string;
  typePiece: string | null;
  numeroPiece: string | null;
  pieceDateExpiration: string | null;
  numeroPermis: string | null;
  adresse: string | null;
  quartier: string | null;
  ville: string | null;
  profession: string | null;
  /** Identifiants vérifiés du compte : l'un au moins est renseigné. */
  telephone: string | null;
  email: string | null;
  /** Déclaré par un client connecté par e-mail, non vérifié. */
  telephoneContact: string | null;
  /** Suggestions pour le champ « Marque / Modèle ». */
  modelesCatalogue: string[];
  statutKyc: string;
  kycMotifRejet: string | null;
  consentementAt: string | null;
  documents: DocumentVu[];
  etat: { complet: boolean; champsManquants: string[]; documentsManquants: TypeDocument[] };
  reservations: ReservationVue[];
}

interface ValeursActe {
  dateDebut: string;
  dateSignature: string;
  modele: string;
  numeroSerie: string;
  immatriculation: string;
  redevance: string;
  modesPaiement: ModePaiement[];
  // Vente échelonnée uniquement.
  prixVente: string;
  etatVente: "NEUF" | "OCCASION";
  // Location journalière uniquement.
  heureDepart: string;
  heureRetour: string;
  caution: string;
  limiteKm: string;
  forfaitKmSupp: string;
  zoneUtilisation: string;
  etatGeneral: string;
}

const MOTIF_MINIMUM = 10;

export default function DossierExamen({
  dossier,
  lectureSeule = false,
  base = "/gerant",
}: {
  dossier: DossierVu;
  /** Commercial : consultation du dossier et des contrats, sans décision. */
  lectureSeule?: boolean;
  /** Espace d'où l'écran est ouvert : l'administrateur ne doit pas en sortir. */
  base?: BaseBackOffice;
}) {
  const router = useRouter();

  const [affectations, setAffectations] = useState<Record<string, string>>(
    Object.fromEntries(dossier.reservations.map((r) => [r.id, r.vehicule?.id ?? ""])),
  );
  const [motif, setMotif] = useState("");
  const [formulaireRejet, setFormulaireRejet] = useState(false);
  const [tentativeRejet, setTentativeRejet] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const dejaTraite = dossier.statutKyc === "VALIDE";

  /**
   * Ce que le gérant porte lui-même sur l'acte, par réservation.
   *
   * Pré-rempli depuis la moto attribuée et le tarif calculé, mais modifiable :
   * le gérant connaît la machine qu'il remet et la redevance qu'il a convenue.
   */
  const [saisies, setSaisies] = useState<Record<string, ValeursActe>>(() =>
    Object.fromEntries(
      dossier.reservations.map((r) => [
        r.id,
        {
          dateDebut: (r.dateDebut ?? new Date().toISOString()).slice(0, 10),
          dateSignature: (r.dateSignatureContrat ?? new Date().toISOString()).slice(0, 10),
          modele: r.modeleContrat ?? r.modeleCatalogue,
          numeroSerie: r.numeroSerieContrat ?? r.vehicule?.numeroChassis ?? "",
          immatriculation: r.immatriculationContrat ?? r.vehicule?.immatriculation ?? "",
          redevance: r.redevanceJournaliere ? String(r.redevanceJournaliere) : "",
          modesPaiement: r.modesPaiementContrat,
          prixVente: r.formule === "VENTE_ECHELONNEE" ? String(r.montantTotal) : "",
          etatVente: r.etatVenteContrat,
          heureDepart: r.heureDepart ?? "",
          heureRetour: r.heureRetour ?? "",
          caution: r.montantCaution > 0 ? String(r.montantCaution) : "",
          limiteKm: r.limiteKm !== null ? String(r.limiteKm) : "",
          forfaitKmSupp: r.forfaitKmSupp !== null ? String(r.forfaitKmSupp) : "",
          zoneUtilisation: r.zoneUtilisation ?? "",
          etatGeneral: r.etatGeneralDepart ?? "",
        },
      ]),
    ),
  );

  /** Réservation dont on a tenté de générer l'acte sans aucun mode de paiement coché. */
  const [modesManquants, setModesManquants] = useState<string | null>(null);

  const majSaisie = (reservationId: string, champs: Partial<ValeursActe>) => {
    setSaisies((prec) => ({ ...prec, [reservationId]: { ...prec[reservationId]!, ...champs } }));
    // Cocher un mode retire l'erreur aussitôt, sans attendre un nouvel envoi.
    if (champs.modesPaiement?.length) setModesManquants((id) => (id === reservationId ? null : id));
  };

  async function decider(action: "valider" | "rejeter") {
    if (action === "rejeter" && motif.trim().length < MOTIF_MINIMUM) {
      setTentativeRejet(true);
      document.getElementById("motif")?.focus();
      return;
    }

    setEnCours(true);
    setErreur(null);

    try {
      const reponse = await fetch(`/api/gerant/dossiers/${dossier.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          motif,
          affectations: Object.entries(affectations)
            .filter(([, vehiculeId]) => vehiculeId !== "")
            .map(([reservationId, vehiculeId]) => ({ reservationId, vehiculeId })),
        }),
      });

      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Opération impossible.");

      router.refresh();
      setFormulaireRejet(false);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Opération impossible.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setEnCours(false);
    }
  }

  /** Produit le contrat pré-rempli d'une réservation validée. */
  async function genererContrat(reservationId: string) {
    const s = saisies[reservationId]!;
    const reservation = dossier.reservations.find((r) => r.id === reservationId);

    // Un acte sans mode de paiement convenu laisserait l'article vide : on le
    // signale sur le champ, avant tout envoi.
    if (s.modesPaiement.length === 0) {
      setModesManquants(reservationId);
      document.getElementById(`mode-${reservationId}-${MODES_PAIEMENT[0]}`)?.focus();
      return;
    }

    setEnCours(true);
    setErreur(null);

    try {
      // Corps construit champ par champ, avec les noms attendus par l'API.
      // Un modèle identique au catalogue n'est pas enregistré comme saisie :
      // l'acte suivra le catalogue si la réservation change de modèle.
      const reponse = await fetch("/api/contrats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          dateDebut: s.dateDebut,
          dateSignature: s.dateSignature,
          modele: s.modele.trim() === reservation?.modeleCatalogue ? "" : s.modele,
          numeroSerie: s.numeroSerie,
          immatriculation: s.immatriculation,
          redevanceJournaliere: s.redevance,
          modesPaiement: s.modesPaiement,
          // Le serveur ne retient ces deux valeurs que sur une vente.
          prixVente: s.prixVente,
          etatVente: s.etatVente,
          // Le serveur ne retient ces valeurs que sur une location journalière.
          heureDepart: s.heureDepart,
          heureRetour: s.heureRetour,
          caution: s.caution,
          limiteKm: s.limiteKm,
          forfaitKmSupp: s.forfaitKmSupp,
          zoneUtilisation: s.zoneUtilisation,
          etatGeneral: s.etatGeneral,
        }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Génération impossible.");

      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Génération impossible.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setEnCours(false);
    }
  }

  const motifTrop = tentativeRejet && motif.trim().length < MOTIF_MINIMUM;

  return (
    <div className="lme-page">
      <EnTetePage
        fil={[FIL_RACINE[base], FIL_DOSSIERS[base]]}
        surtitre="Dossier client"
        titre={dossier.nomComplet}
        badge={<StatutBadge type="kyc" statut={dossier.statutKyc} lecteur="gerant" />}
        description={
          <>
            {dossier.telephone ? formaterTelephone(dossier.telephone) : dossier.email}
            {dossier.telephoneContact ? ` · tél. déclaré : ${dossier.telephoneContact}` : null}
          </>
        }
      />

      <div className="lme-pile lme-pile--large">
        {erreur ? (
          <Alerte ton="erreur" vivante>
            {erreur}
          </Alerte>
        ) : null}

        {lectureSeule ? (
          <Alerte ton="info" titre="Consultation seule">
            Vous consultez ce dossier et ses contrats. La validation, les contrats et la remise des motos sont faits
            par le gérant de la boutique.
          </Alerte>
        ) : null}

        {dossier.statutKyc === "REJETE" && dossier.kycMotifRejet ? (
          <Alerte ton="erreur" titre="Dossier renvoyé au client">
            Motif transmis : « {dossier.kycMotifRejet} »
          </Alerte>
        ) : null}

        {!dossier.etat.complet ? (
          <Alerte ton="attention" titre="Dossier incomplet">
            Manquent :{" "}
            {[...dossier.etat.champsManquants, ...dossier.etat.documentsManquants.map((d) => LIBELLES_DOCUMENT[d])].join(
              ", ",
            )}
            .
          </Alerte>
        ) : null}

        {/* ── Pièces et identité, côte à côte ──────────────────────────── */}
        <Carte
          titre="Vérification de l’identité"
          description="Comparez la pièce affichée au numéro déclaré. La confrontation avec l’original se fera au retrait, en boutique."
        >
          <div className="lme-grille-verif">
            <Infos>
              <Info libelle="Numéro déclaré" valeur={dossier.numeroPiece ?? "—"} fort />
              <Info libelle="Type de pièce" valeur={libellePiece(dossier.typePiece)} />
              <Info
                libelle="Expiration"
                valeur={dossier.pieceDateExpiration ? dateFr(dossier.pieceDateExpiration) : "—"}
              />
              <Info libelle="Nom" valeur={dossier.nom ?? "—"} />
              <Info libelle="Prénom" valeur={dossier.prenom ?? "—"} />
              <Info
                libelle="Naissance"
                valeur={
                  dossier.dateNaissance
                    ? `${dateFr(dossier.dateNaissance)}${dossier.lieuNaissance ? ` à ${dossier.lieuNaissance}` : ""}`
                    : "—"
                }
              />
              <Info libelle="Nationalité" valeur={dossier.nationalite} />
              <Info libelle="Permis" valeur={dossier.numeroPermis ?? "—"} />
            </Infos>

            <div className="lme-pile">
              {dossier.documents.length === 0 ? (
                <EtatVide titre="Aucune pièce déposée" />
              ) : (
                dossier.documents.map((d) => <Piece key={d.id} document={d} />)
              )}
            </div>
          </div>
        </Carte>

        {/* ── Coordonnées ──────────────────────────────────────────────── */}
        <Carte titre="Coordonnées">
          <Infos>
            <Info
              libelle="Adresse"
              valeur={[dossier.adresse, dossier.quartier, dossier.ville].filter(Boolean).join(", ") || "—"}
            />
            <Info libelle="Profession" valeur={dossier.profession ?? "—"} />
            <Info
              libelle="Consentement au traitement"
              valeur={dossier.consentementAt ? `Donné le ${dateFr(dossier.consentementAt)}` : "Non donné"}
            />
          </Infos>
        </Carte>

        {/* ── Réservations, attribution des motos, contrats ─────────────── */}
        <Carte
          titre="Réservations"
          description="Attribuez la moto dès la validation : sans cela, le numéro de série ne sortira sur le contrat que s’il est saisi à la main."
        >
          <div className="lme-pile">
            {dossier.reservations.map((r) => (
              <BlocReservation
                key={r.id}
                reservation={r}
                dejaTraite={dejaTraite}
                enCours={enCours}
                affectation={affectations[r.id] ?? ""}
                onAffecter={(vehiculeId) => setAffectations((prec) => ({ ...prec, [r.id]: vehiculeId }))}
                saisie={saisies[r.id]!}
                onSaisie={(champs) => majSaisie(r.id, champs)}
                onGenerer={() => genererContrat(r.id)}
                erreurModes={modesManquants === r.id}
                onErreur={setErreur}
                lectureSeule={lectureSeule}
                base={base}
                modelesCatalogue={dossier.modelesCatalogue}
              />
            ))}
          </div>
        </Carte>

        {/* ── Décision ─────────────────────────────────────────────────── */}
        {lectureSeule ? null : !dejaTraite ? (
          <Carte titre="Décision" description="La validation fige l’identité du client et fait avancer ses réservations.">
            {!formulaireRejet ? (
              <div className="lme-pile lme-pile--serree">
                <div className="lme-rangee">
                  <Bouton
                    variante="succes"
                    icone={<CircleCheck size={18} aria-hidden />}
                    onClick={() => decider("valider")}
                    chargement={enCours}
                    disabled={!dossier.etat.complet}
                  >
                    Valider le dossier
                  </Bouton>
                  <Bouton
                    variante="secondaire"
                    icone={<Undo2 size={18} aria-hidden />}
                    onClick={() => setFormulaireRejet(true)}
                    disabled={enCours}
                  >
                    Demander une correction
                  </Bouton>
                </div>
                {!dossier.etat.complet ? (
                  <p className="lme-message lme-message--attention">
                    Le dossier doit être complet pour être validé.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="lme-pile">
                <Champ
                  libelle="Ce que le client doit corriger"
                  requis
                  erreur={motifTrop ? `Rédigez au moins une phrase (${MOTIF_MINIMUM} caractères).` : null}
                  aide="Ce texte s’affichera tel quel dans l’espace du client : rédigez-le pour lui."
                >
                  <textarea
                    id="motif"
                    rows={3}
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="La photo du verso de votre pièce est floue, le numéro n’est pas lisible. Merci de la reprendre."
                  />
                </Champ>
                <div className="lme-rangee">
                  <Bouton variante="danger" onClick={() => decider("rejeter")} chargement={enCours}>
                    Renvoyer le dossier au client
                  </Bouton>
                  <Bouton
                    variante="fantome"
                    onClick={() => {
                      setFormulaireRejet(false);
                      setTentativeRejet(false);
                      setErreur(null);
                    }}
                    disabled={enCours}
                  >
                    Annuler
                  </Bouton>
                </div>
              </div>
            )}
          </Carte>
        ) : (
          <Alerte ton="succes" titre="Dossier validé">
            Les réservations sont passées en attente de contrat. Générez le contrat depuis chaque réservation
            ci-dessus.
          </Alerte>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Une réservation
// ---------------------------------------------------------------------------

/** Un acte parti à la contre-signature ne se modifie plus. */
function acteFige(r: { contrat: { statut: string } | null }): boolean {
  return r.contrat !== null && ["A_SIGNER_GERANT", "SIGNE", "EN_ATTENTE_RETRAIT", "RETIRE"].includes(r.contrat.statut);
}

function BlocReservation({
  reservation: r,
  dejaTraite,
  enCours,
  affectation,
  onAffecter,
  saisie,
  onSaisie,
  onGenerer,
  erreurModes,
  onErreur,
  lectureSeule,
  base,
  modelesCatalogue,
}: {
  reservation: ReservationVue;
  dejaTraite: boolean;
  enCours: boolean;
  affectation: string;
  onAffecter: (vehiculeId: string) => void;
  saisie: ValeursActe;
  onSaisie: (champs: Partial<ValeursActe>) => void;
  onGenerer: () => void;
  erreurModes: boolean;
  onErreur: (message: string | null) => void;
  lectureSeule: boolean;
  base: BaseBackOffice;
  modelesCatalogue: string[];
}) {
  const signe = acteFige(r);
  // Un commercial voit l'acte tel qu'il sera imprimé, sans pouvoir y toucher.
  const fige = signe || lectureSeule;
  const verrou = signe
    ? "Contrat signé par le client : l’acte ne se modifie plus."
    : lectureSeule
      ? "Consultation seule."
      : undefined;

  return (
    <article className="lme-bloc">
      <div className="lme-rangee lme-rangee--entre" style={{ alignItems: "flex-start" }}>
        <div>
          <h3 className="lme-sous-titre">
            {r.reference} — {r.produit}
          </h3>
          <p className="lme-aide">
            {LIBELLES_FORMULE[r.formule]}
            {r.dureeMois ? ` · ${r.dureeMois} mois` : null}
            {r.engagementMois ? " · engagement ferme" : null}
            {r.redevanceJournaliere ? ` · ${fcfa(r.redevanceJournaliere)}/jour` : null}
          </p>
          <p className="lme-rangee" style={{ gap: 6, marginTop: 8 }}>
            <StatutBadge type="reservation" statut={r.statut} lecteur="gerant" />
            {r.contrat ? <StatutBadge type="contrat" statut={r.contrat.statut} lecteur="gerant" /> : null}
          </p>
        </div>
        <span className="lme-montant">{fcfa(r.montantTotal)}</span>
      </div>

      <div style={{ marginTop: 16 }}>
        {r.vehicule ? (
          <Infos>
            <Info
              libelle="Moto attribuée"
              valeur={`${r.vehicule.numeroChassis}${r.vehicule.immatriculation ? ` — ${r.vehicule.immatriculation}` : ""}`}
            />
          </Infos>
        ) : r.vehiculesDisponibles.length === 0 ? (
          <Alerte
            ton="attention"
            titre={`Aucune moto ${r.modele} disponible dans votre boutique`}
            actions={
              !dejaTraite && !lectureSeule ? (
                <LienBouton href={cheminFlotte(base)} variante="secondaire" taille="sm">
                  Ajouter une moto à la flotte
                </LienBouton>
              ) : null
            }
          >
            {dejaTraite
              ? "Saisissez le numéro de série à la main dans les champs du contrat ci-dessous."
              : "Ajoutez-la à votre flotte avant de valider le dossier pour pouvoir l’attribuer."}
          </Alerte>
        ) : (
          <Champ
            libelle="Moto attribuée"
            facultatif={!dejaTraite}
            aide={dejaTraite ? undefined : "L’attribution se fait à la validation du dossier."}
            verrou={dejaTraite ? "Aucune moto attribuée lors de la validation." : undefined}
          >
            <select
              id={`veh-${r.id}`}
              value={affectation}
              onChange={(e) => onAffecter(e.target.value)}
              disabled={dejaTraite || enCours || lectureSeule}
            >
              <option value="">Ne pas attribuer maintenant</option>
              {r.vehiculesDisponibles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.numeroChassis}
                  {v.couleur ? ` — ${v.couleur}` : ""}
                  {v.immatriculation ? ` — ${v.immatriculation}` : ""}
                </option>
              ))}
            </select>
          </Champ>
        )}
      </div>

      {/* Le contrat ne peut être établi qu'une fois le dossier validé. */}
      {dejaTraite ? (
        <>
          <div className="lme-encart" style={{ marginTop: 16 }}>
            <h4 className="lme-sous-titre">Ce qui figurera sur l’acte</h4>
            <p className="lme-aide" style={{ marginBottom: 14 }}>
              Laissé vide, un champ imprime « Néant ». Modifiable tant que le client n’a pas signé.
            </p>

            <div className="lme-grille-champs">
              <Champ libelle="Marque / Modèle" aide={`Réservé : ${r.modeleCatalogue}. Le tarif ne change pas.`} verrou={verrou}>
                <input
                  id={`modele-${r.id}`}
                  list={`modeles-${r.id}`}
                  maxLength={80}
                  value={saisie.modele}
                  onChange={(e) => onSaisie({ modele: e.target.value })}
                  placeholder={r.modeleCatalogue}
                  disabled={fige}
                />
              </Champ>

              {r.formule !== "LOCATION_JOURNALIERE" ? (
                <Champ
                  libelle="Date de prise d’effet"
                  aide={r.dureeMois ? `Fin calculée : + ${r.dureeMois} mois.` : undefined}
                  verrou={verrou}
                >
                  <input
                    id={`date-${r.id}`}
                    type="date"
                    value={saisie.dateDebut}
                    onChange={(e) => onSaisie({ dateDebut: e.target.value })}
                    disabled={fige}
                  />
                </Champ>
              ) : null}

              {/* Vaut pour les trois actes : un contrat préparé la veille ne
                  doit pas porter la date de sa génération. */}
              <Champ libelle="Date de signature" aide="« Fait à …, le … » au bas de l’acte." verrou={verrou}>
                <input
                  id={`date-signature-${r.id}`}
                  type="date"
                  value={saisie.dateSignature}
                  onChange={(e) => onSaisie({ dateSignature: e.target.value })}
                  disabled={fige}
                />
              </Champ>

              <Champ libelle="Numéro de série" verrou={verrou}>
                <input
                  id={`serie-${r.id}`}
                  className="lme-mono"
                  maxLength={60}
                  value={saisie.numeroSerie}
                  onChange={(e) => onSaisie({ numeroSerie: e.target.value })}
                  placeholder="Néant"
                  disabled={fige}
                />
              </Champ>

              <Champ libelle="Immatriculation" verrou={verrou}>
                <input
                  id={`immat-${r.id}`}
                  maxLength={30}
                  value={saisie.immatriculation}
                  onChange={(e) => onSaisie({ immatriculation: e.target.value })}
                  placeholder="Néant"
                  disabled={fige}
                />
              </Champ>

              {r.formule !== "VENTE_ECHELONNEE" ? (
                <Champ libelle="Redevance journalière (FCFA)" aide="Article 4 — due 6 jours sur 7." verrou={verrou}>
                  <input
                    id={`redevance-${r.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100}
                    value={saisie.redevance}
                    onChange={(e) => onSaisie({ redevance: e.target.value })}
                    placeholder="2500"
                    disabled={fige}
                  />
                </Champ>
              ) : null}

              {r.formule === "VENTE_ECHELONNEE" ? (
                <Champ
                  libelle="Prix de vente (FCFA)"
                  aide="Article 3 — les 60 % puis quatre fois 10 % en sont tirés."
                  verrou={verrou}
                >
                  <input
                    id={`prix-${r.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={5000}
                    value={saisie.prixVente}
                    onChange={(e) => onSaisie({ prixVente: e.target.value })}
                    placeholder={String(r.montantTotal)}
                    disabled={fige}
                  />
                </Champ>
              ) : null}
            </div>

            {/* Cases de l'article « Modalités de paiement » : les libellés de
                l'acte ne changent pas, seules les cases convenues sont cochées. */}
            <fieldset
              className="lme-groupe"
              style={{ marginTop: 18 }}
              aria-describedby={`modes-${r.id}-message`}
            >
              <legend>
                Modes de paiement
                <span className="lme-requis" aria-hidden>
                  *
                </span>
              </legend>
              <div className="lme-grille-choix">
                {MODES_PAIEMENT.map((mode) => (
                  <label key={mode} className="lme-case">
                    <input
                      type="checkbox"
                      id={`mode-${r.id}-${mode}`}
                      checked={saisie.modesPaiement.includes(mode)}
                      disabled={fige}
                      aria-invalid={erreurModes || undefined}
                      onChange={(e) =>
                        onSaisie({
                          modesPaiement: normaliserModes(
                            e.target.checked
                              ? [...saisie.modesPaiement, mode]
                              : saisie.modesPaiement.filter((m) => m !== mode),
                          ),
                        })
                      }
                    />
                    <span>{LIBELLES_MODE_PAIEMENT[mode]}</span>
                  </label>
                ))}
              </div>
              <p
                id={`modes-${r.id}-message`}
                className={erreurModes ? "lme-message lme-message--erreur" : "lme-aide"}
                role={erreurModes ? "alert" : undefined}
                style={{ marginTop: 8 }}
              >
                {erreurModes
                  ? "Cochez au moins un mode de paiement convenu avec le client."
                  : fige
                    ? verrou
                    : "Un ou plusieurs : les cases correspondantes seront cochées sur le contrat."}
              </p>
            </fieldset>

            {/* Vente : l'article 2 annonce l'état, l'article 9 le fait
                constater. Les deux libellés de l'acte restent imprimés, seule
                la case retenue porte la croix. */}
            {r.formule === "VENTE_ECHELONNEE" ? (
              <fieldset className="lme-groupe" style={{ marginTop: 18 }}>
                <legend>État du véhicule</legend>
                <div className="lme-grille-choix">
                  {(
                    [
                      { cle: "NEUF", libelle: "Neuf" },
                      { cle: "OCCASION", libelle: "D’occasion" },
                    ] as const
                  ).map((etat) => (
                    <label key={etat.cle} className="lme-case">
                      <input
                        type="radio"
                        name={`etat-vente-${r.id}`}
                        id={`etat-vente-${r.id}-${etat.cle}`}
                        checked={saisie.etatVente === etat.cle}
                        disabled={fige}
                        onChange={() => onSaisie({ etatVente: etat.cle })}
                      />
                      <span>{etat.libelle}</span>
                    </label>
                  ))}
                </div>
                <p className="lme-aide" style={{ marginTop: 8 }}>
                  {fige
                    ? verrou
                    : "Articles 2 et 9. Les motos vendues sont neuves : « Neuf » est coché par défaut."}
                </p>
              </fieldset>
            ) : null}

            {/* Location journalière : l'acte demande sept valeurs de plus, qui
                se conviennent au comptoir et ne se déduisent de rien. */}
            {r.formule === "LOCATION_JOURNALIERE" ? (
              <div style={{ marginTop: 18 }}>
                <h4 className="lme-sous-titre">Conditions de la location</h4>
                <p className="lme-aide" style={{ marginBottom: 14 }}>
                  Articles 3 à 8 et 15 de l’acte. Un champ laissé vide imprime « Néant », comme les pointillés du
                  contrat papier.
                </p>

                <div className="lme-grille-champs">
                  <Champ libelle="Heure de départ" aide="Article 3." verrou={verrou}>
                    <input
                      id={`heure-depart-${r.id}`}
                      maxLength={10}
                      value={saisie.heureDepart}
                      onChange={(e) => onSaisie({ heureDepart: e.target.value })}
                      placeholder="08h30"
                      disabled={fige}
                    />
                  </Champ>

                  <Champ libelle="Heure de retour" verrou={verrou}>
                    <input
                      id={`heure-retour-${r.id}`}
                      maxLength={10}
                      value={saisie.heureRetour}
                      onChange={(e) => onSaisie({ heureRetour: e.target.value })}
                      placeholder="18h00"
                      disabled={fige}
                    />
                  </Champ>

                  <Champ libelle="Caution (FCFA)" aide="Article 5 — retenue en cas de dommage." verrou={verrou}>
                    <input
                      id={`caution-${r.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={5000}
                      value={saisie.caution}
                      onChange={(e) => onSaisie({ caution: e.target.value })}
                      placeholder="50000"
                      disabled={fige}
                    />
                  </Champ>

                  <Champ libelle="Limite de kilométrage (km)" aide="Article 6." verrou={verrou}>
                    <input
                      id={`limite-km-${r.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={50}
                      value={saisie.limiteKm}
                      onChange={(e) => onSaisie({ limiteKm: e.target.value })}
                      placeholder="300"
                      disabled={fige}
                    />
                  </Champ>

                  <Champ libelle="Forfait par km supplémentaire (FCFA)" verrou={verrou}>
                    <input
                      id={`forfait-km-${r.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100}
                      value={saisie.forfaitKmSupp}
                      onChange={(e) => onSaisie({ forfaitKmSupp: e.target.value })}
                      placeholder="1000"
                      disabled={fige}
                    />
                  </Champ>

                  <Champ libelle="Zone d’utilisation" aide="Article 8 — sortie interdite sans accord écrit." verrou={verrou}>
                    <input
                      id={`zone-${r.id}`}
                      maxLength={120}
                      value={saisie.zoneUtilisation}
                      onChange={(e) => onSaisie({ zoneUtilisation: e.target.value })}
                      placeholder="Région de Thiès"
                      disabled={fige}
                    />
                  </Champ>

                  <Champ libelle="État général au départ" aide="Article 15." verrou={verrou}>
                    <input
                      id={`etat-${r.id}`}
                      maxLength={200}
                      value={saisie.etatGeneral}
                      onChange={(e) => onSaisie({ etatGeneral: e.target.value })}
                      placeholder="Bon état, rayure légère sur le garde-boue arrière"
                      disabled={fige}
                    />
                  </Champ>
                </div>
              </div>
            ) : null}

            <datalist id={`modeles-${r.id}`}>
              {modelesCatalogue.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="lme-rangee" style={{ marginTop: 14 }}>
            {!fige ? (
              <Bouton
                variante={r.contrat ? "secondaire" : "primaire"}
                icone={<FileText size={18} aria-hidden />}
                onClick={onGenerer}
                chargement={enCours}
              >
                {r.contrat ? "Régénérer le contrat" : "Générer le contrat"}
              </Bouton>
            ) : null}
            {r.contrat ? (
              <LienBouton href={`/api/contrats/${r.contrat.id}/pdf`} nouvelOnglet variante="secondaire">
                Ouvrir le contrat
              </LienBouton>
            ) : null}
            {r.constatEtabli ? (
              <LienBouton href={`/api/actes/constat/${r.id}`} nouvelOnglet variante="secondaire">
                Constat de remise
              </LienBouton>
            ) : null}
            {r.restitutionEtablie ? (
              <LienBouton href={`/api/actes/restitution/${r.id}`} nouvelOnglet variante="secondaire">
                Constat de restitution
              </LienBouton>
            ) : null}
          </div>

          {/* Le client s'est désisté : la boutique annule et rend la moto au
              stock. Hors du rang d'action, le panneau de motif y serait à
              l'étroit. */}
          {r.annulable && !lectureSeule ? (
            <BoutonAnnulation
              reservationId={r.id}
              reference={r.reference}
              vehiculeAttribue={r.vehicule !== null}
              onErreur={onErreur}
            />
          ) : null}

          {r.annuleMotif ? (
            <p className="lme-aide" style={{ marginTop: 12 }}>
              Dossier annulé — motif : « {r.annuleMotif} »
            </p>
          ) : null}

          {r.contrat && !lectureSeule ? (
            <div style={{ marginTop: 14 }}>
              <ContratActions contratId={r.contrat.id} reservationId={r.id} statut={r.contrat.statut} base={base} />
            </div>
          ) : null}

          <BlocVersements reservation={r} lectureSeule={lectureSeule} />
        </>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Versements
// ---------------------------------------------------------------------------

/**
 * Où en est l'argent de CE dossier.
 *
 * Le client appelle au sujet de son échéancier : le gérant répond sans quitter
 * la fiche, et redonne au besoin une attestation déjà produite. La saisie d'un
 * versement, elle, reste au tableau de bord — c'est là que le client se
 * présente, souvent sans qu'on ait sa fiche sous les yeux.
 */
function BlocVersements({
  reservation: r,
  lectureSeule,
}: {
  reservation: ReservationVue;
  lectureSeule: boolean;
}) {
  const vivants = r.encaissements.filter((v) => v.annuleLe === null);

  // Rien à montrer tant que le contrat n'est pas scellé : il n'y a pas encore
  // d'argent à réclamer.
  if (r.echeances.length === 0 && r.encaissements.length === 0 && r.solde.duADate === 0) return null;

  return (
    <div className="lme-encart" style={{ marginTop: 16 }}>
      <div className="lme-rangee lme-rangee--entre" style={{ alignItems: "flex-start" }}>
        <h4 className="lme-sous-titre">Versements</h4>
        <span
          className="lme-gras"
          style={{ color: r.solde.retard > 0 ? "var(--lme-erreur)" : undefined }}
        >
          {r.solde.solde
            ? "Soldé"
            : r.solde.retard > 0
              ? `${fcfa(r.solde.retard)} en retard`
              : "À jour"}
        </span>
      </div>

      <dl className="lme-grille-champs" style={{ marginTop: 12 }}>
        <div>
          <dt className="lme-aide">Dû à ce jour</dt>
          <dd className="lme-gras">{fcfa(r.solde.duADate)}</dd>
        </div>
        <div>
          <dt className="lme-aide">Encaissé</dt>
          <dd className="lme-gras">{fcfa(r.solde.encaisse)}</dd>
        </div>
        <div>
          <dt className="lme-aide">Reste au terme</dt>
          <dd className="lme-gras">{fcfa(r.solde.restant)}</dd>
        </div>
      </dl>

      {r.solde.suiviPartiel ? (
        <p className="lme-aide" style={{ marginTop: 10 }}>
          Contrat scellé avant la mise en service du suivi : seuls les versements postérieurs sont comptés.
        </p>
      ) : null}

      {r.echeances.length > 0 ? (
        <table className="lme-tableau" style={{ marginTop: 14 }}>
          <caption className="lme-sr">Échéancier</caption>
          <thead>
            <tr>
              <th scope="col">Échéance</th>
              <th scope="col">Due le</th>
              <th scope="col" className="lme-nombre">Montant</th>
            </tr>
          </thead>
          <tbody>
            {r.echeances.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.libelle}</th>
                <td>{dateFr(e.echeanceLe)}</td>
                <td className="lme-nombre">{fcfa(e.montantDu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {r.encaissements.length === 0 ? (
        <p className="lme-aide" style={{ marginTop: 12 }}>
          Aucun versement reçu. La saisie se fait depuis le tableau de bord.
        </p>
      ) : (
        <ul className="lme-liste" style={{ marginTop: 12 }}>
          {r.encaissements.map((v) => (
            <li key={v.id} className="lme-ligne">
              <div className="lme-ligne__principal">
                <p className="lme-ligne__titre">
                  <span style={{ textDecoration: v.annuleLe ? "line-through" : undefined }}>
                    {fcfa(v.montant)}
                  </span>
                </p>
                <p className="lme-ligne__meta">
                  {dateFr(v.recuLe)} · {LIBELLES_MODE_PAIEMENT[v.mode]} · saisi par {v.saisiParNom}
                  {v.recuRef ? ` · reçu ${v.recuRef}` : ""}
                </p>
                {v.annuleMotif ? (
                  <p className="lme-ligne__meta">Annulé : « {v.annuleMotif} »</p>
                ) : null}
              </div>
              {v.annuleLe || lectureSeule ? null : (
                <div className="lme-ligne__fin">
                  <BoutonAttestation encaissementId={v.id} dejaTiree={v.recuPdfPath !== null} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="lme-aide" style={{ marginTop: 12 }}>
        {vivants.length > 0
          ? "Une attestation déjà produite se rouvre telle quelle : c'est elle qu'on redonne à un client qui a perdu la sienne."
          : null}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pièce justificative
// ---------------------------------------------------------------------------

/**
 * L'image passe par `/api/documents/[id]`, seule voie de lecture autorisée :
 * aucune URL de stockage n'est jamais exposée au navigateur.
 */
function Piece({ document }: { document: DocumentVu }) {
  const estImage = document.mimeType.startsWith("image/");
  const libelle = LIBELLES_DOCUMENT[document.type];

  return (
    <figure className="lme-piece">
      <figcaption>
        <span>{libelle}</span>
        <a href={`/api/documents/${document.id}`} target="_blank" rel="noopener noreferrer">
          Plein écran ↗<span className="lme-sr"> (nouvel onglet)</span>
        </a>
      </figcaption>

      {estImage ? (
        // Flux d'image authentifié servi par l'API : next/image ne peut pas l'optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/documents/${document.id}`} alt={libelle} />
      ) : (
        <LienBouton href={`/api/documents/${document.id}`} nouvelOnglet variante="secondaire" bloc>
          Ouvrir le document ({Math.round(document.tailleOctets / 1024)} Ko)
        </LienBouton>
      )}
    </figure>
  );
}

function libellePiece(type: string | null): string {
  if (!type) return "—";
  return LIBELLES_PIECE[type as keyof typeof LIBELLES_PIECE] ?? type;
}
