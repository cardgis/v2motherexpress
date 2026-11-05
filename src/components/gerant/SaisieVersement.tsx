"use client";

/**
 * Saisie rapide d'un versement, depuis le tableau de bord du gérant.
 *
 * Le client passe payer sans rendez-vous : le gérant tape ce qu'il a sous la
 * main — une référence, un nom, un numéro — choisit le dossier, saisit le
 * montant. Trois gestes, pas de navigation.
 *
 * Le solde du dossier est affiché AVANT la saisie : c'est ce qui permet de
 * dire au client ce qu'il doit, et de repérer une erreur de montant sur place.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, HandCoins, LoaderCircle, Search } from "lucide-react";
import { fcfa, nombre } from "@/lib/formatters";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { LIBELLES_MODE_PAIEMENT, MODES_PAIEMENT } from "@/lib/modes-paiement";
import type { Formule, ModePaiement } from "@/generated/prisma";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";
import { GroupeChoix, Segment } from "@/components/ui/Choix";
import BoutonAttestation from "./BoutonAttestation";

interface SoldeAffiche {
  duTotal: number;
  duADate: number;
  encaisse: number;
  restant: number;
  retard: number;
  joursDeRetard: number | null;
  solde: boolean;
  suiviPartiel: boolean;
}

interface Dossier {
  id: string;
  reference: string;
  client: string;
  telephone: string | null;
  produit: string;
  boutique: string;
  formule: Formule;
  solde: SoldeAffiche;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export default function SaisieVersement() {
  const router = useRouter();

  const [requete, setRequete] = useState("");
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [recherche, setRecherche] = useState(false);
  const [choisi, setChoisi] = useState<Dossier | null>(null);

  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState<ModePaiement>("ESPECES");
  const [recuLe, setRecuLe] = useState(aujourdhui);
  const [reference, setReference] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  /** Dernier versement enregistré : son reçu se tire dans la foulée. */
  const [dernier, setDernier] = useState<{ id: string; recuRef: string | null } | null>(null);

  const champMontant = useRef<HTMLInputElement>(null);

  // La recherche part après une pause de frappe : sur une connexion lente, une
  // requête par caractère saturerait le réseau pour rien.
  //
  // L'effet ne fait QUE parler au réseau : la liste affichée est dérivée au
  // rendu (voir `resultats`). Vider l'état depuis un effet déclencherait un
  // rendu en cascade, et React le signale à juste titre.
  useEffect(() => {
    const texte = requete.trim();
    if (texte.length < 2 || choisi) return;

    const minuteur = setTimeout(async () => {
      setRecherche(true);
      try {
        const reponse = await fetch(`/api/gerant/versements?q=${encodeURIComponent(texte)}`);
        const donnees = await reponse.json().catch(() => null);
        setDossiers(reponse.ok ? (donnees?.dossiers ?? []) : []);
      } catch {
        setDossiers([]);
      } finally {
        setRecherche(false);
      }
    }, 300);

    return () => clearTimeout(minuteur);
  }, [requete, choisi]);

  /**
   * Résultats réellement affichés : une recherche trop courte, ou un dossier
   * déjà choisi, n'en montre aucun — sans qu'il faille remettre l'état à zéro.
   */
  const resultats = requete.trim().length >= 2 && !choisi ? dossiers : [];

  const choisir = useCallback((dossier: Dossier) => {
    setChoisi(dossier);
    setErreur(null);
    setConfirmation(null);
    // Le montant du retard est le plus souvent celui que le client vient payer.
    setMontant(dossier.solde.retard > 0 ? String(dossier.solde.retard) : "");
    setTimeout(() => champMontant.current?.focus(), 0);
  }, []);

  function recommencer() {
    setChoisi(null);
    setRequete("");
    setMontant("");
    setReference("");
    setRecuLe(aujourdhui());
    setErreur(null);
  }

  async function enregistrer() {
    if (!choisi) return;

    setEnCours(true);
    setErreur(null);

    try {
      const reponse = await fetch("/api/gerant/versements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: choisi.id,
          montant,
          mode,
          recuLe,
          reference: reference.trim() || undefined,
        }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Enregistrement impossible.");

      setConfirmation(
        `${fcfa(donnees.montant)} encaissés pour ${choisi.client} — reçu ${donnees.recuRef}.`,
      );
      setDernier({ id: donnees.id, recuRef: donnees.recuRef });
      recommencer();
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const montantValide = montant.replace(/[^0-9]/g, "") !== "";

  return (
    <Carte
      titre="Encaisser un versement"
      description="Cherchez le dossier par référence, nom ou téléphone, puis saisissez ce que le client vient de régler."
    >
      <div className="lme-pile">
        {confirmation ? (
          <Alerte
            ton="succes"
            titre="Versement enregistré"
            vivante
            actions={
              dernier ? <BoutonAttestation encaissementId={dernier.id} onErreur={setErreur} /> : null
            }
          >
            {confirmation}
          </Alerte>
        ) : null}

        {erreur ? (
          <Alerte ton="erreur" vivante>
            {erreur}
          </Alerte>
        ) : null}

        {!choisi ? (
          <>
            <Champ libelle="Rechercher un dossier" aide="Référence, nom du client ou numéro de téléphone.">
              <input
                id="recherche-versement"
                type="search"
                value={requete}
                onChange={(e) => setRequete(e.target.value)}
                placeholder="LME-2026-THS-0142, SARR, 77 123 45 67"
                autoComplete="off"
              />
            </Champ>

            {recherche ? (
              <p className="lme-aide" role="status">
                <LoaderCircle size={16} className="lme-rotation" aria-hidden /> Recherche…
              </p>
            ) : null}

            {!recherche && requete.trim().length >= 2 && resultats.length === 0 ? (
              <p className="lme-aide" role="status">
                <Search size={16} aria-hidden /> Aucun dossier ne correspond.
              </p>
            ) : null}

            {resultats.length > 0 ? (
              <ul className="lme-liste" aria-label="Dossiers trouvés">
                {resultats.map((d) => (
                  <li key={d.id}>
                    <button type="button" className="lme-resultat" onClick={() => choisir(d)}>
                      <span className="lme-ligne__principal">
                        <span className="lme-ligne__titre">{d.client}</span>
                        <span className="lme-ligne__meta">
                          <span className="lme-mono">{d.reference}</span> · {d.produit} · {LIBELLES_FORMULE[d.formule]}
                        </span>
                      </span>
                      <span className="lme-ligne__fin">
                        {d.solde.retard > 0 ? (
                          <span className="lme-gras" style={{ color: "var(--lme-attention)" }}>
                            {nombre(d.solde.retard)} F en retard
                          </span>
                        ) : d.solde.solde ? (
                          <span className="lme-gras" style={{ color: "var(--lme-succes)" }}>
                            Soldé
                          </span>
                        ) : (
                          <span className="lme-gras">à jour</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <>
            <div className="lme-encart lme-pile lme-pile--serree">
              <p className="lme-gras">
                {choisi.client} — <span className="lme-mono">{choisi.reference}</span>
              </p>
              <p className="lme-aide">
                {choisi.produit} · {LIBELLES_FORMULE[choisi.formule]} · {choisi.boutique}
              </p>
              <dl className="lme-grille-champs" style={{ marginTop: 6 }}>
                <div>
                  <dt className="lme-aide">Dû à ce jour</dt>
                  <dd className="lme-gras">{fcfa(choisi.solde.duADate)}</dd>
                </div>
                <div>
                  <dt className="lme-aide">Déjà encaissé</dt>
                  <dd className="lme-gras">{fcfa(choisi.solde.encaisse)}</dd>
                </div>
                <div>
                  <dt className="lme-aide">Retard</dt>
                  <dd className="lme-gras" style={{ color: choisi.solde.retard > 0 ? "var(--lme-attention)" : undefined }}>
                    {choisi.solde.retard > 0
                      ? `${fcfa(choisi.solde.retard)}${choisi.solde.joursDeRetard ? ` · ${choisi.solde.joursDeRetard} j` : ""}`
                      : "aucun"}
                  </dd>
                </div>
                <div>
                  <dt className="lme-aide">Reste au terme</dt>
                  <dd className="lme-gras">{fcfa(choisi.solde.restant)}</dd>
                </div>
              </dl>
              {choisi.solde.suiviPartiel ? (
                <p className="lme-aide">
                  Contrat signé avant la mise en service du suivi : seuls les versements postérieurs sont comptés.
                </p>
              ) : null}
            </div>

            <div className="lme-grille-champs">
              <Champ libelle="Montant reçu (FCFA)" requis>
                <input
                  id="montant-versement"
                  ref={champMontant}
                  type="text"
                  inputMode="numeric"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="25000"
                />
              </Champ>

              <Champ libelle="Reçu le" requis>
                <input
                  id="date-versement"
                  type="date"
                  value={recuLe}
                  max={aujourdhui()}
                  onChange={(e) => setRecuLe(e.target.value)}
                />
              </Champ>

              <Champ libelle="Référence de la transaction" facultatif aide="N° Wave, bordereau de virement…">
                <input
                  id="reference-versement"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={60}
                  placeholder="TX-4471902"
                />
              </Champ>
            </div>

            <GroupeChoix legende="Mode de paiement" disposition="segments">
              {MODES_PAIEMENT.map((m) => (
                <Segment key={m} nom="mode-versement" valeur={m} coche={mode === m} onChoisir={setMode}>
                  {LIBELLES_MODE_PAIEMENT[m]}
                </Segment>
              ))}
            </GroupeChoix>

            <div className="lme-rangee">
              <Bouton
                variante="succes"
                icone={<Check size={18} aria-hidden />}
                onClick={enregistrer}
                chargement={enCours}
                disabled={!montantValide}
              >
                Enregistrer le versement
              </Bouton>
              <Bouton variante="fantome" icone={<ArrowLeft size={18} aria-hidden />} onClick={recommencer} disabled={enCours}>
                Changer de dossier
              </Bouton>
            </div>

            <p className="lme-aide">
              <HandCoins size={16} aria-hidden /> Une erreur de saisie s’annule par l’administrateur, avec un motif :
              un versement ne s’efface pas.
            </p>
          </>
        )}
      </div>
    </Carte>
  );
}
