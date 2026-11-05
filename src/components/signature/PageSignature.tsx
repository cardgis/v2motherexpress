"use client";

/**
 * Signature du contrat par le client.
 *
 * Le parcours est volontairement séquentiel : lire, confirmer, signer. On ne
 * peut pas atteindre le tracé sans avoir ouvert le document — la piste
 * d'audit doit pouvoir établir que l'acte a été mis à disposition avant
 * d'être signé.
 *
 * Sur la formule avec engagement, la mention prévue par l'article 5 doit être
 * recopiée : c'est ce qui rend la clause du différentiel réellement opposable.
 * Le champ passe au vert dès que la mention est conforme ; il ne passe au rouge
 * que si l'on tente de continuer avec une mention incorrecte.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, PenLine, RefreshCw } from "lucide-react";
import ZoneSignature, { lireTrace } from "./ZoneSignature";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton, LienBouton } from "@/components/ui/Bouton";
import { Etapes } from "@/components/ui/Etapes";
import { LigneRecap, Recapitulatif } from "@/components/ui/Infos";

const SECONDES_AVANT_RENVOI = 45;

export interface ResumeContrat {
  clientNomComplet: string;
  vehicule: string;
  numeroSerie: string;
  redevanceJournaliere: string;
  dureeMois: number | null;
  prixTotal: string;
  formule: string;
  avecEngagement: boolean;
  differentielJournalier: string;
  bailleurRepresentant: string;
}

type Etape = "lire" | "confirmer" | "signer" | "termine";
const ORDRE: Etape[] = ["lire", "confirmer", "signer"];

export default function PageSignature({
  jeton,
  reference,
  resume,
  mentionExigee,
}: {
  jeton: string;
  reference: string;
  resume: ResumeContrat;
  mentionExigee: string | null;
}) {
  const [etape, setEtape] = useState<Etape>("lire");
  const [luJusquauBout, setLuJusquauBout] = useState(false);
  const [mention, setMention] = useState("");
  const [tentativeMention, setTentativeMention] = useState(false);
  const [code, setCode] = useState("");
  const [signatureFaite, setSignatureFaite] = useState(false);

  const [telephoneMasque, setTelephoneMasque] = useState("");
  const [codeDev, setCodeDev] = useState<string | null>(null);
  const [compteARebours, setCompteARebours] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const champMention = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (compteARebours <= 0) return;
    const t = setTimeout(() => setCompteARebours((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [compteARebours]);

  const mentionValide =
    !mentionExigee || mention.trim().replace(/\s+/g, " ").toLowerCase() === mentionExigee.toLowerCase();

  function allerA(cible: Etape) {
    setErreur(null);
    setEtape(cible);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function demanderCode() {
    if (!mentionValide) {
      setTentativeMention(true);
      champMention.current?.focus();
      return;
    }

    setEnCours(true);
    setErreur(null);

    try {
      const reponse = await fetch("/api/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, action: "demander-code" }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Envoi du code impossible.");

      setTelephoneMasque(donnees.destinataireMasque);
      setCodeDev(donnees.codeDeDeveloppement ?? null);
      setCompteARebours(SECONDES_AVANT_RENVOI);
      if (etape !== "signer") allerA("signer");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi du code impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function signer() {
    setEnCours(true);
    setErreur(null);

    try {
      const trace = lireTrace();
      if (!trace) throw new Error("Signez dans le cadre avant de valider.");

      const reponse = await fetch("/api/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, action: "signer", code, trace, mention }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Signature refusée.");

      allerA("termine");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Signature refusée.");
      setCode("");
    } finally {
      setEnCours(false);
    }
  }

  // ── Écran de confirmation finale ───────────────────────────────────────────
  if (etape === "termine") {
    return (
      <div className="lme-page lme-page--etroite">
        <EnTetePage surtitre={`Contrat ${reference}`} titre="Contrat signé" />
        <div className="lme-pile">
          <Alerte ton="succes" titre="Votre signature est enregistrée" vivante>
            Elle figure désormais sur le contrat <strong>{reference}</strong>. La boutique va le contresigner.
          </Alerte>
          <Carte titre="Pour retirer votre scooter">
            <p>
              Présentez-vous en boutique avec l’<strong>original</strong> de la pièce d’identité dont vous avez
              transmis la copie. Sans cette vérification, le véhicule ne peut pas vous être remis.
            </p>
            <p className="lme-aide" style={{ marginTop: 10 }}>
              Votre contrat signé sera disponible dans votre espace personnel.
            </p>
            <div style={{ marginTop: 16 }}>
              <LienBouton href="/compte" variante="secondaire">
                Aller à mon espace
              </LienBouton>
            </div>
          </Carte>
        </div>
      </div>
    );
  }

  const indexCourant = ORDRE.indexOf(etape);

  return (
    <div className="lme-page lme-page--etroite">
      <EnTetePage surtitre={`Contrat ${reference}`} titre="Signature de votre contrat" description={resume.clientNomComplet} />

      <Etapes
        libelles={["Lire", "Confirmer", "Signer"]}
        courante={indexCourant + 1}
        onAller={(n) => allerA(ORDRE[n - 1]!)}
        nom="Étapes de la signature"
      />

      {/* ── Étape 1 : lecture ─────────────────────────────────────────── */}
      {etape === "lire" ? (
        <Carte
          titre="Lisez votre contrat"
          description="Prenez le temps de le parcourir en entier. Vous pourrez le retrouver à tout moment dans votre espace."
        >
          <div className="lme-pile">
            <div className="lme-encart">
              <Recapitulatif>
                <LigneRecap libelle="Véhicule" valeur={resume.vehicule} />
                <LigneRecap libelle="Numéro de série" valeur={resume.numeroSerie} />
                {resume.dureeMois ? <LigneRecap libelle="Durée" valeur={`${resume.dureeMois} mois`} /> : null}
                {resume.redevanceJournaliere !== "Néant" ? (
                  <LigneRecap libelle="Redevance" valeur={`${resume.redevanceJournaliere} par jour, 6 j/7`} />
                ) : (
                  <LigneRecap libelle="Prix total" valeur={resume.prixTotal} />
                )}
                <LigneRecap libelle="Pour La Mother Express" valeur={resume.bailleurRepresentant} />
              </Recapitulatif>
            </div>

            <iframe src={`/api/signature/${jeton}/pdf`} title={`Contrat ${reference}`} className="lme-cadre-pdf" />

            <p className="lme-aide">
              Le document ne s’affiche pas ?{" "}
              <a href={`/api/signature/${jeton}/pdf`} target="_blank" rel="noopener noreferrer">
                Ouvrez-le dans un nouvel onglet <ExternalLink size={13} aria-hidden style={{ verticalAlign: "-2px" }} />
              </a>
            </p>

            <label className="lme-case">
              <input type="checkbox" checked={luJusquauBout} onChange={(e) => setLuJusquauBout(e.target.checked)} />
              <span>J’ai lu le contrat dans son intégralité et j’en accepte les termes.</span>
            </label>
          </div>

          <div className="lme-actions">
            <Bouton className="lme-actions__principal" onClick={() => allerA("confirmer")} disabled={!luJusquauBout}>
              Continuer
            </Bouton>
          </div>
        </Carte>
      ) : null}

      {/* ── Étape 2 : confirmation et mention ─────────────────────────── */}
      {etape === "confirmer" ? (
        <Carte titre="Confirmez votre engagement">
          <div className="lme-pile">
            {mentionExigee ? (
              <>
                <Alerte ton="attention" titre="Votre contrat comporte un engagement ferme">
                  Le tarif de {resume.redevanceJournaliere} par jour vous est consenti en contrepartie de votre
                  engagement sur {resume.dureeMois} mois. Si vous interrompez le contrat avant son terme,{" "}
                  <strong>{resume.differentielJournalier} par jour</strong> resteront dus sur la totalité des jours
                  déjà loués.
                </Alerte>

                <div className="lme-pile lme-pile--serree">
                  <p className="lme-libelle">Mention à recopier</p>
                  <p className="lme-mention-modele" id="mention-modele">
                    {mentionExigee}
                  </p>
                </div>

                <Champ
                  libelle="Votre mention"
                  requis
                  erreur={tentativeMention && !mentionValide ? "La mention ne correspond pas. Recopiez-la exactement." : null}
                  succes={mention.length > 0 && mentionValide ? "Mention conforme." : null}
                  aide="Les majuscules et les espaces en trop ne comptent pas."
                >
                  <textarea
                    id="mention"
                    ref={champMention}
                    rows={2}
                    value={mention}
                    onChange={(e) => setMention(e.target.value)}
                    placeholder="Recopiez la phrase ci-dessus"
                  />
                </Champ>
              </>
            ) : (
              <p className="lme-texte-2">
                Nous allons vous envoyer un code à 6 chiffres pour vérifier votre identité avant la signature.
              </p>
            )}

            {erreur ? (
              <Alerte ton="erreur" vivante>
                {erreur}
              </Alerte>
            ) : null}
          </div>

          <div className="lme-actions">
            <Bouton variante="fantome" icone={<ArrowLeft size={18} aria-hidden />} onClick={() => allerA("lire")}>
              Relire le contrat
            </Bouton>
            <Bouton className="lme-actions__principal" onClick={demanderCode} chargement={enCours}>
              Recevoir mon code
            </Bouton>
          </div>
        </Carte>
      ) : null}

      {/* ── Étape 3 : code et signature ───────────────────────────────── */}
      {etape === "signer" ? (
        <Carte titre="Vérifiez et signez" description={telephoneMasque ? `Code envoyé à ${telephoneMasque}.` : undefined}>
          <div className="lme-pile">
            {codeDev ? (
              <Alerte ton="attention" titre="Mode développement — aucun message envoyé">
                Code : <strong style={{ letterSpacing: 2 }}>{codeDev}</strong>
              </Alerte>
            ) : null}

            <div className="lme-pile lme-pile--serree">
              <Champ libelle="Code à 6 chiffres" requis>
                <input
                  id="code"
                  className="lme-saisie--code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </Champ>
              <div>
                <Bouton
                  variante="fantome"
                  taille="sm"
                  icone={<RefreshCw size={16} aria-hidden />}
                  onClick={demanderCode}
                  disabled={compteARebours > 0 || enCours}
                >
                  {compteARebours > 0 ? `Renvoyer le code (${compteARebours} s)` : "Renvoyer le code"}
                </Bouton>
              </div>
            </div>

            <div className="lme-pile lme-pile--serree">
              <p className="lme-libelle">
                Votre signature
                <span className="lme-requis" aria-hidden>
                  *
                </span>
              </p>
              <ZoneSignature onChangement={setSignatureFaite} desactive={enCours} />
            </div>

            {erreur ? (
              <Alerte ton="erreur" vivante>
                {erreur}
              </Alerte>
            ) : null}

            {code.length !== 6 || !signatureFaite ? (
              <p className="lme-aide" role="status">
                {code.length !== 6 && !signatureFaite
                  ? "Saisissez le code reçu et tracez votre signature."
                  : code.length !== 6
                    ? "Saisissez le code à 6 chiffres reçu."
                    : "Tracez votre signature dans le cadre."}
              </p>
            ) : null}

            <Bouton
              variante="succes"
              taille="lg"
              bloc
              icone={<PenLine size={18} aria-hidden />}
              chargement={enCours}
              disabled={code.length !== 6 || !signatureFaite}
              onClick={signer}
            >
              Signer mon contrat
            </Bouton>

            <p className="lme-aide">
              En signant, vous acceptez que la date, l’heure, votre adresse de connexion et la vérification de votre
              identité soient enregistrées comme preuve de signature.
            </p>
          </div>
        </Carte>
      ) : null}
    </div>
  );
}
