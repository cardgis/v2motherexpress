"use client";

/**
 * Tire l'attestation d'un versement, puis l'ouvre pour impression ou envoi.
 *
 * Aucun champ n'est saisi ici : le reçu reprend le versement tel qu'il a été
 * enregistré. Déjà tirée, l'attestation se rouvre simplement — c'est ce qui
 * permet de la redonner à un client qui a perdu la sienne.
 */

import { useState } from "react";
import { FileText } from "lucide-react";
import { Bouton } from "@/components/ui/Bouton";

export default function BoutonAttestation({
  encaissementId,
  dejaTiree = false,
  taille = "sm",
  onErreur,
}: {
  encaissementId: string;
  dejaTiree?: boolean;
  taille?: "sm" | "md" | "lg";
  /** Remonte le message au parent, qui l'affiche dans son alerte. */
  onErreur?: (message: string | null) => void;
}) {
  const [enCours, setEnCours] = useState(false);

  // Produire et relire sont deux gestes distincts : le premier n'appartient
  // qu'au gérant, le second aussi au client, qui a son reçu dans son espace.
  const production = `/api/gerant/versements/${encaissementId}/attestation`;
  const lecture = `/api/actes/attestation/${encaissementId}`;

  async function tirer() {
    // Déjà produite : inutile de la recomposer, on la rouvre telle quelle.
    if (dejaTiree) {
      window.open(lecture, "_blank", "noopener");
      return;
    }

    setEnCours(true);
    onErreur?.(null);

    try {
      const reponse = await fetch(production, { method: "POST" });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Attestation impossible.");

      window.open(lecture, "_blank", "noopener");
    } catch (err) {
      onErreur?.(err instanceof Error ? err.message : "Attestation impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Bouton
      variante="secondaire"
      taille={taille}
      icone={<FileText size={16} aria-hidden />}
      chargement={enCours}
      onClick={tirer}
    >
      {dejaTiree ? "Revoir l’attestation" : "Attestation de versement"}
    </Bouton>
  );
}
