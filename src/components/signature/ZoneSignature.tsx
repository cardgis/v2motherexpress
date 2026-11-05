"use client";

/**
 * Zone de signature tactile.
 *
 * Écrite à la main plutôt qu'empruntée à une bibliothèque : le tracé est une
 * pièce du faisceau de preuves d'un acte juridique, on ne le fait pas reposer
 * sur une dépendance en version alpha.
 *
 * Points de conception :
 *   — événements « pointer », qui couvrent doigt, stylet et souris d'un coup ;
 *   — la résolution du canevas suit celle de l'écran (`devicePixelRatio`), sans
 *     quoi le tracé sort crénelé sur mobile, donc illisible une fois incrusté ;
 *   — fond TRANSPARENT : la signature se pose sur le PDF sans masquer la ligne
 *     pointillée imprimée dessous ;
 *   — le défilement de la page est neutralisé pendant le tracé, sinon signer
 *     sur un téléphone fait défiler le document ;
 *   — cadre en pointillés tant que rien n'est tracé, trait plein vert ensuite.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, PenLine, Undo2 } from "lucide-react";
import { Bouton } from "@/components/ui/Bouton";

/** En deçà, on considère que le client a effleuré l'écran par accident. */
const POINTS_MINIMUM = 12;

export default function ZoneSignature({
  onChangement,
  hauteur = 180,
  desactive = false,
}: {
  /** Prévient le parent que le tracé est devenu exploitable, ou vide. */
  onChangement?: (rempli: boolean) => void;
  hauteur?: number;
  desactive?: boolean;
}) {
  const canevas = useRef<HTMLCanvasElement>(null);
  const contexte = useRef<CanvasRenderingContext2D | null>(null);
  const trace = useRef(false);
  const points = useRef(0);

  const [rempli, setRempli] = useState(false);

  /** Ajuste la résolution interne à celle de l'écran. */
  const dimensionner = useCallback(() => {
    const c = canevas.current;
    if (!c) return;

    const ratio = window.devicePixelRatio || 1;
    const cadre = c.getBoundingClientRect();

    // Redimensionner un canevas efface son contenu : on le sauvegarde d'abord.
    const ancien = points.current > 0 ? c.toDataURL("image/png") : null;

    c.width = Math.round(cadre.width * ratio);
    c.height = Math.round(cadre.height * ratio);

    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    contexte.current = ctx;

    if (ancien) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, cadre.width, cadre.height);
      image.src = ancien;
    }
  }, []);

  useEffect(() => {
    dimensionner();
    window.addEventListener("resize", dimensionner);
    return () => window.removeEventListener("resize", dimensionner);
  }, [dimensionner]);

  function positionner(e: React.PointerEvent<HTMLCanvasElement>) {
    const cadre = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - cadre.left, y: e.clientY - cadre.top };
  }

  function commencer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (desactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const ctx = contexte.current;
    if (!ctx) return;

    const { x, y } = positionner(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    trace.current = true;
  }

  function continuer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!trace.current || desactive) return;

    const ctx = contexte.current;
    if (!ctx) return;

    const { x, y } = positionner(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    points.current += 1;
    if (!rempli && points.current >= POINTS_MINIMUM) {
      setRempli(true);
      onChangement?.(true);
    }
  }

  function terminer() {
    if (!trace.current) return;
    trace.current = false;

    // Le parent est prévenu à CHAQUE trait achevé, et non au seul passage de
    // « vide » à « rempli ». Sans cela, un parent qui relit le canevas sur
    // cet appel ne garderait que les premiers points du geste : le PDF
    // portait alors deux traits à la place de la signature.
    onChangement?.(points.current >= POINTS_MINIMUM);
  }

  function effacer() {
    const c = canevas.current;
    const ctx = contexte.current;
    if (!c || !ctx) return;

    ctx.clearRect(0, 0, c.width, c.height);
    points.current = 0;
    setRempli(false);
    onChangement?.(false);
  }

  return (
    <div
      className="lme-zone-signature"
      data-rempli={rempli ? "" : undefined}
      data-desactive={desactive ? "" : undefined}
    >
      <div style={{ position: "relative" }}>
        <canvas
          ref={canevas}
          onPointerDown={commencer}
          onPointerMove={continuer}
          onPointerUp={terminer}
          onPointerLeave={terminer}
          onPointerCancel={terminer}
          data-zone-signature
          role="img"
          aria-label="Zone de signature : tracez votre signature au doigt, au stylet ou à la souris"
          style={{ height: hauteur }}
        />

        {!rempli ? (
          <div className="lme-zone-signature__invite" aria-hidden>
            <PenLine size={18} />
            Signez ici avec votre doigt
          </div>
        ) : null}
      </div>

      <div className="lme-rangee lme-rangee--entre" style={{ marginTop: 8 }}>
        {rempli ? (
          <p className="lme-message lme-message--succes">
            <Check size={16} aria-hidden />
            Signature tracée
          </p>
        ) : (
          <p className="lme-aide">Aucune signature</p>
        )}
        <Bouton
          variante="fantome"
          taille="sm"
          icone={<Undo2 size={16} aria-hidden />}
          onClick={effacer}
          disabled={!rempli || desactive}
        >
          Effacer
        </Bouton>
      </div>
    </div>
  );
}

/**
 * Récupère le tracé du canevas rendu par ce composant.
 *
 * Passer par le DOM plutôt que par une référence évite d'imposer au parent la
 * mécanique de `forwardRef` pour un besoin aussi ponctuel.
 */
export function lireTrace(): string | null {
  const canevas = document.querySelector<HTMLCanvasElement>("[data-zone-signature]");
  return canevas ? canevas.toDataURL("image/png") : null;
}
