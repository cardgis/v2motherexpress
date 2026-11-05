"use client";

/**
 * Dossier client : état civil, pièce d'identité, coordonnées, justificatifs.
 *
 * Le formulaire est découpé en quatre étapes courtes, chacune enregistrée
 * dès qu'elle est franchie. Sur une connexion 3G qui coupe, le client reprend
 * là où il s'était arrêté — la saisie n'est jamais perdue.
 *
 * Code couleur des champs :
 *   — rouge : champ obligatoire laissé vide au moment de continuer, ou valeur
 *     refusée par le serveur (le message du serveur s'affiche sous CE champ,
 *     et l'on revient à l'étape qui le contient) ;
 *   — gris : identité figée, vérifiée ou en cours de vérification.
 *
 * Les photos sont compressées DANS LE NAVIGATEUR avant l'envoi : une photo de
 * carte d'identité prise au téléphone pèse 4 à 8 Mo, ce qui est inenvoyable
 * sur un réseau mobile sénégalais. Après compression, elle tient sous 1 Mo.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif,
 * aucune manipulation directe du DOM.
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, FileText, Lock, Trash2, Upload } from "lucide-react";
import { LIBELLES_DOCUMENT, LIBELLES_PIECE, type EtatDossier, CHAMPS_COORDONNEES } from "@/lib/dossier";
import type { TypeDocument } from "@/generated/prisma";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton, LienBouton } from "@/components/ui/Bouton";
import { Etapes } from "@/components/ui/Etapes";
import { Progression } from "@/components/ui/Progression";
import { StatutBadge } from "@/components/ui/Badge";

export interface DossierInitial {
  prenom: string;
  nom: string;
  dateNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  typePiece: string;
  numeroPiece: string;
  pieceDateExpiration: string;
  numeroPermis: string;
  permisDateObtention: string;
  adresse: string;
  quartier: string;
  ville: string;
  profession: string;
  /** Demandé seulement aux clients connectés par e-mail. */
  telephoneContact: string;
}

type Cle = keyof DossierInitial;

interface DocumentAffiche {
  id: string;
  type: TypeDocument;
  mimeType: string;
  uploadedAt: string;
}

/** Pièces demandées, dans l'ordre où on les réclame au client. */
const PIECES_A_FOURNIR: { type: TypeDocument; obligatoire: boolean }[] = [
  { type: "PIECE_RECTO", obligatoire: true },
  { type: "PIECE_VERSO", obligatoire: true },
  { type: "JUSTIFICATIF_DOMICILE", obligatoire: true },
  { type: "PERMIS_RECTO", obligatoire: false },
];

const ETAPES = ["Identité", "Pièce", "Coordonnées", "Justificatifs"];

/** Champs de chaque étape — pour revenir à celle d'un champ refusé. */
const CHAMPS_PAR_ETAPE: Record<number, Cle[]> = {
  1: ["prenom", "nom", "dateNaissance", "lieuNaissance", "nationalite"],
  2: ["typePiece", "numeroPiece", "pieceDateExpiration", "numeroPermis", "permisDateObtention"],
  3: ["adresse", "quartier", "ville", "profession", "telephoneContact"],
};

function champsRequis(etape: number, telephoneContactRequis: boolean): Cle[] {
  switch (etape) {
    case 1:
      return ["prenom", "nom", "dateNaissance", "lieuNaissance"];
    case 2:
      return ["typePiece", "numeroPiece"];
    case 3:
      return [
        "adresse",
        "ville",
        ...(telephoneContactRequis ? (["telephoneContact"] as const) : []),
      ];
    default:
      return [];
  }
}

const estCoordonnee = (cle: string) => (CHAMPS_COORDONNEES as readonly string[]).includes(cle);

export default function DossierForm({
  initial,
  documents: documentsInitiaux,
  etatInitial,
  statutKyc,
  motifRejet,
  consentementDonne,
  telephoneContactRequis,
}: {
  initial: DossierInitial;
  documents: DocumentAffiche[];
  etatInitial: EtatDossier;
  statutKyc: string;
  motifRejet: string | null;
  consentementDonne: boolean;
  /** Vrai pour un client connecté par e-mail : le contrat imprime un téléphone. */
  telephoneContactRequis: boolean;
}) {
  const router = useRouter();

  const [etape, setEtape] = useState(1);
  const [f, setF] = useState<DossierInitial>(initial);
  const [documents, setDocuments] = useState<DocumentAffiche[]>(documentsInitiaux);
  const [etat, setEtat] = useState<EtatDossier>(etatInitial);
  const [consentement, setConsentement] = useState(consentementDonne);

  const [enregistrement, setEnregistrement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreursChamps, setErreursChamps] = useState<Partial<Record<Cle, string>>>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);

  /**
   * L'identité est figée dès que le gérant l'a sous les yeux : ce sont les
   * champs qu'il confronte à la pièce. Les coordonnées, elles, restent
   * modifiables — déménager ne doit pas obliger à appeler la boutique, et
   * cela ne touche aucun contrat signé, dont les données sont figées.
   */
  const identiteVerrouillee = statutKyc === "VALIDE" || statutKyc === "A_VERIFIER";

  const maj = useCallback((champs: Partial<DossierInitial>) => {
    setF((prec) => ({ ...prec, ...champs }));
    setErreur(null);
    setConfirmation(null);
    // Corriger un champ efface son message d'erreur, sans attendre l'envoi.
    setErreursChamps((prec) => {
      const suite = { ...prec };
      for (const cle of Object.keys(champs) as Cle[]) delete suite[cle];
      return suite;
    });
  }, []);

  function signalerChamps(erreurs: Partial<Record<Cle, string>>) {
    setErreursChamps(erreurs);
    const premier = Object.keys(erreurs)[0];
    if (premier) setTimeout(() => document.getElementById(`dossier-${premier}`)?.focus(), 0);
  }

  /** Enregistre la saisie ; renvoie `false` si le serveur refuse. */
  async function enregistrer(): Promise<boolean> {
    setEnregistrement(true);
    setErreur(null);

    // Les champs vides ne sont pas envoyés : le schéma partiel valide ce qui
    // arrive, il ne doit pas buter sur une chaîne vide encore non saisie.
    //
    // Quand l'identité est figée, on n'envoie QUE les coordonnées : le serveur
    // rejetterait tout envoi contenant un champ d'identité, même inchangé.
    const corps = Object.fromEntries(
      Object.entries(f).filter(([cle, v]) => v !== "" && v !== null && (!identiteVerrouillee || estCoordonnee(cle))),
    );

    try {
      const reponse = await fetch("/api/dossier", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const donnees = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        const message: string = donnees?.error ?? "Enregistrement impossible.";
        const champ = donnees?.champ as Cle | null | undefined;

        if (champ && champ in f) {
          // Le champ refusé peut se trouver dans une autre étape : on y revient.
          const etapeDuChamp = Number(
            Object.entries(CHAMPS_PAR_ETAPE).find(([, cles]) => cles.includes(champ))?.[0] ?? etape,
          );
          setEtape(etapeDuChamp);
          signalerChamps({ [champ]: message });
        } else {
          setErreur(message);
        }
        return false;
      }

      setEtat(donnees.etat);
      return true;
    } catch {
      setErreur("Connexion perdue. Votre saisie est conservée : réessayez dans un instant.");
      return false;
    } finally {
      setEnregistrement(false);
    }
  }

  async function allerA(cible: number) {
    if (cible > etape) {
      // En avançant : les champs obligatoires de l'étape doivent être remplis.
      const manquants = champsRequis(etape, telephoneContactRequis).filter(
        (cle) => !f[cle].trim() && (!identiteVerrouillee || estCoordonnee(cle)),
      );
      if (manquants.length > 0) {
        setErreur(null);
        signalerChamps(Object.fromEntries(manquants.map((cle) => [cle, "Ce champ est obligatoire."])));
        return;
      }
      if (!(await enregistrer())) return;

      if (identiteVerrouillee && etape === 3) setConfirmation("Vos coordonnées sont enregistrées.");
    } else {
      // En reculant, on enregistre sans bloquer : rester coincé sur une étape
      // parce qu'un champ plus loin est incomplet serait absurde.
      await enregistrer();
    }

    setEtape(cible);
    document.getElementById("dossier-etapes")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function soumettre() {
    setEnvoi(true);
    setErreur(null);

    try {
      if (!(await enregistrer())) return;

      const reponse = await fetch("/api/dossier/soumettre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentement }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) {
        if (donnees?.etat) setEtat(donnees.etat);
        throw new Error(donnees?.error ?? "Soumission impossible.");
      }

      router.replace("/compte");
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Soumission impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  const erreurDe = (cle: Cle) => erreursChamps[cle] ?? null;

  const bandeauVerrou = identiteVerrouillee ? (
    <Alerte
      ton="neutre"
      icone={<Lock size={20} aria-hidden />}
      titre={statutKyc === "VALIDE" ? "Identité vérifiée" : "Identité en cours de vérification"}
    >
      Ces informations ne sont plus modifiables ici. Pour toute correction, contactez votre boutique.
    </Alerte>
  ) : null;

  return (
    <div className="lme-page lme-page--etroite">
      <EnTetePage
        fil={[{ libelle: "Mon espace", href: "/compte" }]}
        surtitre="Mon dossier"
        titre="Vos informations"
        description="Elles servent à établir votre contrat. Vous n’aurez pas à les ressaisir lors de vos prochaines locations."
        badge={<StatutBadge type="kyc" statut={statutKyc} lecteur="client" />}
      />

      <div className="lme-pile">
        <Progression valeur={etat.progression} libelle="Avancement du dossier" />

        {statutKyc === "A_VERIFIER" ? (
          <Alerte ton="info" titre="Dossier en cours de vérification">
            La boutique examine vos pièces. Vous serez prévenu dès qu’il sera validé. Vos coordonnées
            restent modifiables.
          </Alerte>
        ) : null}

        {statutKyc === "VALIDE" ? (
          <Alerte ton="succes" titre="Dossier validé">
            Votre identité et vos pièces ont été vérifiées. Vous pouvez mettre à jour vos coordonnées à tout moment.
          </Alerte>
        ) : null}

        {statutKyc === "REJETE" && motifRejet ? (
          <Alerte ton="erreur" titre="Dossier à corriger">
            {motifRejet}
          </Alerte>
        ) : null}

        <div id="dossier-etapes">
          <Etapes libelles={ETAPES} courante={etape} onAller={allerA} nom="Étapes du dossier" />
        </div>

        <Carte>
          {/* ── Étape 1 : état civil ─────────────────────────────────────── */}
          {etape === 1 ? (
            <div className="lme-pile">
              <div>
                <h2 className="lme-carte__titre">Qui êtes-vous ?</h2>
                <p className="lme-legende-requis" style={{ marginTop: 4 }}>
                  Les champs marqués <span className="lme-requis">*</span> sont obligatoires.
                </p>
              </div>
              {bandeauVerrou}
              <div className="lme-grille-champs">
                <Champ libelle="Prénom" requis erreur={erreurDe("prenom")}>
                  <input
                    id="dossier-prenom"
                    value={f.prenom}
                    onChange={(e) => maj({ prenom: e.target.value })}
                    disabled={identiteVerrouillee}
                    autoComplete="given-name"
                  />
                </Champ>
                <Champ libelle="Nom" requis erreur={erreurDe("nom")}>
                  <input
                    id="dossier-nom"
                    value={f.nom}
                    onChange={(e) => maj({ nom: e.target.value })}
                    disabled={identiteVerrouillee}
                    autoComplete="family-name"
                  />
                </Champ>
                <Champ libelle="Date de naissance" requis erreur={erreurDe("dateNaissance")}>
                  <input
                    id="dossier-dateNaissance"
                    type="date"
                    value={f.dateNaissance}
                    onChange={(e) => maj({ dateNaissance: e.target.value })}
                    disabled={identiteVerrouillee}
                    autoComplete="bday"
                  />
                </Champ>
                <Champ libelle="Lieu de naissance" requis erreur={erreurDe("lieuNaissance")}>
                  <input
                    id="dossier-lieuNaissance"
                    value={f.lieuNaissance}
                    onChange={(e) => maj({ lieuNaissance: e.target.value })}
                    disabled={identiteVerrouillee}
                  />
                </Champ>
                <Champ libelle="Nationalité" erreur={erreurDe("nationalite")}>
                  <input
                    id="dossier-nationalite"
                    value={f.nationalite}
                    onChange={(e) => maj({ nationalite: e.target.value })}
                    disabled={identiteVerrouillee}
                  />
                </Champ>
              </div>
            </div>
          ) : null}

          {/* ── Étape 2 : la pièce d'identité ────────────────────────────── */}
          {etape === 2 ? (
            <div className="lme-pile">
              <div>
                <h2 className="lme-carte__titre">Votre pièce d’identité</h2>
                <p className="lme-carte__description">
                  Vous présenterez l’<strong>original</strong> de cette pièce au retrait du scooter.
                </p>
              </div>
              {bandeauVerrou}
              <div className="lme-grille-champs">
                <Champ libelle="Type de pièce" requis erreur={erreurDe("typePiece")}>
                  <select
                    id="dossier-typePiece"
                    value={f.typePiece}
                    onChange={(e) => maj({ typePiece: e.target.value })}
                    disabled={identiteVerrouillee}
                  >
                    <option value="">Choisir…</option>
                    {Object.entries(LIBELLES_PIECE).map(([cle, libelle]) => (
                      <option key={cle} value={cle}>
                        {libelle}
                      </option>
                    ))}
                  </select>
                </Champ>
                <Champ
                  libelle="Numéro de la pièce"
                  requis
                  erreur={erreurDe("numeroPiece")}
                  aide="Recopiez-le exactement tel qu’il figure sur la pièce."
                >
                  <input
                    id="dossier-numeroPiece"
                    value={f.numeroPiece}
                    onChange={(e) => maj({ numeroPiece: e.target.value })}
                    disabled={identiteVerrouillee}
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </Champ>
                <Champ libelle="Date d’expiration" facultatif erreur={erreurDe("pieceDateExpiration")}>
                  <input
                    id="dossier-pieceDateExpiration"
                    type="date"
                    value={f.pieceDateExpiration}
                    onChange={(e) => maj({ pieceDateExpiration: e.target.value })}
                    disabled={identiteVerrouillee}
                  />
                </Champ>
                <Champ libelle="Numéro de permis" facultatif erreur={erreurDe("numeroPermis")}>
                  <input
                    id="dossier-numeroPermis"
                    value={f.numeroPermis}
                    onChange={(e) => maj({ numeroPermis: e.target.value })}
                    disabled={identiteVerrouillee}
                    spellCheck={false}
                  />
                </Champ>
              </div>
            </div>
          ) : null}

          {/* ── Étape 3 : coordonnées ───────────────── */}
          {etape === 3 ? (
            <div className="lme-pile">
              <div>
                <h2 className="lme-carte__titre">Où vous joindre ?</h2>
                <p className="lme-carte__description">Ces informations restent modifiables à tout moment.</p>
              </div>
              <div className="lme-grille-champs">
                <Champ libelle="Adresse" requis large erreur={erreurDe("adresse")}>
                  <input
                    id="dossier-adresse"
                    value={f.adresse}
                    onChange={(e) => maj({ adresse: e.target.value })}
                    autoComplete="street-address"
                  />
                </Champ>
                <Champ libelle="Quartier" facultatif erreur={erreurDe("quartier")}>
                  <input id="dossier-quartier" value={f.quartier} onChange={(e) => maj({ quartier: e.target.value })} />
                </Champ>
                <Champ libelle="Ville" requis erreur={erreurDe("ville")}>
                  <input
                    id="dossier-ville"
                    value={f.ville}
                    onChange={(e) => maj({ ville: e.target.value })}
                    autoComplete="address-level2"
                  />
                </Champ>
                <Champ libelle="Profession" facultatif erreur={erreurDe("profession")}>
                  <input
                    id="dossier-profession"
                    value={f.profession}
                    onChange={(e) => maj({ profession: e.target.value })}
                    autoComplete="organization-title"
                  />
                </Champ>
                {telephoneContactRequis ? (
                  <Champ
                    libelle="Votre téléphone"
                    requis
                    erreur={erreurDe("telephoneContact")}
                    aide="Vous êtes connecté par e-mail : ce numéro, sénégalais ou étranger, figurera sur votre contrat."
                  >
                    <input
                      id="dossier-telephoneContact"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={24}
                      placeholder="+33 6 12 34 56 78"
                      value={f.telephoneContact}
                      onChange={(e) => maj({ telephoneContact: e.target.value })}
                    />
                  </Champ>
                ) : null}
              </div>

            </div>
          ) : null}

          {/* ── Étape 4 : les justificatifs ──────────────────────────────── */}
          {etape === 4 ? (
            <div className="lme-pile">
              <div>
                <h2 className="lme-carte__titre">Vos justificatifs</h2>
                <p className="lme-carte__description">
                  Photographiez vos documents bien à plat, sans reflet. Les photos sont allégées automatiquement avant
                  l’envoi.
                </p>
              </div>

              <div className="lme-pile lme-pile--serree">
                {PIECES_A_FOURNIR.map((p) => (
                  <ZoneDepot
                    key={p.type}
                    type={p.type}
                    obligatoire={p.obligatoire}
                    document={documents.find((d) => d.type === p.type) ?? null}
                    verrouille={identiteVerrouillee}
                    onDepose={(doc, nouvelEtat) => {
                      setDocuments((prec) => [...prec.filter((d) => d.type !== doc.type), doc]);
                      setEtat(nouvelEtat);
                    }}
                    onSupprime={(id) => setDocuments((prec) => prec.filter((d) => d.id !== id))}
                    onErreur={setErreur}
                  />
                ))}
              </div>

              {!identiteVerrouillee ? (
                <label className="lme-case">
                  <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} />
                  <span>
                    J’autorise La Mother Express à conserver mes pièces d’identité pour la durée de mon contrat, aux
                    seules fins de sa gestion. Elles seront supprimées à la clôture de mon dossier.
                  </span>
                </label>
              ) : null}

              {!etat.complet && !identiteVerrouillee ? (
                <Alerte ton="attention" titre="Il reste à fournir">
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {etat.champsManquants.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                    {etat.documentsManquants.map((d) => (
                      <li key={d}>{LIBELLES_DOCUMENT[d]}</li>
                    ))}
                  </ul>
                </Alerte>
              ) : null}
            </div>
          ) : null}

          {erreur ? (
            <div style={{ marginTop: 18 }}>
              <Alerte ton="erreur" vivante>
                {erreur}
              </Alerte>
            </div>
          ) : null}

          {confirmation ? (
            <div style={{ marginTop: 18 }}>
              <Alerte ton="succes" vivante>
                {confirmation}
              </Alerte>
            </div>
          ) : null}

          {/* ── Navigation ─────────────────────────────────────────────── */}
          <div className="lme-actions">
            {etape > 1 ? (
              <Bouton variante="fantome" icone={<ArrowLeft size={18} aria-hidden />} onClick={() => allerA(etape - 1)}>
                Retour
              </Bouton>
            ) : null}

            {etape < ETAPES.length ? (
              <Bouton className="lme-actions__principal" chargement={enregistrement} onClick={() => allerA(etape + 1)}>
                {identiteVerrouillee && etape === 3 ? "Enregistrer mes coordonnées" : "Continuer"}
              </Bouton>
            ) : !identiteVerrouillee ? (
              <div className="lme-actions__principal lme-pile lme-pile--serree" style={{ justifyItems: "end" }}>
                {!consentement ? (
                  <p className="lme-message lme-message--attention">Cochez l’autorisation ci-dessus pour envoyer votre dossier.</p>
                ) : null}
                <Bouton taille="lg" chargement={envoi} disabled={!consentement} onClick={soumettre}>
                  Envoyer mon dossier
                </Bouton>
              </div>
            ) : (
              <LienBouton href="/compte" variante="secondaire" className="lme-actions__principal">
                Retour à mon espace
              </LienBouton>
            )}
          </div>
        </Carte>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dépôt d'une pièce, avec compression avant envoi
// ---------------------------------------------------------------------------

function ZoneDepot({
  type,
  obligatoire,
  document,
  verrouille,
  onDepose,
  onSupprime,
  onErreur,
}: {
  type: TypeDocument;
  obligatoire: boolean;
  document: DocumentAffiche | null;
  verrouille: boolean;
  onDepose: (doc: DocumentAffiche, etat: EtatDossier) => void;
  onSupprime: (id: string) => void;
  onErreur: (message: string | null) => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);
  const libelle = LIBELLES_DOCUMENT[type];

  async function envoyer(fichier: File) {
    setEnvoi(true);
    onErreur(null);

    try {
      let aEnvoyer: File = fichier;

      // Une photo de CNI prise au téléphone pèse 4 à 8 Mo : inenvoyable en 3G.
      // La bibliothèque est chargée à la demande pour ne pas alourdir la page.
      if (fichier.type.startsWith("image/")) {
        const { default: compresser } = await import("browser-image-compression");
        aEnvoyer = await compresser(fichier, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1800, // suffisant pour lire un numéro de pièce
          useWebWorker: true,
          fileType: "image/jpeg",
        });
      }

      const corps = new FormData();
      corps.append("type", type);
      corps.append("fichier", aEnvoyer, fichier.name);

      const reponse = await fetch("/api/documents", { method: "POST", body: corps });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Envoi impossible.");

      onDepose(donnees.document, donnees.etat);
    } catch (err) {
      onErreur(err instanceof Error ? `${libelle} : ${err.message}` : "Envoi impossible.");
    } finally {
      setEnvoi(false);
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  async function supprimer() {
    if (!document) return;
    setSuppression(true);
    onErreur(null);
    const reponse = await fetch(`/api/documents/${document.id}`, { method: "DELETE" }).catch(() => null);
    setSuppression(false);
    if (reponse?.ok) onSupprime(document.id);
    else onErreur(`${libelle} : suppression impossible.`);
  }

  const etat = document ? "fourni" : obligatoire ? "manquant" : undefined;

  return (
    <div className="lme-depot" data-etat={etat}>
      <span className="lme-depot__icone" aria-hidden>
        {document ? <Check size={20} /> : <FileText size={20} />}
      </span>

      <div className="lme-depot__texte">
        <p className="lme-gras">
          {libelle}
          {!obligatoire ? <span className="lme-facultatif"> — facultatif</span> : null}
        </p>
        <p
          className={
            envoi
              ? "lme-aide"
              : document
                ? "lme-message lme-message--succes"
                : obligatoire
                  ? "lme-message lme-message--attention"
                  : "lme-aide"
          }
        >
          {envoi ? "Envoi en cours…" : document ? "Document reçu" : obligatoire ? "À fournir" : "Non fourni"}
        </p>
      </div>

      <div className="lme-rangee">
        {document ? (
          <LienBouton
            href={`/api/documents/${document.id}`}
            nouvelOnglet
            variante="secondaire"
            taille="sm"
            icone={<Eye size={16} aria-hidden />}
          >
            Voir
          </LienBouton>
        ) : null}

        {document && !verrouille ? (
          <Bouton
            variante="danger-discret"
            taille="sm"
            icone={<Trash2 size={16} aria-hidden />}
            chargement={suppression}
            onClick={supprimer}
            aria-label={`Retirer : ${libelle}`}
          >
            Retirer
          </Bouton>
        ) : null}

        {!document && !verrouille ? (
          <>
            <input
              ref={champFichier}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={(e) => {
                const fichier = e.target.files?.[0];
                if (fichier) envoyer(fichier);
              }}
              style={{ display: "none" }}
              aria-hidden
              tabIndex={-1}
            />
            <Bouton
              variante={obligatoire ? "primaire" : "secondaire"}
              taille="sm"
              icone={<Upload size={16} aria-hidden />}
              chargement={envoi}
              onClick={() => champFichier.current?.click()}
              aria-label={`Ajouter : ${libelle}`}
            >
              Ajouter
            </Bouton>
          </>
        ) : null}
      </div>
    </div>
  );
}
