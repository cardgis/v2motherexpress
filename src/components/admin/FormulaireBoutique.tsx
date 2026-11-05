"use client";

/**
 * Création et modification d'une boutique.
 *
 * Chaque erreur s'affiche sous le champ concerné, qu'elle soit détectée dans
 * le navigateur ou renvoyée par le serveur (code déjà pris, téléphone
 * invalide) — jamais seulement en haut de page.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { Champ } from "@/components/ui/Champ";
import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";

export interface ValeursBoutique {
  nom: string;
  ville: string;
  code: string;
  adresse: string;
  telephone: string;
  representantNom: string;
  actif: boolean;
}

type CleTexte = Exclude<keyof ValeursBoutique, "actif">;

/** Ordre d'affichage, longueur minimale et message de chaque champ obligatoire. */
const CONTROLES: [CleTexte, number, string][] = [
  ["nom", 2, "Indiquez le nom de la boutique."],
  ["ville", 2, "Indiquez la ville."],
  ["code", 3, "Code : trois lettres, par exemple DKR."],
  ["telephone", 6, "Indiquez le téléphone de la boutique."],
  ["adresse", 5, "Indiquez l’adresse de la boutique."],
  ["representantNom", 3, "Indiquez le représentant qui signe les actes."],
];

const VIDE: ValeursBoutique = {
  nom: "",
  ville: "",
  code: "",
  adresse: "",
  telephone: "",
  representantNom: "",
  actif: true,
};

export default function FormulaireBoutique({
  boutiqueId,
  initial,
}: {
  /** Absent : création d'une boutique. */
  boutiqueId?: string;
  initial?: ValeursBoutique;
}) {
  const creation = !boutiqueId;
  const router = useRouter();

  const [valeurs, setValeurs] = useState<ValeursBoutique>(initial ?? VIDE);
  const [erreurs, setErreurs] = useState<Partial<Record<CleTexte, string>>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function modifier<C extends keyof ValeursBoutique>(cle: C, valeur: ValeursBoutique[C]) {
    setValeurs((v) => ({ ...v, [cle]: valeur }));
    setErreurs((e) => ({ ...e, [cle]: undefined }));
    setSucces(null);
  }

  function signaler(cle: CleTexte, message: string) {
    setErreurs({ [cle]: message });
    document.getElementById(`boutique-${cle}`)?.focus();
  }

  function controler(): boolean {
    const trouvees: Partial<Record<CleTexte, string>> = {};
    for (const [cle, minimum, message] of CONTROLES) {
      if (cle === "code" && !creation) continue;
      const texte = valeurs[cle].trim();
      const invalide = cle === "code" ? !/^[A-Z]{3}$/.test(texte) : texte.length < minimum;
      if (invalide) trouvees[cle] = message;
    }
    setErreurs(trouvees);
    const premiere = CONTROLES.find(([cle]) => trouvees[cle]);
    if (premiere) document.getElementById(`boutique-${premiere[0]}`)?.focus();
    return !premiere;
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!controler()) return;

    setEnCours(true);
    setErreur(null);
    setSucces(null);

    const { code, ...modifiables } = valeurs;

    try {
      const reponse = await fetch(creation ? "/api/admin/boutiques" : `/api/admin/boutiques/${boutiqueId}`, {
        method: creation ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creation ? { ...modifiables, code } : modifiables),
      });
      const donnees = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        const champ = CONTROLES.find(([cle]) => cle === donnees?.champ)?.[0];
        if (champ) signaler(champ, donnees.error);
        else setErreur(donnees?.error ?? "Enregistrement impossible.");
        return;
      }

      if (creation) {
        router.push(`/admin/boutiques/${donnees.id}`);
        return;
      }

      setSucces("Modifications enregistrées.");
      router.refresh();
    } catch {
      setErreur("Connexion perdue. Réessayez dans un instant.");
    } finally {
      setEnCours(false);
    }
  }

  const saisie = (cle: CleTexte) => ({
    id: `boutique-${cle}`,
    value: valeurs[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => modifier(cle, e.target.value),
  });

  return (
    <form onSubmit={enregistrer} className="lme-pile" noValidate>
      <div className="lme-grille-champs">
        <Champ
          libelle="Nom de la boutique"
          requis
          erreur={erreurs.nom}
          aide="Tel que les clients le voient, par exemple « La Mother Express Dakar »."
        >
          <input {...saisie("nom")} maxLength={60} autoComplete="organization" />
        </Champ>

        <Champ libelle="Ville" requis erreur={erreurs.ville} aide="Imprimée après « Fait à » sur les contrats.">
          <input {...saisie("ville")} maxLength={60} autoComplete="address-level2" />
        </Champ>

        <Champ
          libelle="Code"
          requis={creation}
          erreur={erreurs.code}
          aide={creation ? "Trois lettres, reprises dans les références : LME-2026-DKR-0001. Définitif." : undefined}
          verrou={creation ? undefined : "Figure dans les références déjà émises : il ne change plus."}
        >
          <input
            id="boutique-code"
            className="lme-mono"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="DKR"
            value={valeurs.code}
            // Filtrer AVANT de couper : un « D-K-R » collé donne DKR. Une limite
            // `maxLength` couperait d'abord et ne laisserait que « DK ».
            onChange={(e) => modifier("code", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
            disabled={!creation}
          />
        </Champ>

        <Champ libelle="Téléphone" requis erreur={erreurs.telephone}>
          <input {...saisie("telephone")} type="tel" inputMode="tel" maxLength={32} placeholder="33 800 00 00" autoComplete="tel" />
        </Champ>

        <Champ libelle="Adresse" requis erreur={erreurs.adresse} large>
          <input {...saisie("adresse")} maxLength={160} autoComplete="street-address" />
        </Champ>

        <Champ
          libelle="Représentant qui signe les actes"
          requis
          erreur={erreurs.representantNom}
          large
          aide="Imprimé au titre du Bailleur : NOM en capitales puis prénoms, par exemple « MENDY Lazare Evariste »."
        >
          <input {...saisie("representantNom")} maxLength={80} autoComplete="off" />
        </Champ>
      </div>

      {!creation ? (
        <label className="lme-case">
          <input type="checkbox" checked={valeurs.actif} onChange={(e) => modifier("actif", e.target.checked)} />
          <span>
            <strong>Boutique ouverte aux réservations</strong>
            <br />
            <span className="lme-texte-2 lme-petit">
              Décochée, elle disparaît du choix des clients. Les contrats en cours ne sont pas touchés.
            </span>
          </span>
        </label>
      ) : null}

      {erreur ? (
        <Alerte ton="erreur" vivante>
          {erreur}
        </Alerte>
      ) : null}
      {succes ? (
        <Alerte ton="succes" vivante>
          {succes}
        </Alerte>
      ) : null}

      <div className="lme-actions">
        <Bouton type="submit" className="lme-actions__principal" icone={<Store size={18} aria-hidden />} chargement={enCours}>
          {creation ? "Créer la boutique" : "Enregistrer les informations"}
        </Bouton>
      </div>
    </form>
  );
}
