"use client";

import { Printer } from "lucide-react";
import { Bouton } from "@/components/ui/Bouton";

/** Impression pour les réunions : l'en-tête, les filtres et les boutons sont masqués (voir admin.css). */
export default function BoutonImprimer() {
  return (
    <Bouton variante="secondaire" icone={<Printer size={18} aria-hidden />} onClick={() => window.print()}>
      Imprimer
    </Bouton>
  );
}
