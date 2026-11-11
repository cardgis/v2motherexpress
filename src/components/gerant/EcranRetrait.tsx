"use client";

/**
 * Écran de retrait en boutique — pensé pour le téléphone du gérant.
 *
 * Le gérant a le client en face de lui, la moto à côté, souvent dehors. D'où :
 *   — la copie de la pièce affichée EN GRAND, juste au-dessus du numéro
 *     déclaré, pour confronter l'original d'un seul regard ;
 *   — des cibles tactiles larges, aucune saisie superflue ;
 *   — la prise de photo directement par l'appareil (`capture="environment"`),
 *     avec compression avant envoi, la 3G ne passant pas 5 Mo ;
 *   — un déroulé strictement séquentiel : la pièce d'abord, le reste ensuite ;
 *   — un code couleur lisible en plein soleil : ambre pour ce qui manque,
 *     vert pour ce qui est fait, rouge pour la seule décision irréversible.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import type { AngleHandover, RoleSignataire } from "@/generated/prisma";
import { dateFr } from "@/lib/formatters";
import { FIL_RACINE, type BaseBackOffice } from "./espace-backoffice";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton, LienBouton } from "@/components/ui/Bouton";
import { Etapes } from "@/components/ui/Etapes";
import { GroupeChoix, Segment } from "@/components/ui/Choix";
import { Info, Infos } from "@/components/ui/Infos";

const ANGLES: { cle: AngleHandover; libelle: string; obligatoire: boolean }[] = [
  { cle: "AVANT", libelle: "Avant", obligatoire: true },
  { cle: "ARRIERE", libelle: "Arrière", obligatoire: true },
  { cle: "GAUCHE", libelle: "Côté gauche", obligatoire: true },
  { cle: "DROITE", libelle: "Côté droit", obligatoire: true },
  { cle: "COMPTEUR", libelle: "Compteur", obligatoire: false },
  { cle: "CHASSIS", libelle: "Numéro de châssis", obligatoire: false },
];

const ETATS = [
  { cle: "NEUF", libelle: "Neuf" },
  { cle: "OCCASION", libelle: "D’occasion" },
  { cle: "DEGRADATIONS", libelle: "Dégradations" },
] as const;

type Etat = (typeof ETATS)[number]["cle"];

export interface RetraitVu {
  id: string;
  reference: string;
  statut: string;
  boutique: string;
  produit: string;
  client: {
    nomComplet: string;
    numeroPiece: string | null;
    typePiece: string | null;
    telephone: string | null;
    documents: { id: string; type: string; mimeType: string }[];
  };
  vehicule: { id: string; numeroChassis: string; immatriculation: string | null } | null;
  contrat: {
    id: string;
    reference: string;
    statut: string;
    /** Tracés apposés sur l'acte, montrés au gérant comme référence. */
    signatures: { role: RoleSignataire; signataireNom: string; signedAt: string | Date }[];
  } | null;
  handover: {
    statut: string;
    pieceVerifiee: boolean;
    pieceConforme: boolean | null;
    pieceMotifRefus: string | null;
    photos: { id: string; angle: AngleHandover }[];
  } | null;
}

const MOTIF_MINIMUM = 10;

export default function EcranRetrait({
  retrait,
  base = "/gerant",
}: {
  retrait: RetraitVu;
  /** Espace d'où l'écran est ouvert : l'administrateur ne doit pas en sortir. */
  base?: BaseBackOffice;
}) {
  const router = useRouter();
  const FIL = [FIL_RACINE[base]];

  const pieceValidee = retrait.handover?.pieceConforme === true;
  const pieceRefusee = retrait.handover?.pieceConforme === false;
  const termine = retrait.handover?.statut === "COMPLETE" || retrait.statut === "ACTIVE";

  const [confirmee, setConfirmee] = useState(false);
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [motifRefus, setMotifRefus] = useState("");
  const [tentativeRefus, setTentativeRefus] = useState(false);

  const [photos, setPhotos] = useState<Set<AngleHandover>>(new Set(retrait.handover?.photos.map((p) => p.angle) ?? []));

  const [compteurKm, setCompteurKm] = useState("");
  const [heureRemise, setHeureRemise] = useState(heureCourante());
  const [niveauBatterie, setNiveauBatterie] = useState("100");
  const [carrosserie, setCarrosserie] = useState<Etat>("NEUF");
  const [freinsPneus, setFreinsPneus] = useState<Etat>("NEUF");
  const [batterieChargeur, setBatterieChargeur] = useState<Etat>("NEUF");
  const [casqueRemis, setCasqueRemis] = useState(true);
  const [chargeurRemis, setChargeurRemis] = useState(true);
  const [accessoiresPrecision, setAccessoiresPrecision] = useState("");
  const [observations, setObservations] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const photosObligatoires = ANGLES.filter((a) => a.obligatoire);
  const photosPrises = photosObligatoires.filter((a) => photos.has(a.cle)).length;
  const photosCompletes = photosPrises === photosObligatoires.length;

  async function appeler(corps: Record<string, unknown>) {
    setEnCours(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/gerant/retrait/${retrait.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Opération impossible.");
      return donnees;
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Opération impossible.");
      return null;
    } finally {
      setEnCours(false);
    }
  }

  async function validerPiece(conforme: boolean) {
    if (!conforme && motifRefus.trim().length < MOTIF_MINIMUM) {
      setTentativeRefus(true);
      document.getElementById("motif-refus")?.focus();
      return;
    }
    const resultat = await appeler({ action: "verifier-piece", conforme, motifRefus });
    if (resultat) router.refresh();
  }

  async function completer() {
    const resultat = await appeler({
      action: "completer",
      compteurKm: compteurKm === "" ? null : Number(compteurKm),
      heureRemise,
      niveauBatterie: niveauBatterie === "" ? null : Number(niveauBatterie),
      carrosserie,
      freinsPneus,
      batterieChargeur,
      accessoires: casqueRemis && chargeurRemis ? "COMPLETS" : "MANQUANTS",
      accessoiresPrecision: accessoiresPrecision || undefined,
      casqueRemis,
      chargeurRemis,
      observations: observations || undefined,
    });
    if (resultat) router.refresh();
  }

  // ── Retrait déjà effectué ────────────────────────────────────────────────
  if (termine) {
    return (
      <div className="lme-page lme-page--etroite">
        <EnTetePage fil={FIL} surtitre={`Retrait — ${retrait.boutique}`} titre={retrait.client.nomComplet} />
        <div className="lme-pile">
          <Alerte ton="succes" titre="Véhicule remis">
            Le constat de remise a été établi et signé par les deux parties. La location est active.
          </Alerte>
          <div className="lme-rangee">
            {retrait.contrat ? (
              <LienBouton href={`/api/contrats/${retrait.contrat.id}/pdf`} nouvelOnglet variante="secondaire">
                Contrat
              </LienBouton>
            ) : null}
            <LienBouton href={`/api/actes/constat/${retrait.id}`} nouvelOnglet variante="secondaire">
              Constat de remise
            </LienBouton>
          </div>
        </div>
      </div>
    );
  }

  // ── Pièce refusée : le contrat est caduc ─────────────────────────────────
  if (pieceRefusee) {
    return (
      <div className="lme-page lme-page--etroite">
        <EnTetePage fil={FIL} surtitre={`Retrait — ${retrait.boutique}`} titre={retrait.client.nomComplet} />
        <Alerte ton="erreur" titre="Pièce non conforme — contrat caduc">
          <p>Motif enregistré : « {retrait.handover?.pieceMotifRefus} »</p>
          <p style={{ marginTop: 8 }}>
            Le véhicule a été remis au stock. Le client doit reprendre une réservation avec une pièce conforme.
          </p>
        </Alerte>
      </div>
    );
  }

  // Plus de signature à recueillir : le constat reprend celles du contrat. Il
  // ne reste donc que les photos et l'heure à réunir avant de remettre la moto.
  const etapeCourante = !pieceValidee ? 1 : !photosCompletes ? 2 : !heureRemise.trim() ? 3 : 4;

  const manques = [
    !photosCompletes ? `${photosObligatoires.length - photosPrises} photo(s) obligatoire(s)` : null,
    !heureRemise.trim() ? "l’heure de remise" : null,
  ].filter(Boolean);

  return (
    <div className="lme-page lme-page--etroite">
      <EnTetePage
        fil={FIL}
        surtitre={`Retrait — ${retrait.boutique}`}
        titre={retrait.client.nomComplet}
        description={`${retrait.reference} — ${retrait.produit}${retrait.vehicule ? ` — ${retrait.vehicule.numeroChassis}` : ""}`}
      />

      <Etapes libelles={["Pièce", "Photos", "État", "Signatures"]} courante={etapeCourante} nom="Étapes du retrait" />

      <div className="lme-pile">
        {erreur ? (
          <Alerte ton="erreur" vivante>
            {erreur}
          </Alerte>
        ) : null}

        {/* ── 1. Vérification de la pièce ────────────────────────────── */}
        <Carte
          titre="1. Vérifiez l’original de la pièce"
          description="Demandez au client l’original de sa pièce et comparez-le à la copie. Sans cette vérification, le véhicule ne peut pas être remis."
        >
          <div className="lme-pile">
            <div className="lme-pile lme-pile--serree">
              {retrait.client.documents.map((d) => (
                <figure key={d.id} className="lme-piece">
                  {/* Flux d'image authentifié servi par l'API. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/documents/${d.id}`} alt={d.type === "PIECE_RECTO" ? "Pièce, recto" : "Pièce, verso"} />
                </figure>
              ))}
            </div>

            <div className="lme-encart">
              <Infos>
                <Info libelle="Numéro déclaré" valeur={retrait.client.numeroPiece ?? "—"} fort />
              </Infos>
            </div>

            {pieceValidee ? (
              <Alerte ton="succes" titre="Original vérifié et conforme">
                Vous pouvez procéder à l’état des lieux.
              </Alerte>
            ) : !refusOuvert ? (
              <>
                <label className="lme-case">
                  <input type="checkbox" checked={confirmee} onChange={(e) => setConfirmee(e.target.checked)} />
                  <span className="lme-gras">J’ai vérifié l’original et il correspond à la copie.</span>
                </label>
                <div className="lme-rangee">
                  <Bouton
                    variante="succes"
                    taille="lg"
                    icone={<CircleCheck size={18} aria-hidden />}
                    onClick={() => validerPiece(true)}
                    disabled={!confirmee}
                    chargement={enCours}
                    style={{ flex: "1 1 200px" }}
                  >
                    Pièce conforme
                  </Bouton>
                  <Bouton
                    variante="danger-discret"
                    taille="lg"
                    onClick={() => setRefusOuvert(true)}
                    disabled={enCours}
                    style={{ flex: "1 1 160px" }}
                  >
                    Non conforme
                  </Bouton>
                </div>
              </>
            ) : (
              <div className="lme-pile">
                <Alerte ton="attention" titre="Décision définitive">
                  Déclarer la pièce non conforme rend le contrat <strong>caduc</strong> et remet le véhicule au stock.
                </Alerte>
                <Champ
                  libelle="En quoi la pièce ne correspond-elle pas ?"
                  requis
                  erreur={
                    tentativeRefus && motifRefus.trim().length < MOTIF_MINIMUM
                      ? `Précisez le motif (${MOTIF_MINIMUM} caractères minimum) : il est conservé comme preuve.`
                      : null
                  }
                >
                  <textarea
                    id="motif-refus"
                    rows={3}
                    value={motifRefus}
                    onChange={(e) => setMotifRefus(e.target.value)}
                    placeholder="Le nom de l’original ne correspond pas à celui de la copie transmise."
                  />
                </Champ>
                <div className="lme-rangee">
                  <Bouton variante="danger" onClick={() => validerPiece(false)} chargement={enCours}>
                    Déclarer non conforme
                  </Bouton>
                  <Bouton
                    variante="fantome"
                    onClick={() => {
                      setRefusOuvert(false);
                      setTentativeRefus(false);
                    }}
                    disabled={enCours}
                  >
                    Annuler
                  </Bouton>
                </div>
              </div>
            )}
          </div>
        </Carte>

        {pieceValidee ? (
          <>
            {/* ── 2. Photos ──────────────────────────────────────────── */}
            <Carte
              titre="2. Photos du véhicule"
              description="Elles vous protègent en cas de litige sur l’état de la moto. Les quatre premières sont obligatoires."
            >
              <div className="lme-grille-photos">
                {ANGLES.map((a) => (
                  <PriseDeVue
                    key={a.cle}
                    reservationId={retrait.id}
                    angle={a.cle}
                    libelle={a.libelle}
                    obligatoire={a.obligatoire}
                    prise={photos.has(a.cle)}
                    onPrise={() => setPhotos((p) => new Set(p).add(a.cle))}
                    onErreur={setErreur}
                  />
                ))}
              </div>
              <p
                className={photosCompletes ? "lme-message lme-message--succes" : "lme-message lme-message--attention"}
                style={{ marginTop: 12 }}
                role="status"
              >
                {photosCompletes ? <Check size={16} aria-hidden /> : <TriangleAlert size={16} aria-hidden />}
                {photosPrises} / {photosObligatoires.length} photos obligatoires
              </p>
            </Carte>

            {/* ── 3. État ────────────────────────────────────────────── */}
            <Carte titre="3. État du véhicule">
              <div className="lme-pile">
                <div className="lme-grille-champs">
                  <Champ libelle="Kilométrage" facultatif>
                    <input
                      id="compteur"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={compteurKm}
                      onChange={(e) => setCompteurKm(e.target.value)}
                      placeholder="0"
                    />
                  </Champ>
                  <Champ libelle="Heure de remise" requis erreur={!heureRemise.trim() ? "Indiquez l’heure de remise." : null}>
                    <input id="heure" value={heureRemise} onChange={(e) => setHeureRemise(e.target.value)} placeholder="14h30" />
                  </Champ>
                  <Champ libelle="Charge batterie (%)" facultatif>
                    <input
                      id="batterie"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={niveauBatterie}
                      onChange={(e) => setNiveauBatterie(e.target.value)}
                    />
                  </Champ>
                </div>

                <ChoixEtat nom="carrosserie" libelle="Carrosserie" valeur={carrosserie} onChange={setCarrosserie} />
                <ChoixEtat nom="freins" libelle="Freins / Pneus" valeur={freinsPneus} onChange={setFreinsPneus} />
                <ChoixEtat nom="batterie-chargeur" libelle="Batterie / Chargeur" valeur={batterieChargeur} onChange={setBatterieChargeur} />

                <fieldset className="lme-groupe">
                  <legend>Accessoires remis</legend>
                  <div className="lme-grille-choix">
                    <label className="lme-case">
                      <input type="checkbox" checked={casqueRemis} onChange={(e) => setCasqueRemis(e.target.checked)} />
                      <span>Casque</span>
                    </label>
                    <label className="lme-case">
                      <input type="checkbox" checked={chargeurRemis} onChange={(e) => setChargeurRemis(e.target.checked)} />
                      <span>Chargeur</span>
                    </label>
                  </div>
                </fieldset>

                {!casqueRemis || !chargeurRemis ? (
                  <Champ libelle="Ce qui manque" facultatif aide="Figurera sur le constat de remise.">
                    <input
                      id="precision-accessoires"
                      value={accessoiresPrecision}
                      onChange={(e) => setAccessoiresPrecision(e.target.value)}
                      placeholder="Casque remis ultérieurement"
                    />
                  </Champ>
                ) : null}

                <Champ libelle="Remarques" facultatif>
                  <textarea
                    id="observations"
                    rows={3}
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Rayure sur le garde-boue arrière…"
                  />
                </Champ>
              </div>
            </Carte>

            {/* ── 4. Signatures ──────────────────────────────────────── */}
            <Carte
              titre="4. Signatures"
              description="Le constat reprend les signatures du contrat : personne ne resigne ici."
            >
              <div className="lme-pile">
                <div className="lme-grille-verif">
                  <SignatureDeReference
                    retraitId={retrait.id}
                    role="GERANT"
                    signature={retrait.contrat?.signatures.find((s) => s.role === "GERANT")}
                  />
                  <SignatureDeReference
                    retraitId={retrait.id}
                    role="CLIENT"
                    signature={retrait.contrat?.signatures.find((s) => s.role === "CLIENT")}
                  />
                </div>

                <p className="lme-aide">
                  Ce sont ces deux tracés qui seront imprimés, avec la mention de leur provenance. Ce qui atteste
                  l’état de la moto, ce sont vos photos et la vérification de la pièce.
                </p>

                {manques.length > 0 ? (
                  <p className="lme-message lme-message--attention" role="status">
                    <TriangleAlert size={16} aria-hidden />
                    Il manque : {manques.join(", ")}.
                  </p>
                ) : null}

                <Bouton
                  variante="succes"
                  taille="lg"
                  bloc
                  onClick={completer}
                  chargement={enCours}
                  disabled={!photosCompletes || !heureRemise.trim()}
                >
                  {enCours ? "Établissement du constat…" : "Remettre le véhicule"}
                </Bouton>
              </div>
            </Carte>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

/** Prise de vue d'un angle, appareil photo ouvert directement sur mobile. */
function PriseDeVue({
  reservationId,
  angle,
  libelle,
  obligatoire,
  prise,
  onPrise,
  onErreur,
}: {
  reservationId: string;
  angle: AngleHandover;
  libelle: string;
  obligatoire: boolean;
  prise: boolean;
  onPrise: () => void;
  onErreur: (message: string | null) => void;
}) {
  const champFichier = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(fichier: File) {
    setEnvoi(true);
    onErreur(null);

    try {
      // Une photo de moto prise au téléphone pèse 4 à 8 Mo : inenvoyable en 3G.
      const { default: compresser } = await import("browser-image-compression");
      const compressee = await compresser(fichier, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      const corps = new FormData();
      corps.append("angle", angle);
      corps.append("photo", compressee, `${angle.toLowerCase()}.jpg`);

      const reponse = await fetch(`/api/gerant/retrait/${reservationId}/photo`, {
        method: "POST",
        body: corps,
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Envoi impossible.");

      onPrise();
    } catch (err) {
      onErreur(err instanceof Error ? `${libelle} : ${err.message}` : "Envoi de la photo impossible.");
    } finally {
      setEnvoi(false);
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  return (
    <div>
      <button
        type="button"
        className="lme-prise-vue"
        data-etat={prise ? "prise" : obligatoire ? "obligatoire" : undefined}
        onClick={() => champFichier.current?.click()}
        disabled={envoi}
        aria-label={`${libelle} : ${envoi ? "envoi en cours" : prise ? "photo prise, reprendre" : "prendre la photo"}${obligatoire ? " (obligatoire)" : ""}`}
      >
        {envoi ? (
          <LoaderCircle size={22} className="lme-rotation" aria-hidden />
        ) : prise ? (
          <Check size={22} aria-hidden />
        ) : (
          <Camera size={22} aria-hidden />
        )}
        <span>{libelle}</span>
        {obligatoire && !prise ? (
          <span className="lme-tres-petit" style={{ color: "var(--lme-attention)", fontWeight: 600 }}>
            obligatoire
          </span>
        ) : null}
      </button>

      <input
        ref={champFichier}
        type="file"
        accept="image/*"
        // Ouvre l'appareil arrière du téléphone plutôt que la galerie.
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) envoyer(f);
        }}
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}

function ChoixEtat({
  nom,
  libelle,
  valeur,
  onChange,
}: {
  nom: string;
  libelle: string;
  valeur: Etat;
  onChange: (v: Etat) => void;
}) {
  return (
    <GroupeChoix legende={libelle} disposition="segments">
      {ETATS.map((e) => (
        <Segment key={e.cle} nom={nom} valeur={e.cle} coche={valeur === e.cle} onChoisir={onChange}>
          {e.libelle}
        </Segment>
      ))}
    </GroupeChoix>
  );
}

/**
 * Le tracé du contrat, tel qu'il sera imprimé sur le constat.
 *
 * Le gérant voit ce qu'il appose avant de valider la remise. Absent — donnée
 * incomplète — la carte ne s'affiche pas, et le serveur refusera de son côté :
 * mieux vaut rien qu'un cadre vide qui laisse croire à une signature.
 */
function SignatureDeReference({
  retraitId,
  role,
  signature,
}: {
  retraitId: string;
  role: RoleSignataire;
  signature?: { signataireNom: string; signedAt: string | Date };
}) {
  if (!signature) return null;

  return (
    <figure className="lme-signature-reference">
      {/* Flux d'image authentifié servi par l'API : next/image ne peut pas l'optimiser. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/gerant/retrait/${retraitId}/signature-contrat?role=${role}`}
        alt={`Signature de ${signature.signataireNom} sur le contrat`}
      />
      <figcaption>
        {role === "GERANT" ? "Pour le Bailleur" : "Le Locataire"} — {signature.signataireNom}, signée le{" "}
        {dateFr(signature.signedAt)}.
      </figcaption>
    </figure>
  );
}

function heureCourante(): string {
  const maintenant = new Date();
  return `${maintenant.getHours()}h${String(maintenant.getMinutes()).padStart(2, "0")}`;
}
