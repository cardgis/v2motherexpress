"use client";

/**
 * Actions du gérant sur un contrat, selon l'étape où il se trouve.
 *
 *   BROUILLON           ambre — relecture par le gérant seul, puis transmission
 *   A_SIGNER_CLIENT     bleu  — le client peut lire et signer ; lien disponible
 *   A_SIGNER_GERANT     ambre — contre-signature, qui déclenche le scellement
 *   EN_ATTENTE_RETRAIT  vert  — acte scellé, accès direct à l'écran de retrait
 *   RETIRE              vert  — véhicule remis
 *   CADUC               rouge — pièce non conforme au retrait
 *
 * Le lien de signature n'est affiché qu'une seule fois : la base n'en conserve
 * que le condensat, il est donc impossible de le réafficher ensuite.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageCircle, PenLine, RefreshCw, ScanLine, Send } from "lucide-react";
import ZoneSignature, { lireTrace } from "@/components/signature/ZoneSignature";
import { cheminRetrait, type BaseBackOffice } from "./espace-backoffice";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton, LienBouton } from "@/components/ui/Bouton";

export default function ContratActions({
  contratId,
  reservationId,
  statut,
  base,
}: {
  contratId: string;
  reservationId: string;
  statut: string;
  /** Espace d'où l'écran est ouvert : les liens y restent. */
  base: BaseBackOffice;
}) {
  const router = useRouter();

  const [lien, setLien] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [padOuvert, setPadOuvert] = useState(false);
  const [signatureFaite, setSignatureFaite] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function appeler(action: "transmettre" | "lien" | "contresigner", corps: Record<string, unknown> = {}) {
    setEnCours(true);
    setErreur(null);

    try {
      const reponse = await fetch(`/api/contrats/${contratId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...corps }),
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

  async function transmettre() {
    const donnees = await appeler("transmettre");
    if (donnees?.lien) {
      setLien(donnees.lien);
      router.refresh();
    }
  }

  async function genererLien() {
    const donnees = await appeler("lien");
    if (donnees?.lien) setLien(donnees.lien);
  }

  async function contresigner() {
    const trace = lireTrace();
    if (!trace) {
      setErreur("Signez dans le cadre avant de valider.");
      return;
    }

    const donnees = await appeler("contresigner", { trace });
    if (donnees) {
      setPadOuvert(false);
      router.refresh();
    }
  }

  async function copier() {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      // Presse-papiers refusé : le lien reste sélectionnable à la main.
      setErreur("Copie impossible — sélectionnez le lien manuellement.");
    }
  }

  const blocLien = (titre: string, texte: string) =>
    lien ? (
      <Alerte
        ton="succes"
        titre={titre}
        vivante
        actions={
          <>
            <Bouton
              variante="secondaire"
              taille="sm"
              icone={copie ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              onClick={copier}
            >
              {copie ? "Lien copié" : "Copier le lien"}
            </Bouton>
            <LienBouton
              href={`https://wa.me/?text=${encodeURIComponent(
                `Bonjour, voici le lien pour signer votre contrat La Mother Express : ${lien}`,
              )}`}
              nouvelOnglet
              variante="secondaire"
              taille="sm"
              icone={<MessageCircle size={16} aria-hidden />}
            >
              Envoyer par WhatsApp
            </LienBouton>
          </>
        }
      >
        <p>{texte}</p>
        <p className="lme-lien-copie lme-mono" style={{ marginTop: 10, color: "var(--lme-texte)" }}>
          {lien}
        </p>
      </Alerte>
    ) : null;

  return (
    <div className="lme-pile lme-pile--serree">
      {erreur ? (
        <Alerte ton="erreur" vivante>
          {erreur}
        </Alerte>
      ) : null}

      {statut === "BROUILLON"
        ? lien
          ? blocLien(
              "Contrat transmis au client",
              "Il apparaît dans son espace, où il peut le signer. Ce lien lui permet de signer sans se connecter. Valable 72 h, il ne sera plus affiché après cette page.",
            )
          : (
            <Alerte
              ton="attention"
              titre="Brouillon — le client ne le voit pas encore"
              actions={
                <Bouton icone={<Send size={16} aria-hidden />} onClick={transmettre} chargement={enCours}>
                  Transmettre au client
                </Bouton>
              }
            >
              Relisez l’acte. Si la date, le modèle ou la moto doivent changer, corrigez-les et régénérez : le client
              ne verra que la version que vous transmettez.
            </Alerte>
          )
        : null}

      {statut === "A_SIGNER_CLIENT"
        ? lien
          ? blocLien(
              "Nouveau lien de signature — valable 72 heures",
              "Envoyez-le au client. Il ne sera plus affiché après cette page : seule son empreinte est conservée.",
            )
          : (
            <Alerte
              ton="info"
              titre="Transmis — en attente de la signature du client"
              actions={
                <Bouton
                  variante="secondaire"
                  taille="sm"
                  icone={<RefreshCw size={16} aria-hidden />}
                  onClick={genererLien}
                  chargement={enCours}
                >
                  Créer un nouveau lien
                </Bouton>
              }
            >
              Le contrat est dans son espace personnel : il peut le signer de lui-même. Si son lien a expiré, créez-en
              un nouveau.
            </Alerte>
          )
        : null}

      {statut === "A_SIGNER_GERANT" ? (
        padOuvert ? (
          <div className="lme-encart lme-pile lme-pile--serree">
            <p className="lme-sous-titre">Votre contre-signature</p>
            <p className="lme-aide">
              Elle scelle définitivement le contrat. Le client pourra ensuite retirer sa moto, muni de l’original de
              sa pièce.
            </p>
            <ZoneSignature onChangement={setSignatureFaite} desactive={enCours} />
            <div className="lme-rangee">
              <Bouton
                variante="succes"
                icone={<PenLine size={18} aria-hidden />}
                onClick={contresigner}
                chargement={enCours}
                disabled={!signatureFaite}
              >
                Contresigner et sceller
              </Bouton>
              <Bouton variante="fantome" onClick={() => setPadOuvert(false)} disabled={enCours}>
                Annuler
              </Bouton>
            </div>
          </div>
        ) : (
          <Alerte
            ton="attention"
            titre="Le client a signé — à vous de contresigner"
            actions={
              <Bouton icone={<PenLine size={16} aria-hidden />} onClick={() => setPadOuvert(true)}>
                Contresigner
              </Bouton>
            }
          >
            Il ne manque que votre contre-signature pour sceller le contrat.
          </Alerte>
        )
      ) : null}

      {statut === "EN_ATTENTE_RETRAIT" || statut === "SIGNE" ? (
        <Alerte
          ton="succes"
          titre="Contrat signé et scellé"
          actions={
            <LienBouton href={cheminRetrait(base, reservationId)} icone={<ScanLine size={16} aria-hidden />}>
              Démarrer le retrait
            </LienBouton>
          }
        >
          En attente du client en boutique. Vérifiez l’original de sa pièce avant de remettre le véhicule.
        </Alerte>
      ) : null}

      {statut === "RETIRE" ? (
        <Alerte
          ton="succes"
          titre="Véhicule remis"
          actions={
            <LienBouton href={cheminRetrait(base, reservationId)} variante="secondaire" taille="sm">
              Voir le retrait
            </LienBouton>
          }
        >
          Le constat de remise a été établi et signé par les deux parties.
        </Alerte>
      ) : null}

      {statut === "CADUC" ? (
        <Alerte ton="erreur" titre="Contrat caduc">
          La pièce présentée au retrait n’était pas conforme. Le véhicule a été remis au stock.
        </Alerte>
      ) : null}
    </div>
  );
}
