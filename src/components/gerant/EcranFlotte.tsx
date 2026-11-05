"use client";

/**
 * Inventaire des motos de la boutique.
 *
 * Ce sont ces informations qui s'impriment à l'article 2 des contrats :
 * numéro de série et immatriculation. Une moto sans immatriculation sortira
 * « Néant » sur l'acte — l'écran le signale en ambre plutôt que de laisser la
 * découverte se faire au moment de la signature.
 *
 * Chaque moto affiche ses propres erreurs dans son bloc : un message en haut
 * de page serait hors de vue quand on modifie la dixième moto de la liste.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
// Les libellés viennent d'un module SANS accès à la base : importer
// `lib/gerant/flotte` ici entraînerait Prisma, donc `pg`, dans le navigateur.
import { LIBELLES_STATUT_VEHICULE, STATUTS_MANUELS } from "@/lib/gerant/flotte-libelles";
import { FIL_RACINE, type BaseBackOffice } from "./espace-backoffice";
import type { StatutVehicule } from "@/generated/prisma";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";
import { StatutBadge } from "@/components/ui/Badge";
import { EtatVide } from "@/components/ui/EtatVide";

interface VehiculeVu {
  id: string;
  produitId: string;
  produit: string;
  modele: string;
  boutique: string;
  numeroChassis: string;
  immatriculation: string | null;
  cmc: string | null;
  couleur: string | null;
  statut: StatutVehicule;
  engageeSur: { id: string; reference: string; statut: string } | null;
}

const NOUVELLE_MOTO = (produitId: string, boutiqueId: string) => ({
  boutiqueId,
  produitId,
  numeroChassis: "",
  immatriculation: "",
  cmc: "",
  couleur: "",
});

/** Appel à l'API de flotte : renvoie le message d'erreur, ou `null` si tout va bien. */
async function appelerFlotte(methode: "POST" | "PATCH" | "DELETE", corps: Record<string, unknown>): Promise<string | null> {
  try {
    const reponse = await fetch("/api/gerant/flotte", {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const donnees = await reponse.json().catch(() => null);
    return reponse.ok ? null : (donnees?.error ?? "Opération impossible.");
  } catch {
    return "Connexion perdue. Réessayez dans un instant.";
  }
}

export default function EcranFlotte({
  vehicules,
  modeles,
  peutAjouter,
  lectureSeule = false,
  boutiques = [],
  base = "/gerant",
}: {
  vehicules: VehiculeVu[];
  modeles: { id: string; nom: string; modele: string }[];
  peutAjouter: boolean;
  /** Commercial : inventaire consultable, aucune modification. */
  lectureSeule?: boolean;
  /** Administrateur : toutes les boutiques, choisies à l'ajout. */
  boutiques?: { id: string; nom: string }[];
  /** Espace d'où l'écran est ouvert : l'administrateur ne doit pas en sortir. */
  base?: BaseBackOffice;
}) {
  const router = useRouter();
  const toutesBoutiques = boutiques.length > 0;
  const motoVierge = () => NOUVELLE_MOTO(modeles[0]?.id ?? "", boutiques[0]?.id ?? "");

  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurAjout, setErreurAjout] = useState<string | null>(null);
  const [tentative, setTentative] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(motoVierge);

  const sansImmatriculation = vehicules.filter((v) => !v.immatriculation).length;
  const chassisTropCourt = nouveau.numeroChassis.trim().length < 5;

  async function ajouter() {
    if (chassisTropCourt || !nouveau.produitId || (toutesBoutiques && !nouveau.boutiqueId)) {
      setTentative(true);
      document.getElementById("chassis")?.focus();
      return;
    }

    setEnCours(true);
    setErreurAjout(null);
    const erreur = await appelerFlotte("POST", nouveau);
    setEnCours(false);

    if (erreur) {
      setErreurAjout(erreur);
      return;
    }

    setConfirmation(`Moto ${nouveau.numeroChassis.trim().toUpperCase()} enregistrée.`);
    setNouveau(motoVierge());
    setTentative(false);
    setAjoutOuvert(false);
    router.refresh();
  }

  function basculerAjout() {
    setAjoutOuvert((o) => !o);
    setErreurAjout(null);
    setTentative(false);
    setConfirmation(null);
  }

  return (
    <div className="lme-page lme-page--moyenne">
      <EnTetePage
        fil={[FIL_RACINE[base]]}
        surtitre="Back-office"
        titre={toutesBoutiques ? "Flotte des boutiques" : "Ma flotte"}
        description={`${vehicules.length} moto${vehicules.length > 1 ? "s" : ""} enregistrée${vehicules.length > 1 ? "s" : ""}`}
        actions={
          peutAjouter ? (
            <Bouton
              variante={ajoutOuvert ? "secondaire" : "primaire"}
              icone={ajoutOuvert ? <X size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
              onClick={basculerAjout}
              aria-expanded={ajoutOuvert}
              aria-controls="ajout-moto"
            >
              {ajoutOuvert ? "Annuler" : "Ajouter une moto"}
            </Bouton>
          ) : null
        }
      />

      <div className="lme-pile">
        {confirmation ? (
          <Alerte ton="succes" vivante>
            {confirmation}
          </Alerte>
        ) : null}

        {sansImmatriculation > 0 ? (
          <Alerte ton="attention" titre={`${sansImmatriculation} moto${sansImmatriculation > 1 ? "s" : ""} sans immatriculation`}>
            Sur un contrat, le champ sortira « Néant ». Renseignez-la dès que la carte grise vous parvient — cela
            n’affecte pas les contrats déjà signés.
          </Alerte>
        ) : null}

        {/* ── Ajout ──────────────────────────────────────────────────── */}
        {ajoutOuvert ? (
          <Carte
            id="ajout-moto"
            accent
            titre="Nouvelle moto"
            description="Le numéro de série est gravé sur le cadre. Il identifie la machine sur le contrat et ne pourra plus être changé."
          >
            <div className="lme-pile">
              <div className="lme-grille-champs">
                {toutesBoutiques ? (
                  <Champ
                    libelle="Boutique"
                    requis
                    erreur={tentative && !nouveau.boutiqueId ? "Choisissez la boutique." : null}
                    aide="Là où la moto est stationnée : elle ne pourra être attribuée qu’aux dossiers de cette boutique."
                  >
                    <select
                      id="boutique"
                      value={nouveau.boutiqueId}
                      onChange={(e) => setNouveau({ ...nouveau, boutiqueId: e.target.value })}
                    >
                      {boutiques.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nom}
                        </option>
                      ))}
                    </select>
                  </Champ>
                ) : null}
                <Champ libelle="Modèle" requis erreur={tentative && !nouveau.produitId ? "Choisissez le modèle." : null}>
                  <select
                    id="modele"
                    value={nouveau.produitId}
                    onChange={(e) => setNouveau({ ...nouveau, produitId: e.target.value })}
                  >
                    {modeles.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom}
                      </option>
                    ))}
                  </select>
                </Champ>
                <Champ
                  libelle="Numéro de série"
                  requis
                  erreur={tentative && chassisTropCourt ? "Au moins 5 caractères, tels que gravés sur le cadre." : null}
                >
                  <input
                    id="chassis"
                    className="lme-mono"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={nouveau.numeroChassis}
                    onChange={(e) => setNouveau({ ...nouveau, numeroChassis: e.target.value })}
                    placeholder="HB3BH2108S9110183"
                  />
                </Champ>
                <Champ libelle="Immatriculation" facultatif aide="Laissez vide si elle n’est pas encore attribuée.">
                  <input
                    id="immat"
                    value={nouveau.immatriculation}
                    onChange={(e) => setNouveau({ ...nouveau, immatriculation: e.target.value })}
                  />
                </Champ>
                <Champ libelle="CMC" facultatif aide="Certificat de mise en circulation.">
                  <input
                    id="cmc"
                    value={nouveau.cmc}
                    onChange={(e) => setNouveau({ ...nouveau, cmc: e.target.value })}
                    placeholder="2026 14V 12239"
                  />
                </Champ>
                <Champ libelle="Couleur" facultatif>
                  <input
                    id="couleur"
                    value={nouveau.couleur}
                    onChange={(e) => setNouveau({ ...nouveau, couleur: e.target.value })}
                    placeholder="Noir"
                  />
                </Champ>
              </div>

              {erreurAjout ? (
                <Alerte ton="erreur" vivante>
                  {erreurAjout}
                </Alerte>
              ) : null}
            </div>

            <div className="lme-actions">
              <Bouton variante="fantome" onClick={basculerAjout} disabled={enCours}>
                Annuler
              </Bouton>
              <Bouton className="lme-actions__principal" onClick={ajouter} chargement={enCours}>
                Enregistrer la moto
              </Bouton>
            </div>
          </Carte>
        ) : null}

        {/* ── Inventaire ─────────────────────────────────────────────── */}
        {vehicules.length === 0 ? (
          <EtatVide
            icone={<Bike size={28} aria-hidden />}
            titre="Aucune moto enregistrée"
            action={
              peutAjouter && !ajoutOuvert ? (
                <Bouton icone={<Plus size={18} aria-hidden />} onClick={basculerAjout}>
                  Ajouter une moto
                </Bouton>
              ) : null
            }
          >
            {lectureSeule
              ? "Le gérant de la boutique n’a pas encore enregistré de moto."
              : "Ajoutez vos motos pour pouvoir les attribuer aux dossiers clients."}
          </EtatVide>
        ) : (
          <ul className="lme-liste">
            {vehicules.map((v) => (
              <LigneVehicule
                key={v.id}
                vehicule={v}
                lectureSeule={lectureSeule}
                afficherBoutique={toutesBoutiques}
                onFait={() => router.refresh()}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Une moto
// ---------------------------------------------------------------------------

function LigneVehicule({
  vehicule,
  lectureSeule,
  afficherBoutique,
  onFait,
}: {
  vehicule: VehiculeVu;
  lectureSeule: boolean;
  afficherBoutique: boolean;
  onFait: () => void;
}) {
  const [edition, setEdition] = useState(false);
  const [immatriculation, setImmatriculation] = useState(vehicule.immatriculation ?? "");
  const [cmc, setCmc] = useState(vehicule.cmc ?? "");
  const [couleur, setCouleur] = useState(vehicule.couleur ?? "");
  const [statut, setStatut] = useState<StatutVehicule>(vehicule.statut);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const engagee = vehicule.engageeSur !== null;

  async function executer(methode: "PATCH" | "DELETE", corps: Record<string, unknown>) {
    setEnCours(true);
    setErreur(null);
    const message = await appelerFlotte(methode, { vehiculeId: vehicule.id, ...corps });
    setEnCours(false);
    if (message) {
      setErreur(message);
      return false;
    }
    onFait();
    return true;
  }

  async function enregistrer() {
    const champs: Record<string, unknown> = { immatriculation, cmc, couleur };
    // Le statut n'est transmis que si le gérant l'a réellement changé : sinon
    // le serveur refuserait une moto déjà engagée sur un dossier.
    if (statut !== vehicule.statut) champs.statut = statut;
    if (await executer("PATCH", champs)) setEdition(false);
  }

  function annuler() {
    setEdition(false);
    setConfirmerRetrait(false);
    setErreur(null);
    setImmatriculation(vehicule.immatriculation ?? "");
    setCmc(vehicule.cmc ?? "");
    setCouleur(vehicule.couleur ?? "");
    setStatut(vehicule.statut);
  }

  return (
    <li className="lme-bloc">
      <div className="lme-rangee lme-rangee--entre" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="lme-sous-titre">{vehicule.produit}</h2>
          {afficherBoutique ? <p className="lme-aide">{vehicule.boutique}</p> : null}
          <p className="lme-petit lme-texte-2">
            Série <span className="lme-mono lme-gras">{vehicule.numeroChassis}</span>
          </p>
          {vehicule.immatriculation ? (
            <p className="lme-petit">
              Immatriculation <strong>{vehicule.immatriculation}</strong>
            </p>
          ) : (
            <p className="lme-message lme-message--attention">
              <TriangleAlert size={14} aria-hidden />
              Immatriculation à renseigner
            </p>
          )}
          {vehicule.couleur || vehicule.cmc ? (
            <p className="lme-aide">
              {[vehicule.couleur, vehicule.cmc ? `CMC ${vehicule.cmc}` : null].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="lme-pile lme-pile--serree" style={{ justifyItems: "end" }}>
          <StatutBadge type="vehicule" statut={vehicule.statut} lecteur="gerant" />
          {vehicule.engageeSur ? <p className="lme-aide">Dossier {vehicule.engageeSur.reference}</p> : null}
        </div>
      </div>

      {edition ? (
        <div className="lme-pile" style={{ marginTop: 16 }}>
          <div className="lme-grille-champs">
            <Champ libelle="Immatriculation" facultatif>
              <input
                id={`immat-${vehicule.id}`}
                value={immatriculation}
                onChange={(e) => setImmatriculation(e.target.value)}
                placeholder="TH 4412"
              />
            </Champ>
            <Champ libelle="CMC" facultatif>
              <input
                id={`cmc-${vehicule.id}`}
                value={cmc}
                onChange={(e) => setCmc(e.target.value)}
                placeholder="2026 14V 12239"
              />
            </Champ>
            <Champ libelle="Couleur" facultatif>
              <input id={`couleur-${vehicule.id}`} value={couleur} onChange={(e) => setCouleur(e.target.value)} />
            </Champ>
            <Champ
              libelle="Statut"
              verrou={engagee ? `Piloté par le dossier ${vehicule.engageeSur?.reference}.` : undefined}
            >
              <select
                id={`statut-${vehicule.id}`}
                value={statut}
                onChange={(e) => setStatut(e.target.value as StatutVehicule)}
                disabled={engagee}
              >
                {STATUTS_MANUELS.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLES_STATUT_VEHICULE[s]}
                  </option>
                ))}
                {/* Le statut courant reste visible même s'il n'est pas modifiable. */}
                {!STATUTS_MANUELS.includes(vehicule.statut) ? (
                  <option value={vehicule.statut}>{LIBELLES_STATUT_VEHICULE[vehicule.statut]} (posé par le dossier)</option>
                ) : null}
              </select>
            </Champ>
          </div>

          {erreur ? (
            <Alerte ton="erreur" vivante>
              {erreur}
            </Alerte>
          ) : null}

          <div className="lme-rangee">
            <Bouton onClick={enregistrer} chargement={enCours && !confirmerRetrait}>
              Enregistrer
            </Bouton>
            <Bouton variante="fantome" onClick={annuler} disabled={enCours}>
              Annuler
            </Bouton>

            {!engagee ? (
              confirmerRetrait ? (
                <span className="lme-rangee" style={{ marginLeft: "auto" }}>
                  <Bouton
                    variante="danger"
                    taille="sm"
                    icone={<Trash2 size={16} aria-hidden />}
                    onClick={() => executer("DELETE", {})}
                    chargement={enCours}
                  >
                    Confirmer le retrait
                  </Bouton>
                  <Bouton variante="fantome" taille="sm" onClick={() => setConfirmerRetrait(false)} disabled={enCours}>
                    Garder
                  </Bouton>
                </span>
              ) : (
                <Bouton
                  variante="danger-discret"
                  taille="sm"
                  icone={<Trash2 size={16} aria-hidden />}
                  onClick={() => setConfirmerRetrait(true)}
                  disabled={enCours}
                  style={{ marginLeft: "auto" }}
                >
                  Retirer de l’inventaire
                </Bouton>
              )
            ) : null}
          </div>
        </div>
      ) : lectureSeule ? null : (
        <div style={{ marginTop: 14 }}>
          <Bouton variante="secondaire" taille="sm" icone={<Pencil size={16} aria-hidden />} onClick={() => setEdition(true)}>
            Modifier
          </Bouton>
        </div>
      )}
    </li>
  );
}
