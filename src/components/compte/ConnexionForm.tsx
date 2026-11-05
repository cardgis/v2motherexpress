"use client";

/**
 * Connexion en deux étapes : identifiant → code à usage unique.
 *
 * Deux façons de se connecter :
 *   — par téléphone, sénégalais ou étranger (code par SMS) ;
 *   — par e-mail, pour les visiteurs de passage au Sénégal sans numéro local
 *     joignable (code par e-mail).
 *
 * Contraintes de terrain (mobile, 3G/4G instable) :
 *   — clavier adapté à chaque mode (numérique, ou e-mail avec « @ ») ;
 *   — `autoComplete="one-time-code"` pour que le téléphone propose le code ;
 *   — la saisie survit au retour arrière, on ne la retape jamais ;
 *   — messages d'erreur explicites, sous le champ concerné ;
 *   — bouton de renvoi temporisé, pour ne pas brûler le quota de codes.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AtSign, RefreshCw, Smartphone } from "lucide-react";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";

const SECONDES_AVANT_RENVOI = 45;

type Etape = "identifiant" | "code";
type Mode = "telephone" | "email";

export default function ConnexionForm({ suite = null }: { suite?: string | null }) {
  const router = useRouter();

  const [etape, setEtape] = useState<Etape>("identifiant");
  const [mode, setMode] = useState<Mode>("telephone");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
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

  const identifiant = mode === "telephone" ? telephone : email;
  const saisieExploitable =
    mode === "telephone"
      ? telephone.replace(/\D/g, "").length >= 8
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
              Code envoyé à <strong>{destinataireMasque}</strong>
              {mode === "email" ? ". Pensez à vérifier vos courriers indésirables." : "."}
            </>
          )}
        </p>

        {etape === "identifiant" ? (
          <form onSubmit={demanderCode} className="lme-pile" style={{ marginTop: 22 }} noValidate>
            <div role="tablist" aria-label="Mode de connexion" className="lme-onglets">
              <Onglet actif={mode === "telephone"} id="onglet-telephone" onClick={() => { setMode("telephone"); effacerErreurs(); }}>
                <Smartphone size={16} aria-hidden />
                Téléphone
              </Onglet>
              <Onglet actif={mode === "email"} id="onglet-email" onClick={() => { setMode("email"); effacerErreurs(); }}>
                <AtSign size={16} aria-hidden />
                E-mail
              </Onglet>
            </div>

            <div role="tabpanel" id="panneau-connexion" aria-labelledby={`onglet-${mode}`}>
              {mode === "telephone" ? (
                <Champ
                  libelle="Numéro de mobile"
                  requis
                  erreur={erreurChamp}
                  aide="Numéro sénégalais : 77 123 45 67. Numéro étranger : avec l’indicatif, par exemple +33 6 12 34 56 78."
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
              ) : (
                <Champ
                  libelle="Adresse e-mail"
                  requis
                  erreur={erreurChamp}
                  aide="Pratique si vous séjournez au Sénégal sans numéro local. / Handy if you are visiting Senegal without a local number."
                >
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    maxLength={254}
                    placeholder="prenom.nom@exemple.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErreurChamp(null);
                    }}
                  />
                </Champ>
              )}
            </div>

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
                {mode === "telephone" ? "Changer de numéro" : "Changer d’adresse"}
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

function Onglet({
  actif,
  id,
  onClick,
  children,
}: {
  actif: boolean;
  id: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={actif}
      aria-controls="panneau-connexion"
      tabIndex={actif ? 0 : -1}
      className="lme-onglet"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
