"use client";

/**
 * Réservation en trois étapes courtes : modèle → formule → boutique.
 *
 * Contraintes de terrain (mobile, 3G/4G instable au Sénégal) :
 *   — chaque choix est immédiatement écrit dans le stockage local, si bien
 *     qu'une coupure ou un rechargement ne fait rien perdre ;
 *   — les étapes sont courtes, une décision à la fois, pour ne pas imposer
 *     un long formulaire sur un écran de téléphone ;
 *   — le montant est recalculé par le serveur à chaque changement, jamais
 *     dans le navigateur : ce qui est affiché est ce qui sera enregistré ;
 *   — l'appel réseau est débattu, pour ne pas saturer une connexion lente.
 *
 * Les choix sont de vrais boutons radio (composant `Choix`) : sélection au
 * clavier avec les flèches, groupe annoncé aux lecteurs d'écran.
 *
 * Conformément à CLAUDE.md : aucun `<dialog>` natif, aucune manipulation
 * directe du DOM — tout passe par l'état React.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, TriangleAlert } from "lucide-react";
import type { Formule } from "@/generated/prisma";
import { fcfa, nombre } from "@/lib/formatters";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";
import { Etapes } from "@/components/ui/Etapes";
import { Choix, GroupeChoix } from "@/components/ui/Choix";
import { LigneRecap, Recapitulatif } from "@/components/ui/Infos";
import { ImageProduit } from "@/components/ImageProduit";

export interface OffreAccessionAffichee {
  cle: string;
  libelle: string;
  redevanceJournaliere: number;
  dureeMois: number;
  joursFactures: number;
  montantTotal: number;
  avecEngagement: boolean;
  differentielSiRupture: number;
}

export interface ProduitOffre {
  id: string;
  nom: string;
  modele: string;
  imageUrl: string | null;
  autonomieKm: number;
  vitesseMaxKmh: number;
  prixVente: number | null;
  tarifJournee: number | null;
  formules: Formule[];
  offresAccession: OffreAccessionAffichee[];
}

export interface BoutiqueChoix {
  id: string;
  nom: string;
  ville: string | null;
  adresse: string;
}

interface Devis {
  montantTotal: number;
  montantAcompte: number;
  redevanceJournaliere: number | null;
  nbJours: number | null;
  engagementMois: number | null;
  differentielSiRupture: number | null;
  echeances: { numero: number; libelle: string; montant: number; jourDepuisSignature: number }[];
  tarifProvisoire: boolean;
}

const CLE_BROUILLON = "lme_reservation_brouillon";

interface Brouillon {
  etape: number;
  produitId: string;
  formule: Formule | "";
  offreCle: string;
  dateDebut: string;
  dateFin: string;
  boutiqueId: string;
}

const BROUILLON_VIDE: Brouillon = {
  etape: 1,
  produitId: "",
  formule: "",
  offreCle: "",
  dateDebut: "",
  dateFin: "",
  boutiqueId: "",
};

export default function ReservationForm({
  produits,
  boutiques,
  selection = null,
}: {
  produits: ProduitOffre[];
  boutiques: BoutiqueChoix[];
  /** Modèle (et formule) choisis sur la fiche d'un modèle du site, avant la connexion. */
  selection?: { produitId: string; formule: Formule | "" } | null;
}) {
  const router = useRouter();

  const [b, setB] = useState<Brouillon>(BROUILLON_VIDE);
  /**
   * Le devis est mémorisé AVEC la clé des choix qui l'ont produit. Il est
   * ensuite dérivé au rendu par comparaison des clés : un devis calculé pour
   * un autre modèle ne peut donc jamais rester affiché, sans avoir à le
   * remettre à zéro à la main dans un effet.
   */
  const [devisCache, setDevisCache] = useState<{ cle: string; valeur: Devis } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [brouillonCharge, setBrouillonCharge] = useState(false);

  // ── Reprise après coupure ────────────────────────────────────────────────
  //
  // `localStorage` n'existe pas au rendu serveur : la restauration ne peut ni
  // se faire à l'initialisation de l'état, ni pendant le rendu, sous peine de
  // divergence d'hydratation. L'effet au montage est ici le seul patron
  // correct, d'où la dérogation ciblée à react-hooks/set-state-in-effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let depart = BROUILLON_VIDE;
    try {
      const brut = localStorage.getItem(CLE_BROUILLON);
      if (brut) {
        const sauvegarde = { ...BROUILLON_VIDE, ...(JSON.parse(brut) as Partial<Brouillon>) };
        // Un modèle retiré du catalogue depuis la sauvegarde est ignoré.
        const modeleToujoursAuCatalogue =
          !sauvegarde.produitId || produits.some((p) => p.id === sauvegarde.produitId);
        if (modeleToujoursAuCatalogue) depart = sauvegarde;
      }
    } catch {
      // Stockage indisponible (navigation privée) — on repart d'un formulaire vide.
    }

    // Arrivée depuis la fiche d'un modèle : ce choix, tout récent, prime sur un
    // brouillon plus ancien. On ouvre directement l'étape de la formule.
    if (selection && produits.some((p) => p.id === selection.produitId)) {
      depart = {
        ...depart,
        etape: 2,
        produitId: selection.produitId,
        formule: selection.formule,
        offreCle: "",
        dateDebut: "",
        dateFin: "",
      };
      // L'adresse est nettoyée : recharger la page ne doit pas écraser les
      // choix faits entre-temps.
      router.replace("/compte/reserver", { scroll: false });
    }

    setB(depart);
    setBrouillonCharge(true);
  }, [produits, selection, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!brouillonCharge) return;
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify(b));
    } catch {
      // Sans stockage local, la saisie fonctionne, elle n'est simplement pas reprise.
    }
  }, [b, brouillonCharge]);

  const maj = useCallback((champs: Partial<Brouillon>) => {
    setB((prec) => ({ ...prec, ...champs }));
    setErreur(null);
  }, []);

  const allerA = useCallback(
    (etape: number) => {
      maj({ etape });
      document.getElementById("reservation-etapes")?.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    [maj],
  );

  const produit = produits.find((p) => p.id === b.produitId) ?? null;

  // ── Chiffrage en direct, débattu ─────────────────────────────────────────

  /**
   * Clé des choix chiffrables. `null` tant que la saisie est incomplète —
   * c'est elle qui pilote l'affichage du montant, sans état intermédiaire.
   */
  const cleDevis =
    b.produitId &&
    b.formule &&
    (b.formule !== "LOCATION_JOURNALIERE" || (b.dateDebut && b.dateFin)) &&
    (b.formule !== "LOCATION_ACCESSION" || b.offreCle)
      ? JSON.stringify([b.produitId, b.formule, b.offreCle, b.dateDebut, b.dateFin])
      : null;

  const devis = cleDevis && devisCache?.cle === cleDevis ? devisCache.valeur : null;
  const calculEnCours = cleDevis !== null && devis === null && erreur === null;

  const dernierAppel = useRef(0);

  useEffect(() => {
    if (!cleDevis) return;

    const appel = ++dernierAppel.current;

    const minuteur = setTimeout(async () => {
      try {
        const reponse = await fetch("/api/reservations/devis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produitId: b.produitId,
            boutiqueId: b.boutiqueId || boutiques[0]?.id,
            formule: b.formule,
            offreCle: b.offreCle || undefined,
            dateDebut: b.dateDebut || undefined,
            dateFin: b.dateFin || undefined,
          }),
        });
        const donnees = await reponse.json().catch(() => null);

        // Une réponse arrivée après un changement plus récent est ignorée.
        if (appel !== dernierAppel.current) return;

        if (!reponse.ok) {
          setDevisCache(null);
          setErreur(donnees?.error ?? "Calcul impossible.");
        } else {
          setDevisCache({ cle: cleDevis, valeur: donnees });
          setErreur(null);
        }
      } catch {
        if (appel === dernierAppel.current) setErreur("Connexion perdue. Vérifiez votre réseau.");
      }
    }, 350);

    return () => clearTimeout(minuteur);
  }, [cleDevis, b.produitId, b.formule, b.offreCle, b.dateDebut, b.dateFin, b.boutiqueId, boutiques]);

  async function valider() {
    setEnvoi(true);
    setErreur(null);

    try {
      const reponse = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produitId: b.produitId,
          boutiqueId: b.boutiqueId,
          formule: b.formule,
          offreCle: b.offreCle || undefined,
          dateDebut: b.dateDebut || undefined,
          dateFin: b.dateFin || undefined,
        }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Réservation impossible.");

      try {
        localStorage.removeItem(CLE_BROUILLON);
      } catch {
        /* sans conséquence */
      }

      router.replace(donnees.destination);
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Réservation impossible.");
      setEnvoi(false);
    }
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="lme-page lme-page--etroite">
      <EnTetePage
        fil={[{ libelle: "Mon espace", href: "/compte" }]}
        surtitre="Réservation"
        titre="Réserver un scooter"
        description="Trois étapes : le modèle, la formule, la boutique de retrait. Vos choix sont conservés si la connexion coupe."
      />

      <div id="reservation-etapes">
        <Etapes libelles={["Modèle", "Formule", "Boutique"]} courante={b.etape} onAller={allerA} nom="Étapes de la réservation" />
      </div>

      {/* ── Étape 1 : le modèle ───────────────────────────────────────── */}
      {b.etape === 1 ? (
        <Carte titre="Quel modèle vous intéresse ?">
          <GroupeChoix legende={<span className="lme-sr">Modèle de scooter</span>} disposition="grille">
            {produits.map((p) => (
              <Choix
                key={p.id}
                nom="modele"
                valeur={p.id}
                coche={p.id === b.produitId}
                onChoisir={(id) => maj({ produitId: id, formule: "", offreCle: "" })}
                image={
                  p.imageUrl ? (
                    // `span` et non `div` : le contenu d'un <label> doit rester en ligne.
                    <span className="lme-choix__image">
                      <ImageProduit src={p.imageUrl} alt="" sizes="(max-width: 600px) 45vw, 240px" />
                    </span>
                  ) : undefined
                }
                titre={p.nom}
                detail={`${nombre(p.autonomieKm)} km d’autonomie · ${p.vitesseMaxKmh} km/h`}
              >
                {p.prixVente ? <span className="lme-choix__valeur">{fcfa(p.prixVente)}</span> : null}
              </Choix>
            ))}
          </GroupeChoix>

          <BarreActions
            suivantActif={!!b.produitId}
            raisonBlocage="Choisissez d’abord un modèle."
            onSuivant={() => allerA(2)}
          />
        </Carte>
      ) : null}

      {/* ── Étape 2 : la formule ──────────────────────────────────────── */}
      {b.etape === 2 && produit ? (
        <Carte titre="Comment souhaitez-vous en disposer ?" description={produit.nom}>
          <div className="lme-pile">
            <GroupeChoix legende={<span className="lme-sr">Formule</span>}>
              {produit.formules.map((f) => (
                <Choix
                  key={f}
                  nom="formule"
                  valeur={f}
                  coche={f === b.formule}
                  onChoisir={(formule) => maj({ formule, offreCle: "" })}
                  titre={LIBELLES_FORMULE[f]}
                  detail={
                    f === "LOCATION_JOURNALIERE"
                      ? `${produit.tarifJournee ? fcfa(produit.tarifJournee) : "—"} par jour, d’un jour à un mois`
                      : f === "LOCATION_ACCESSION"
                        ? "Vous louez, puis vous devenez propriétaire au terme"
                        : "60 % à la signature, puis 4 versements de 10 %"
                  }
                />
              ))}
            </GroupeChoix>

            {/* Location journalière : les dates */}
            {b.formule === "LOCATION_JOURNALIERE" ? (
              <div className="lme-pile lme-pile--serree">
                <div className="lme-grille-champs">
                  <Champ libelle="Du" requis>
                    <input
                      id="dateDebut"
                      type="date"
                      min={aujourdhui}
                      value={b.dateDebut}
                      onChange={(e) => maj({ dateDebut: e.target.value })}
                    />
                  </Champ>
                  <Champ libelle="Au" requis>
                    <input
                      id="dateFin"
                      type="date"
                      min={b.dateDebut || aujourdhui}
                      value={b.dateFin}
                      onChange={(e) => maj({ dateFin: e.target.value })}
                    />
                  </Champ>
                </div>
                <p className="lme-aide">
                  La redevance n’est due que 6 jours sur 7 : le septième jour de chaque semaine n’est pas facturé.
                </p>
              </div>
            ) : null}

            {/* Location-accession : le choix de l'offre */}
            {b.formule === "LOCATION_ACCESSION" ? (
              <GroupeChoix legende="Formule d’accession" requis>
                {produit.offresAccession.map((o) => (
                  <Choix
                    key={o.cle}
                    nom="offre"
                    valeur={o.cle}
                    coche={o.cle === b.offreCle}
                    onChoisir={(offreCle) => maj({ offreCle })}
                    titre={o.libelle}
                    detail={`${fcfa(o.redevanceJournaliere)} par jour, 6 jours sur 7 — ${nombre(o.joursFactures)} jours facturés`}
                  >
                    {/* Pas le total des 24 mois (2026-11-13, décision
                        d'Alexandre) : la redevance journalière est ce que le
                        client paie et ce sur quoi il compare. Le cumul reste
                        dans l'acte, qui est le document qui l'engage. */}
                    {o.avecEngagement ? (
                      <span className="lme-message lme-message--attention" style={{ marginTop: 8 }}>
                        <TriangleAlert size={14} aria-hidden />
                        Durée ferme de {o.dureeMois} mois. En cas d’arrêt anticipé de votre fait, un complément de{" "}
                        {fcfa(o.differentielSiRupture)} par jour loué reste dû.
                      </span>
                    ) : null}
                  </Choix>
                ))}
              </GroupeChoix>
            ) : null}

            <Montant devis={devis} calculEnCours={calculEnCours} formule={b.formule} />
          </div>

          <BarreActions
            onPrecedent={() => allerA(1)}
            suivantActif={!!devis}
            enAttente={calculEnCours}
            raisonBlocage={
              !b.formule
                ? "Choisissez une formule."
                : b.formule === "LOCATION_JOURNALIERE" && (!b.dateDebut || !b.dateFin)
                  ? "Indiquez les dates de début et de fin."
                  : b.formule === "LOCATION_ACCESSION" && !b.offreCle
                    ? "Choisissez l’une des formules d’accession ci-dessus."
                    : calculEnCours
                      ? "Calcul du montant en cours…"
                      : null
            }
            onSuivant={() => allerA(3)}
          />
        </Carte>
      ) : null}

      {/* ── Étape 3 : la boutique et le récapitulatif ─────────────────── */}
      {b.etape === 3 && produit ? (
        <Carte titre="Dans quelle boutique retirerez-vous le scooter ?">
          <div className="lme-pile">
            <GroupeChoix legende={<span className="lme-sr">Boutique de retrait</span>}>
              {boutiques.map((bt) => (
                <Choix
                  key={bt.id}
                  nom="boutique"
                  valeur={bt.id}
                  coche={bt.id === b.boutiqueId}
                  onChoisir={(boutiqueId) => maj({ boutiqueId })}
                  titre={bt.nom}
                  detail={bt.adresse}
                />
              ))}
            </GroupeChoix>

            {devis ? (
              <div className="lme-encart lme-pile lme-pile--serree">
                <Recapitulatif>
                  <LigneRecap libelle="Modèle" valeur={produit.nom} />
                  <LigneRecap libelle="Formule" valeur={b.formule ? LIBELLES_FORMULE[b.formule] : "—"} />
                  {devis.nbJours ? <LigneRecap libelle="Jours facturés" valeur={`${nombre(devis.nbJours)} (6 j/7)`} /> : null}
                  {devis.engagementMois ? (
                    <LigneRecap libelle="Engagement" valeur={`${devis.engagementMois} mois fermes`} />
                  ) : null}
                  {/* En accession, la redevance remplace le total : c'est elle
                      que le client paie, jour après jour. Même décision que
                      dans `Montant`, pour que les deux écrans concordent. */}
                  {b.formule === "LOCATION_ACCESSION" && devis.redevanceJournaliere ? (
                    <LigneRecap libelle="Redevance" valeur={`${fcfa(devis.redevanceJournaliere)} / jour`} />
                  ) : null}
                </Recapitulatif>

                {b.formule === "LOCATION_ACCESSION" ? null : (
                  <>
                    <hr className="lme-separateur" style={{ margin: "6px 0" }} />

                    <div className="lme-rangee lme-rangee--entre">
                      <span className="lme-gras">Total</span>
                      <span className="lme-montant">{fcfa(devis.montantTotal)}</span>
                    </div>
                  </>
                )}

                {devis.echeances.length > 1 ? (
                  <div>
                    <p className="lme-sous-titre">Échéancier</p>
                    <Recapitulatif>
                      {devis.echeances.map((e) => (
                        <LigneRecap key={e.numero} libelle={e.libelle} valeur={fcfa(e.montant)} />
                      ))}
                    </Recapitulatif>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Alerte ton="info" titre="Retrait sur présentation de l’original de votre pièce">
              Sans cette vérification en boutique, le scooter ne peut pas vous être remis.
            </Alerte>

            {erreur ? (
              <Alerte ton="erreur" vivante>
                {erreur}
              </Alerte>
            ) : null}
          </div>

          <BarreActions
            onPrecedent={() => allerA(2)}
            suivantLibelle="Confirmer ma réservation"
            chargement={envoi}
            suivantActif={!!b.boutiqueId && !!devis}
            enAttente={!!b.boutiqueId && !devis}
            raisonBlocage={
              !b.boutiqueId
                ? "Choisissez la boutique où vous viendrez retirer le scooter."
                : !devis
                  ? "Calcul du montant en cours…"
                  : null
            }
            onSuivant={valider}
          />
        </Carte>
      ) : null}

      {erreur && b.etape !== 3 ? (
        <div style={{ marginTop: 16 }}>
          <Alerte ton="erreur" vivante>
            {erreur}
          </Alerte>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

/**
 * Le montant calculé, sous le choix de la formule.
 *
 * EN LOCATION-ACCESSION, LE CUMUL DES 24 MOIS N'EST PAS AFFICHÉ (2026-11-13,
 * décision d'Alexandre) : on annonce la REDEVANCE JOURNALIÈRE, qui est ce que
 * le client paie et ce sur quoi il compare une offre à une autre. Le cumul
 * reste dans l'acte, qu'il lit et signe. La journalière et la vente gardent
 * leur total : pour l'une il est modeste et attendu, pour l'autre c'est le
 * prix du scooter.
 */
function Montant({
  devis,
  calculEnCours,
  formule,
}: {
  devis: Devis | null;
  calculEnCours: boolean;
  formule: Formule | "";
}) {
  if (!devis && !calculEnCours) return null;
  const accession = formule === "LOCATION_ACCESSION";

  return (
    <div className="lme-encart" aria-live="polite">
      {calculEnCours || !devis ? (
        <p className="lme-aide">
          <LoaderCircle size={16} className="lme-rotation" aria-hidden />
          Calcul du montant…
        </p>
      ) : (
        <div className="lme-pile lme-pile--serree">
          <div className="lme-rangee lme-rangee--entre">
            <span className="lme-gras">{accession ? "Redevance" : "Total"}</span>
            <span className="lme-montant">
              {accession
                ? devis.redevanceJournaliere
                  ? `${fcfa(devis.redevanceJournaliere)} / jour`
                  : "—"
                : fcfa(devis.montantTotal)}
            </span>
          </div>
          {devis.nbJours ? (
            <p className="lme-aide">
              {nombre(devis.nbJours)} jours facturés
              {accession
                ? ", 6 jours sur 7"
                : devis.redevanceJournaliere
                  ? ` à ${fcfa(devis.redevanceJournaliere)}`
                  : null}
            </p>
          ) : null}
          {devis.tarifProvisoire ? (
            <p className="lme-message lme-message--attention">
              <TriangleAlert size={14} aria-hidden />
              Tarif indicatif, à confirmer par la boutique lors de la validation de votre dossier.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Barre d'actions.
 *
 * Un bouton grisé sans explication laisse l'utilisateur bloqué sans savoir
 * quoi faire — c'est exactement l'échec silencieux que le projet s'interdit.
 * Quand une condition manque, `raisonBlocage` la nomme, juste au-dessus :
 * en ambre si c'est à l'utilisateur d'agir, en neutre si l'on attend le calcul.
 */
function BarreActions({
  onPrecedent,
  onSuivant,
  suivantActif,
  suivantLibelle = "Continuer",
  raisonBlocage,
  enAttente = false,
  chargement = false,
}: {
  onPrecedent?: () => void;
  onSuivant: () => void;
  suivantActif: boolean;
  suivantLibelle?: string;
  raisonBlocage?: string | null;
  enAttente?: boolean;
  chargement?: boolean;
}) {
  return (
    <>
      {!suivantActif && raisonBlocage ? (
        <p
          className={enAttente ? "lme-aide" : "lme-message lme-message--attention"}
          style={{ marginTop: 20 }}
          role="status"
        >
          {enAttente ? (
            <LoaderCircle size={16} className="lme-rotation" aria-hidden />
          ) : (
            <TriangleAlert size={16} aria-hidden />
          )}
          {raisonBlocage}
        </p>
      ) : null}
      <div className="lme-actions">
        {onPrecedent ? (
          <Bouton variante="fantome" icone={<ArrowLeft size={18} aria-hidden />} onClick={onPrecedent}>
            Retour
          </Bouton>
        ) : null}
        <Bouton className="lme-actions__principal" onClick={onSuivant} disabled={!suivantActif} chargement={chargement}>
          {suivantLibelle}
        </Bouton>
      </div>
    </>
  );
}
