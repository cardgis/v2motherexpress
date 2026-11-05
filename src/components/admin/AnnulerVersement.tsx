"use client";

/**
 * Annulation d'un versement — administrateur seul.
 *
 * Le motif est obligatoire : une ligne d'argent ne disparaît pas, elle est
 * barrée avec sa raison et le nom de qui l'a décidé. Le formulaire ne s'ouvre
 * qu'au clic, pour qu'un geste aussi lourd ne soit jamais à portée de doigt
 * par accident.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Champ } from "@/components/ui/Champ";
import { Bouton } from "@/components/ui/Bouton";
import { Alerte } from "@/components/ui/Alerte";

const MOTIF_MINIMUM = 10;

export default function AnnulerVersement({
  encaissementId,
  montant,
}: {
  encaissementId: string;
  /** Déjà formaté : le rappel du montant évite d'annuler la mauvaise ligne. */
  montant: string;
}) {
  const router = useRouter();

  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [tentative, setTentative] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const motifTropCourt = motif.trim().length < MOTIF_MINIMUM;

  async function annuler() {
    if (motifTropCourt) {
      setTentative(true);
      document.getElementById(`motif-${encaissementId}`)?.focus();
      return;
    }

    setEnCours(true);
    setErreur(null);

    try {
      const reponse = await fetch(`/api/admin/versements/${encaissementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "annuler", motif }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Annulation impossible.");

      setOuvert(false);
      setMotif("");
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Annulation impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <Bouton
        variante="fantome"
        taille="sm"
        icone={<Ban size={16} aria-hidden />}
        onClick={() => setOuvert(true)}
      >
        Annuler
        <span className="lme-sr"> le versement de {montant}</span>
      </Bouton>
    );
  }

  return (
    <div className="lme-pile lme-pile--serree" style={{ minWidth: "min(100%, 280px)" }}>
      {erreur ? (
        <Alerte ton="erreur" vivante>
          {erreur}
        </Alerte>
      ) : null}

      <Champ
        libelle={`Motif de l’annulation de ${montant}`}
        requis
        erreur={tentative && motifTropCourt ? `Une phrase au moins (${MOTIF_MINIMUM} caractères).` : null}
        aide="Conservé avec le versement, et visible de l’équipe."
      >
        <textarea
          id={`motif-${encaissementId}`}
          rows={2}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Saisie en double du versement du 12 septembre."
        />
      </Champ>

      <div className="lme-rangee">
        <Bouton variante="danger" taille="sm" onClick={annuler} chargement={enCours}>
          Confirmer l’annulation
        </Bouton>
        <Bouton
          variante="fantome"
          taille="sm"
          onClick={() => {
            setOuvert(false);
            setTentative(false);
            setErreur(null);
          }}
          disabled={enCours}
        >
          Renoncer
        </Bouton>
      </div>
    </div>
  );
}
