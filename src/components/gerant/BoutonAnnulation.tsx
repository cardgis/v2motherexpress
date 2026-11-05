"use client";

/**
 * Annulation d'un dossier — le client s'est désisté.
 *
 * Le motif est exigé avant tout envoi : il est conservé comme trace, et un
 * dossier annulé sans raison écrite ne se distingue pas d'une fausse manœuvre.
 *
 * Code couleur : rouge pour la seule décision irréversible, comme le refus de
 * pièce au comptoir. Conformément à CLAUDE.md, aucun `<dialog>` natif — le
 * panneau est un simple état React.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";

const MOTIF_MINIMUM = 10;

export default function BoutonAnnulation({
  reservationId,
  reference,
  vehiculeAttribue,
  onErreur,
}: {
  reservationId: string;
  reference: string;
  /** Une moto est réservée : l'annulation la rendra au stock. */
  vehiculeAttribue: boolean;
  onErreur?: (message: string | null) => void;
}) {
  const router = useRouter();

  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [tentative, setTentative] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const motifTropCourt = motif.trim().length < MOTIF_MINIMUM;

  async function annuler() {
    if (motifTropCourt) {
      setTentative(true);
      document.getElementById(`motif-annulation-${reservationId}`)?.focus();
      return;
    }

    setEnCours(true);
    onErreur?.(null);

    try {
      const reponse = await fetch(`/api/gerant/reservations/${reservationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "annuler", motif }),
      });

      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Annulation impossible.");

      setOuvert(false);
      router.refresh();
    } catch (err) {
      onErreur?.(err instanceof Error ? err.message : "Annulation impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <Bouton
        variante="danger-discret"
        icone={<Ban size={16} aria-hidden />}
        onClick={() => setOuvert(true)}
      >
        Annuler le dossier
      </Bouton>
    );
  }

  return (
    <div className="lme-pile" style={{ marginTop: 12 }}>
      <Alerte ton="attention" titre="Décision définitive">
        <p>
          Le dossier <strong>{reference}</strong> passera en « Annulé ».
          {vehiculeAttribue ? " La moto réservée retournera au stock." : ""}
        </p>
        <p style={{ marginTop: 8 }}>
          Un contrat déjà scellé ne s’annule pas ici : il se résilie.
        </p>
      </Alerte>

      <Champ
        libelle="Pourquoi ce dossier est-il annulé ?"
        requis
        erreur={
          tentative && motifTropCourt
            ? `Précisez le motif (${MOTIF_MINIMUM} caractères minimum) : il est conservé comme trace.`
            : null
        }
      >
        <textarea
          id={`motif-annulation-${reservationId}`}
          rows={3}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Le client s’est désisté, il a trouvé un autre financement."
        />
      </Champ>

      <div className="lme-rangee">
        <Bouton variante="danger" onClick={annuler} chargement={enCours}>
          Annuler le dossier
        </Bouton>
        <Bouton
          variante="fantome"
          onClick={() => {
            setOuvert(false);
            setTentative(false);
          }}
          disabled={enCours}
        >
          Revenir
        </Bouton>
      </div>
    </div>
  );
}
