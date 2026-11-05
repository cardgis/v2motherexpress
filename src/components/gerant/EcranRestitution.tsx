"use client";

/**
 * Écran de restitution — clôture d'un contrat, sur le téléphone du gérant.
 *
 * Symétrique de l'écran de retrait, avec deux différences de fond :
 *   — pas de pièce d'identité à confronter : le client est déjà connu, c'est
 *     l'état de la moto qui se constate ;
 *   — les DEUX signatures sont recueillies ici, devant le véhicule. Au retour
 *     on oppose au client des dégâts et des sommes : son accord doit être
 *     donné sur place.
 *
 * Les sommes sont affichées AVANT de signer : le gérant annonce au client ce
 * qu'il va reconnaître, il ne le découvre pas sur le PDF.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, LoaderCircle, TriangleAlert } from "lucide-react";
import type { AngleHandover } from "@/generated/prisma";
import { fcfa } from "@/lib/formatters";
import { FIL_RACINE, type BaseBackOffice } from "./espace-backoffice";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton, LienBouton } from "@/components/ui/Bouton";
import { Etapes } from "@/components/ui/Etapes";
import { GroupeChoix, Segment } from "@/components/ui/Choix";
import { Info, Infos } from "@/components/ui/Infos";
import ZoneSignature, { lireTrace } from "@/components/signature/ZoneSignature";

const ANGLES: { cle: AngleHandover; libelle: string; obligatoire: boolean }[] = [
  { cle: "AVANT", libelle: "Avant", obligatoire: true },
  { cle: "ARRIERE", libelle: "Arrière", obligatoire: true },
  { cle: "GAUCHE", libelle: "Côté gauche", obligatoire: true },
  { cle: "DROITE", libelle: "Côté droit", obligatoire: true },
  { cle: "COMPTEUR", libelle: "Compteur", obligatoire: false },
  { cle: "CHASSIS", libelle: "Numéro de châssis", obligatoire: false },
];

/** Libellés du modèle papier : au retour, la question est l'usure. */
const ETATS = [
  { cle: "BON_ETAT", libelle: "Bon état" },
  { cle: "USURE_NORMALE", libelle: "Usure normale" },
  { cle: "DEGRADATIONS", libelle: "Dégradations" },
] as const;

type Etat = (typeof ETATS)[number]["cle"];

const MOTIFS = [
  { cle: "FIN_NORMALE", libelle: "Fin normale" },
  { cle: "RUPTURE_ANTICIPEE", libelle: "Rupture anticipée" },
  { cle: "DEFAUT_DE_PAIEMENT", libelle: "Défaut de paiement" },
  { cle: "AUTRE", libelle: "Autre" },
] as const;

type Motif = (typeof MOTIFS)[number]["cle"];

/** Motifs qui rendent le différentiel exigible — même règle que le serveur. */
const MOTIFS_IMPUTABLES: Motif[] = ["RUPTURE_ANTICIPEE", "DEFAUT_DE_PAIEMENT"];

type Signataire = "GERANT" | "CLIENT";

export interface RestitutionVue {
  id: string;
  reference: string;
  statut: string;
  boutique: string;
  produit: string;
  formule: string;
  restituable: boolean;
  avecEngagement: boolean;
  differentielJournalier: number | null;
  client: { nomComplet: string; numeroPiece: string | null; telephone: string | null };
  vehicule: { id: string; numeroChassis: string; immatriculation: string | null } | null;
  contrat: { id: string; reference: string } | null;
  compteurKmRemise: number | null;
  restitution: { statut: string; photos: { id: string; angle: AngleHandover }[] } | null;
  comptes: {
    redevancesImpayees: number | null;
    differentielRupture: number | null;
    differentielJours: number | null;
  };
}

export default function EcranRestitution({
  restitution,
  base = "/gerant",
}: {
  restitution: RestitutionVue;
  /** Espace d'où l'écran est ouvert : l'administrateur ne doit pas en sortir. */
  base?: BaseBackOffice;
}) {
  const router = useRouter();
  const FIL = [FIL_RACINE[base]];

  const termine =
    restitution.restitution?.statut === "COMPLETE" ||
    restitution.statut === "ARRETEE" ||
    restitution.statut === "TERMINEE";

  const [photos, setPhotos] = useState<Set<AngleHandover>>(
    new Set(restitution.restitution?.photos.map((p) => p.angle) ?? []),
  );

  const [motif, setMotif] = useState<Motif>("FIN_NORMALE");
  const [motifPrecision, setMotifPrecision] = useState("");
  const [heureRestitution, setHeureRestitution] = useState(heureCourante());
  const [compteurKm, setCompteurKm] = useState("");
  const [niveauBatterie, setNiveauBatterie] = useState("");
  const [carrosserie, setCarrosserie] = useState<Etat>("BON_ETAT");
  const [freinsPneus, setFreinsPneus] = useState<Etat>("BON_ETAT");
  const [batterieChargeur, setBatterieChargeur] = useState<Etat>("BON_ETAT");
  const [casqueRendu, setCasqueRendu] = useState(true);
  const [chargeurRendu, setChargeurRendu] = useState(true);
  const [accessoiresPrecision, setAccessoiresPrecision] = useState("");
  const [dommagesConstates, setDommagesConstates] = useState(false);
  const [dommagesPrecision, setDommagesPrecision] = useState("");
  const [coutReparations, setCoutReparations] = useState("");
  const [observations, setObservations] = useState("");

  // Un seul canevas est monté à la fois : `lireTrace()` interroge le DOM, deux
  // zones simultanées se confondraient. Le tracé achevé est mis de côté ici.
  const [signataire, setSignataire] = useState<Signataire>("GERANT");
  const [traces, setTraces] = useState<{ GERANT: string | null; CLIENT: string | null }>({
    GERANT: null,
    CLIENT: null,
  });

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const photosObligatoires = ANGLES.filter((a) => a.obligatoire);
  const photosPrises = photosObligatoires.filter((a) => photos.has(a.cle)).length;
  const photosCompletes = photosPrises === photosObligatoires.length;

  // Le différentiel n'est dû que si la rupture est imputable au client : tant
  // que le motif ne l'établit pas, on ne l'annonce pas.
  const differentielDu =
    restitution.avecEngagement && MOTIFS_IMPUTABLES.includes(motif)
      ? restitution.comptes.differentielRupture
      : null;

  const reparations = Number(coutReparations) > 0 ? Math.round(Number(coutReparations)) : null;
  const total =
    (restitution.comptes.redevancesImpayees ?? 0) + (differentielDu ?? 0) + (reparations ?? 0);

  const manques = [
    !photosCompletes ? `${photosObligatoires.length - photosPrises} photo(s) obligatoire(s)` : null,
    !heureRestitution.trim() ? "l’heure de restitution" : null,
    dommagesConstates && !dommagesPrecision.trim() ? "la description des dommages" : null,
    motif === "AUTRE" && !motifPrecision.trim() ? "le motif" : null,
    !traces.GERANT ? "votre signature" : null,
    !traces.CLIENT ? "la signature du client" : null,
  ].filter(Boolean) as string[];

  /** Met de côté le tracé du signataire courant dès qu'un trait est achevé. */
  function capturer(rempli: boolean) {
    setTraces((t) => ({ ...t, [signataire]: rempli ? lireTrace() : null }));
  }

  function changerSignataire(suivant: Signataire) {
    if (suivant === signataire) return;
    // Le canevas va être démonté : on relit une dernière fois ce qu'il porte.
    const courant = lireTrace();
    setTraces((t) => ({ ...t, [signataire]: t[signataire] ? courant : t[signataire] }));
    setSignataire(suivant);
  }

  async function clore() {
    setEnCours(true);
    setErreur(null);

    try {
      const reponse = await fetch(`/api/gerant/restitution/${restitution.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motif,
          motifPrecision: motifPrecision || undefined,
          heureRestitution,
          compteurKm: compteurKm === "" ? null : Number(compteurKm),
          niveauBatterie: niveauBatterie === "" ? null : Number(niveauBatterie),
          carrosserie,
          freinsPneus,
          batterieChargeur,
          accessoires: casqueRendu && chargeurRendu ? "COMPLETS" : "MANQUANTS",
          accessoiresPrecision: accessoiresPrecision || undefined,
          dommagesConstates,
          dommagesPrecision: dommagesPrecision || undefined,
          coutReparations: reparations,
          observations: observations || undefined,
          traceGerant: traces.GERANT,
          traceClient: traces.CLIENT,
        }),
      });

      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Opération impossible.");

      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Opération impossible.");
    } finally {
      setEnCours(false);
    }
  }

  // ── Formule sans restitution ─────────────────────────────────────────────
  if (!restitution.restituable) {
    return (
      <div className="lme-page lme-page--etroite">
        <EnTetePage fil={FIL} surtitre="Restitution" titre={restitution.client.nomComplet} />
        <Alerte ton="info" titre="Pas de restitution pour cette formule">
          Une vente échelonnée ne donne pas lieu à un état des lieux de sortie : le véhicule reste
          au client, et le dossier se clôt au dernier versement.
        </Alerte>
      </div>
    );
  }

  // ── Contrat déjà clos ────────────────────────────────────────────────────
  if (termine) {
    return (
      <div className="lme-page lme-page--etroite">
        <EnTetePage
          fil={FIL}
          surtitre={`Restitution — ${restitution.boutique}`}
          titre={restitution.client.nomComplet}
        />
        <div className="lme-pile">
          <Alerte ton="succes" titre="Contrat arrêté">
            Le constat de restitution a été établi et signé par les deux parties. Ce qui reste à
            recouvrer — réparations, différentiel, impayés — apparaît dans le suivi des versements.
          </Alerte>
          <div className="lme-rangee">
            {restitution.contrat ? (
              <LienBouton
                href={`/api/contrats/${restitution.contrat.id}/pdf`}
                nouvelOnglet
                variante="secondaire"
              >
                Contrat
              </LienBouton>
            ) : null}
            <LienBouton
              href={`/api/actes/constat/${restitution.id}`}
              nouvelOnglet
              variante="secondaire"
            >
              Constat de remise
            </LienBouton>
            <LienBouton
              href={`/api/actes/restitution/${restitution.id}`}
              nouvelOnglet
              variante="secondaire"
            >
              Constat de restitution
            </LienBouton>
          </div>
        </div>
      </div>
    );
  }

  // ── Réservation non active ───────────────────────────────────────────────
  if (restitution.statut !== "ACTIVE") {
    return (
      <div className="lme-page lme-page--etroite">
        <EnTetePage fil={FIL} surtitre="Restitution" titre={restitution.client.nomComplet} />
        <Alerte ton="attention" titre="Rien à restituer">
          Ce dossier est en statut <strong>{restitution.statut}</strong> : la moto n’est pas sortie.
        </Alerte>
      </div>
    );
  }

  const etapeCourante = !photosCompletes
    ? 1
    : !heureRestitution.trim()
      ? 2
      : !traces.GERANT && !traces.CLIENT
        ? 3
        : 4;

  return (
    <div className="lme-page lme-page--etroite">
      <EnTetePage
        fil={FIL}
        surtitre={`Restitution — ${restitution.boutique}`}
        titre={restitution.client.nomComplet}
        description={`${restitution.reference} — ${restitution.produit}${restitution.vehicule ? ` — ${restitution.vehicule.numeroChassis}` : ""}`}
      />

      <Etapes
        libelles={["Photos", "État", "Sommes", "Signatures"]}
        courante={etapeCourante}
        nom="Étapes de la restitution"
      />

      <div className="lme-pile">
        {erreur ? (
          <Alerte ton="erreur" vivante>
            {erreur}
          </Alerte>
        ) : null}

        {/* ── 1. Photos ──────────────────────────────────────────────── */}
        <Carte
          titre="1. Photos du véhicule au retour"
          description="Mêmes angles qu’à la remise : c’est la comparaison des deux séries qui établit une dégradation. Les quatre premières sont obligatoires."
        >
          <div className="lme-grille-photos">
            {ANGLES.map((a) => (
              <PriseDeVue
                key={a.cle}
                reservationId={restitution.id}
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
            className={
              photosCompletes ? "lme-message lme-message--succes" : "lme-message lme-message--attention"
            }
            style={{ marginTop: 12 }}
            role="status"
          >
            {photosCompletes ? <Check size={16} aria-hidden /> : <TriangleAlert size={16} aria-hidden />}
            {photosPrises} / {photosObligatoires.length} photos obligatoires
          </p>
        </Carte>

        {/* ── 2. État ────────────────────────────────────────────────── */}
        <Carte titre="2. État du véhicule au retour">
          <div className="lme-pile">
            <GroupeChoix legende="Motif de la restitution" disposition="segments">
              {MOTIFS.map((m) => (
                <Segment key={m.cle} nom="motif" valeur={m.cle} coche={motif === m.cle} onChoisir={setMotif}>
                  {m.libelle}
                </Segment>
              ))}
            </GroupeChoix>

            {motif === "AUTRE" ? (
              <Champ
                libelle="Précisez le motif"
                requis
                erreur={!motifPrecision.trim() ? "Ce motif figure sur le constat." : null}
              >
                <input
                  id="motif-precision"
                  value={motifPrecision}
                  onChange={(e) => setMotifPrecision(e.target.value)}
                  placeholder="Véhicule repris à la demande du client"
                />
              </Champ>
            ) : null}

            <div className="lme-grille-champs">
              <Champ
                libelle="Kilométrage"
                facultatif
                aide={
                  restitution.compteurKmRemise !== null
                    ? `À la remise : ${restitution.compteurKmRemise} km`
                    : undefined
                }
              >
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
              <Champ
                libelle="Heure de restitution"
                requis
                erreur={!heureRestitution.trim() ? "Indiquez l’heure." : null}
              >
                <input
                  id="heure"
                  value={heureRestitution}
                  onChange={(e) => setHeureRestitution(e.target.value)}
                  placeholder="14h30"
                />
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
            <ChoixEtat
              nom="batterie-chargeur"
              libelle="Batterie / Chargeur"
              valeur={batterieChargeur}
              onChange={setBatterieChargeur}
            />

            <fieldset className="lme-groupe">
              <legend>Accessoires rendus</legend>
              <div className="lme-grille-choix">
                <label className="lme-case">
                  <input
                    type="checkbox"
                    checked={casqueRendu}
                    onChange={(e) => setCasqueRendu(e.target.checked)}
                  />
                  <span>Casque</span>
                </label>
                <label className="lme-case">
                  <input
                    type="checkbox"
                    checked={chargeurRendu}
                    onChange={(e) => setChargeurRendu(e.target.checked)}
                  />
                  <span>Chargeur</span>
                </label>
              </div>
            </fieldset>

            {!casqueRendu || !chargeurRendu ? (
              <Champ libelle="Ce qui manque" facultatif aide="Figurera sur le constat.">
                <input
                  id="precision-accessoires"
                  value={accessoiresPrecision}
                  onChange={(e) => setAccessoiresPrecision(e.target.value)}
                  placeholder="Chargeur non rendu"
                />
              </Champ>
            ) : null}

            <label className="lme-case">
              <input
                type="checkbox"
                checked={dommagesConstates}
                onChange={(e) => setDommagesConstates(e.target.checked)}
              />
              <span className="lme-gras">Des dommages sont constatés</span>
            </label>

            {dommagesConstates ? (
              <>
                <Champ
                  libelle="Décrivez les dommages"
                  requis
                  erreur={
                    !dommagesPrecision.trim()
                      ? "Sans description, un dommage n’est pas opposable au client."
                      : null
                  }
                >
                  <textarea
                    id="dommages"
                    rows={3}
                    value={dommagesPrecision}
                    onChange={(e) => setDommagesPrecision(e.target.value)}
                    placeholder="Garde-boue arrière fendu, rétroviseur droit cassé."
                  />
                </Champ>
                <Alerte ton="info">
                  La moto passera en <strong>atelier</strong> plutôt qu’au stock disponible.
                </Alerte>
              </>
            ) : null}

            <Champ libelle="Remarques" facultatif>
              <textarea
                id="observations"
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Moto rendue propre, batterie chargée."
              />
            </Champ>
          </div>
        </Carte>

        {/* ── 3. Sommes ──────────────────────────────────────────────── */}
        <Carte
          titre="3. Sommes dues au retour"
          description="Annoncez-les au client avant de faire signer. Le constat les récapitule, il n’ajoute aucune obligation à celles du contrat."
        >
          <div className="lme-pile">
            <div className="lme-encart">
              <Infos>
                <Info
                  libelle="Redevances échues et impayées"
                  valeur={
                    restitution.comptes.redevancesImpayees
                      ? fcfa(restitution.comptes.redevancesImpayees)
                      : "Aucune"
                  }
                  fort={!!restitution.comptes.redevancesImpayees}
                />
                {restitution.avecEngagement ? (
                  <Info
                    libelle={`Différentiel de rupture${
                      restitution.comptes.differentielJours !== null
                        ? ` (${restitution.comptes.differentielJours} j)`
                        : ""
                    }`}
                    valeur={differentielDu ? fcfa(differentielDu) : "Non exigible"}
                    fort={!!differentielDu}
                  />
                ) : null}
                <Info libelle="Total annoncé" valeur={total > 0 ? fcfa(total) : "Néant"} fort />
              </Infos>
            </div>

            {restitution.avecEngagement && !differentielDu ? (
              <p className="lme-aide">
                Le différentiel de {restitution.differentielJournalier ? fcfa(restitution.differentielJournalier) : "500 FCFA"} par
                jour n’est dû qu’en cas de rupture imputable au client — article 5 du contrat. Le
                motif choisi ne l’établit pas.
              </p>
            ) : null}

            <Champ
              libelle="Frais de remise en état (FCFA)"
              facultatif
              aide="Aucun barème n’est fixé ici : les réparations sont dues dans les conditions prévues au contrat. Laissez vide s’il n’y en a pas."
            >
              <input
                id="cout-reparations"
                type="number"
                inputMode="numeric"
                min={0}
                value={coutReparations}
                onChange={(e) => setCoutReparations(e.target.value)}
                placeholder="0"
              />
            </Champ>
          </div>
        </Carte>

        {/* ── 4. Signatures ──────────────────────────────────────────── */}
        <Carte
          titre="4. Signatures des deux parties"
          description="Elles sont recueillies ici, devant la moto : c’est ce qui rend l’état constaté et les sommes opposables."
        >
          <div className="lme-pile">
            <GroupeChoix legende="Qui signe" disposition="segments">
              <Segment
                nom="signataire"
                valeur="GERANT"
                coche={signataire === "GERANT"}
                onChoisir={changerSignataire}
              >
                Pour le Bailleur {traces.GERANT ? "✓" : ""}
              </Segment>
              <Segment
                nom="signataire"
                valeur="CLIENT"
                coche={signataire === "CLIENT"}
                onChoisir={changerSignataire}
              >
                Le Locataire {traces.CLIENT ? "✓" : ""}
              </Segment>
            </GroupeChoix>

            <p className="lme-aide">
              {signataire === "GERANT"
                ? "Signez pour La Mother Express, puis passez la tablette au client."
                : `${restitution.client.nomComplet} signe pour reconnaître l’état décrit et les sommes annoncées.`}
            </p>

            {/* `key` force un canevas neuf par signataire : aucun mélange de tracés. */}
            <ZoneSignature key={signataire} onChangement={capturer} />

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
              onClick={clore}
              chargement={enCours}
              disabled={manques.length > 0}
            >
              {enCours ? "Établissement du constat…" : "Clore le contrat"}
            </Bouton>
          </div>
        </Carte>
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

      const reponse = await fetch(`/api/gerant/restitution/${reservationId}/photo`, {
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

function heureCourante(): string {
  const maintenant = new Date();
  return `${maintenant.getHours()}h${String(maintenant.getMinutes()).padStart(2, "0")}`;
}
