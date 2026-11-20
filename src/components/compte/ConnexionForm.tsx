"use client";

/**
 * Connexion en deux étapes : identifiant → code à usage unique.
 *
 * UNE SEULE FAÇON DE SE CONNECTER : le téléphone, sénégalais ou étranger,
 * avec un code par SMS. L'onglet e-mail a été retiré le 2026-11-19 — laisser
 * le choix, c'est le proposer : un client tenté par l'e-mail devient un
 * client qu'on ne joint pas au retrait, alors qu'un numéro est direct.
 *
 * L'API, elle, accepte toujours un e-mail comme identifiant, et
 * `lib/dossier.ts` exige de toute façon un téléphone joignable dans le
 * dossier de quiconque se serait connecté autrement. Le jour où le canal
 * e-mail sera ouvert — il est fermé, `EMAIL_DRIVER` vaut `console` —,
 * rouvrir une porte ici sera une ligne.
 *
 * Contraintes de terrain (mobile, 3G/4G instable) :
 *   — clavier numérique ;
 *   — `autoComplete="one-time-code"` pour que le téléphone propose le code ;
 *   — la saisie survit au retour arrière, on ne la retape jamais ;
 *   — messages d'erreur explicites, sous le champ concerné ;
 *   — bouton de renvoi temporisé, pour ne pas brûler le quota de codes.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";

const SECONDES_AVANT_RENVOI = 45;

type Etape = "identifiant" | "code";

export default function ConnexionForm({ suite = null }: { suite?: string | null }) {
  const router = useRouter();

  const [etape, setEtape] = useState<Etape>("identifiant");
  const [telephone, setTelephone] = useState("");
  const [destinataireMasque, setDestinataireMasque] = useState("");
  const [code, setCode] = useState("");
  /** Renseigné uniquement en développement, quand aucun message n'est envoyé. */
  const [codeDev, setCodeDev] = useState<string | null>(null);

  const [chargement, setChargement] = useState(false);
  /** Erreur liée à la saisie : affichée en rouge sous le champ. */
  const [erreurChamp, setErreurChamp] = useState<string | null>(null);
  /** Erreur de service (quota, réseau) : affichée en bandeau. */
  const [erreur, setErreur] = useState<string | null>(null);
  const [compteARebours, setCompteARebours] = useState(0);

  const champCode = useRef<HTMLInputElement>(null);

  const identifiant = telephone;
  const saisieExploitable = telephone.replace(/\D/g, "").length >= 8;

  // Décompte avant que le renvoi ne redevienne possible
  useEffect(() => {
    if (compteARebours <= 0) return;
    const t = setTimeout(() => setCompteARebours((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [compteARebours]);

  // À l'arrivée sur l'étape du code, le focus part directement dans le champ
  useEffect(() => {
    if (etape === "code") champCode.current?.focus();
  }, [etape]);

  function effacerErreurs() {
    setErreur(null);
    setErreurChamp(null);
  }

  async function demanderCode(e?: React.FormEvent) {
    e?.preventDefault();
    setChargement(true);
    effacerErreurs();

    try {
      const reponse = await fetch("/api/auth/otp/demander", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiant }),
      });
      const donnees = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        const message = donnees?.error ?? "Envoi impossible.";
        // 400 et 422 : la saisie elle-même est en cause ; le reste relève du service.
        if ((reponse.status === 400 || reponse.status === 422) && etape === "identifiant") setErreurChamp(message);
        else setErreur(message);
        return;
      }

      setDestinataireMasque(donnees.destinataireMasque);
      setCodeDev(donnees.codeDeDeveloppement ?? null);
      setCode("");
      setEtape("code");
      setCompteARebours(SECONDES_AVANT_RENVOI);
    } catch {
      setErreur("Connexion perdue. Vérifiez votre réseau et réessayez.");
    } finally {
      setChargement(false);
    }
  }

  async function verifierCode(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);
    effacerErreurs();

    try {
      const reponse = await fetch("/api/auth/otp/verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiant, code }),
      });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) throw new Error(donnees?.error ?? "Code refusé.");

      // `refresh` purge le cache de route pour que les pages serveur
      // relisent la session fraîchement posée.
      // Un client revient sur la page qu'il visait (déjà validée par la page
      // serveur) ; un gérant va toujours à son back-office.
      router.replace(donnees.role === "CLIENT" && suite ? suite : donnees.destination);
      router.refresh();
    } catch (err) {
      setErreurChamp(err instanceof Error ? err.message : "Code refusé.");
      setCode("");
      champCode.current?.focus();
      setChargement(false);
    }
  }

  return (
    <div className="lme-page" style={{ width: "100%", maxWidth: 460, margin: "0 auto" }}>
      <div className="lme-carte" style={{ padding: "28px 24px" }}>
        <p className="lme-surtitre">Espace client</p>
        <h1 className="lme-titre-page">{etape === "identifiant" ? "Connexion" : "Code de vérification"}</h1>
        <p className="lme-description">
          {etape === "identifiant" ? (
            "Recevez un code à 6 chiffres, sans mot de passe."
          ) : (
            <>
              Code envoyé à <strong>{destinataireMasque}</strong>.
            </>
          )}
        </p>

        {etape === "identifiant" ? (
          <form onSubmit={demanderCode} className="lme-pile" style={{ marginTop: 22 }} noValidate>
            <Champ
              libelle="Numéro de mobile"
              requis
              erreur={erreurChamp}
              aide="Un numéro sénégalais : 77 123 45 67. Nos codes ne partent que vers le Sénégal."
            >
              <input
                id="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                maxLength={32}
                placeholder="77 123 45 67"
                value={telephone}
                onChange={(e) => {
                  setTelephone(e.target.value);
                  setErreurChamp(null);
                }}
              />
            </Champ>

            {erreur ? (
              <Alerte ton="erreur" vivante>
                {erreur}
              </Alerte>
            ) : null}

            <Bouton type="submit" taille="lg" bloc chargement={chargement} disabled={!saisieExploitable}>
              Recevoir mon code
            </Bouton>
          </form>
        ) : (
          <form onSubmit={verifierCode} className="lme-pile" style={{ marginTop: 22 }} noValidate>
            {codeDev ? (
              <Alerte ton="attention" titre="Mode développement — aucun message envoyé">
                Code : <strong style={{ letterSpacing: 2 }}>{codeDev}</strong>
              </Alerte>
            ) : null}

            <Champ libelle="Code à 6 chiffres" requis erreur={erreurChamp}>
              <input
                id="code"
                ref={champCode}
                className="lme-saisie--code"
                type="text"
                inputMode="numeric"
                // Permet au téléphone de proposer le code dès sa réception
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setErreurChamp(null);
                }}
              />
            </Champ>

            {erreur ? (
              <Alerte ton="erreur" vivante>
                {erreur}
              </Alerte>
            ) : null}

            <Bouton type="submit" taille="lg" bloc chargement={chargement} disabled={code.length !== 6}>
              Me connecter
            </Bouton>

            <div className="lme-rangee lme-rangee--entre">
              <Bouton
                variante="fantome"
                taille="sm"
                icone={<ArrowLeft size={16} aria-hidden />}
                onClick={() => {
                  setEtape("identifiant");
                  effacerErreurs();
                }}
              >
                Changer de numéro
              </Bouton>
              <Bouton
                variante="fantome"
                taille="sm"
                icone={<RefreshCw size={16} aria-hidden />}
                onClick={() => demanderCode()}
                disabled={compteARebours > 0 || chargement}
              >
                {compteARebours > 0 ? `Renvoyer (${compteARebours} s)` : "Renvoyer le code"}
              </Bouton>
            </div>
          </form>
        )}
      </div>

      <p className="lme-tres-petit lme-texte-3" style={{ marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
        En vous connectant, vous acceptez que La Mother Express traite vos données pour la gestion de votre location.
        Vos pièces d’identité sont conservées de manière strictement confidentielle et supprimées à la clôture de
        votre dossier.
      </p>
    </div>
  );
}

