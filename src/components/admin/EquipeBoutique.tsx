"use client";

/**
 * Équipe d'une boutique : gérants et commerciaux.
 *
 * Aucun mot de passe à créer ni à transmettre : la personne se connecte avec
 * le mobile ou l'e-mail saisi ici, par un code à usage unique. Retirer
 * quelqu'un ferme ses accès sur-le-champ, sur tous ses appareils.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, UserMinus, UserPlus } from "lucide-react";
import { LIBELLES_ROLE, ROLES_EQUIPE, type RoleEquipe } from "@/lib/roles";
import { Champ } from "@/components/ui/Champ";
import { GroupeChoix, Segment } from "@/components/ui/Choix";
import { Alerte } from "@/components/ui/Alerte";
import { Badge } from "@/components/ui/Badge";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";

export interface MembreVu {
  id: string;
  role: RoleEquipe;
  nom: string;
  /** Mobile formaté ou e-mail, pour l'affichage. */
  identifiant: string;
  /** Tel qu'enregistré, renvoyé au serveur pour changer le rôle. */
  identifiantBrut: string;
  derniereConnexion: string | null;
}

const MISSIONS: Record<RoleEquipe, string> = {
  GERANT: "Valide les dossiers, établit et signe les contrats, remet les motos.",
  COMMERCIAL: "Consulte les dossiers, les contrats et la flotte de la boutique, sans rien modifier.",
};

type Resultat = { ok: true } | { ok: false; erreur: string; champ?: string };

async function appeler(url: string, methode: "POST" | "DELETE", corps?: unknown): Promise<Resultat> {
  try {
    const reponse = await fetch(url, {
      method: methode,
      headers: corps ? { "Content-Type": "application/json" } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
    });
    if (reponse.ok) return { ok: true };
    const donnees = await reponse.json().catch(() => null);
    return { ok: false, erreur: donnees?.error ?? "Opération impossible.", champ: donnees?.champ };
  } catch {
    return { ok: false, erreur: "Connexion perdue. Réessayez dans un instant." };
  }
}

export default function EquipeBoutique({ boutiqueId, equipe }: { boutiqueId: string; equipe: MembreVu[] }) {
  const router = useRouter();

  const [identifiant, setIdentifiant] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<RoleEquipe>("GERANT");
  const [erreurs, setErreurs] = useState<{ identifiant?: string; nom?: string }>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  /** « ajout », ou l'identifiant du membre en cours de modification. */
  const [enCours, setEnCours] = useState<string | null>(null);
  const [aRetirer, setARetirer] = useState<string | null>(null);

  const sansGerant = !equipe.some((m) => m.role === "GERANT");

  function commencer(cle: string) {
    setEnCours(cle);
    setErreur(null);
    setConfirmation(null);
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();

    const trouvees = {
      identifiant: identifiant.trim().length < 3 ? "Indiquez le numéro de mobile ou l’e-mail." : undefined,
      nom: nom.trim().length < 3 ? "Indiquez le nom tel qu’il s’affichera." : undefined,
    };
    setErreurs(trouvees);
    if (trouvees.identifiant || trouvees.nom) {
      document.getElementById(trouvees.identifiant ? "membre-identifiant" : "membre-nom")?.focus();
      return;
    }

    commencer("ajout");
    const r = await appeler(`/api/admin/boutiques/${boutiqueId}/equipe`, "POST", { identifiant, nom, role });
    setEnCours(null);

    if (!r.ok) {
      if (r.champ === "identifiant" || r.champ === "nom") {
        setErreurs({ [r.champ]: r.erreur });
        document.getElementById(`membre-${r.champ}`)?.focus();
      } else {
        setErreur(r.erreur);
      }
      return;
    }

    setConfirmation(
      `${nom.trim()} rejoint l’équipe comme ${LIBELLES_ROLE[role].toLowerCase()}. Il se connecte avec cet identifiant, par code.`,
    );
    setIdentifiant("");
    setNom("");
    router.refresh();
  }

  async function changerRole(membre: MembreVu) {
    const nouveau: RoleEquipe = membre.role === "GERANT" ? "COMMERCIAL" : "GERANT";
    commencer(membre.id);
    const r = await appeler(`/api/admin/boutiques/${boutiqueId}/equipe`, "POST", {
      identifiant: membre.identifiantBrut,
      nom: membre.nom,
      role: nouveau,
    });
    setEnCours(null);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setConfirmation(`${membre.nom} est maintenant ${LIBELLES_ROLE[nouveau].toLowerCase()}.`);
    router.refresh();
  }

  async function retirer(membre: MembreVu) {
    commencer(membre.id);
    const r = await appeler(`/api/admin/equipe/${membre.id}`, "DELETE");
    setEnCours(null);
    setARetirer(null);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setConfirmation(`${membre.nom} ne fait plus partie de l’équipe : ses accès au back-office sont fermés.`);
    router.refresh();
  }

  return (
    <div className="lme-pile">
      {sansGerant ? (
        <Alerte ton="attention" titre="Aucun gérant dans cette boutique">
          Personne ne peut y valider les dossiers, signer les contrats ni remettre les motos.
        </Alerte>
      ) : null}
      {confirmation ? (
        <Alerte ton="succes" vivante>
          {confirmation}
        </Alerte>
      ) : null}
      {erreur ? (
        <Alerte ton="erreur" vivante>
          {erreur}
        </Alerte>
      ) : null}

      {equipe.length === 0 ? (
        <EtatVide titre="Personne dans l’équipe">Ajoutez le gérant de la boutique ci-dessous.</EtatVide>
      ) : (
        <ul className="lme-liste">
          {equipe.map((m) => (
            <li key={m.id} className="lme-ligne">
              <div className="lme-ligne__principal">
                <p className="lme-ligne__titre">
                  {m.nom}
                  <Badge>{LIBELLES_ROLE[m.role]}</Badge>
                </p>
                <p className="lme-ligne__meta">
                  {m.identifiant} ·{" "}
                  {m.derniereConnexion ? `dernière connexion le ${m.derniereConnexion}` : "jamais connecté"}
                </p>
              </div>

              <div className="lme-ligne__fin">
                {aRetirer === m.id ? (
                  <>
                    <Bouton
                      variante="danger"
                      taille="sm"
                      icone={<UserMinus size={16} aria-hidden />}
                      onClick={() => retirer(m)}
                      chargement={enCours === m.id}
                    >
                      Confirmer le retrait
                    </Bouton>
                    <Bouton variante="fantome" taille="sm" onClick={() => setARetirer(null)} disabled={enCours !== null}>
                      Garder
                    </Bouton>
                  </>
                ) : (
                  <>
                    <Bouton
                      variante="secondaire"
                      taille="sm"
                      icone={<Repeat size={16} aria-hidden />}
                      onClick={() => changerRole(m)}
                      chargement={enCours === m.id}
                      disabled={enCours !== null}
                    >
                      {m.role === "GERANT" ? "Passer commercial" : "Passer gérant"}
                    </Bouton>
                    <Bouton
                      variante="danger-discret"
                      taille="sm"
                      icone={<UserMinus size={16} aria-hidden />}
                      onClick={() => setARetirer(m.id)}
                      disabled={enCours !== null}
                    >
                      Retirer
                    </Bouton>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={ajouter} className="lme-encart lme-pile" noValidate>
        <h3 className="lme-sous-titre">Ajouter une personne</h3>

        <div className="lme-grille-champs">
          <Champ
            libelle="Mobile ou e-mail"
            requis
            erreur={erreurs.identifiant}
            aide="Celui avec lequel elle se connectera. Aucun mot de passe : un code lui est envoyé."
          >
            <input
              id="membre-identifiant"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="77 123 45 67"
              value={identifiant}
              onChange={(e) => {
                setIdentifiant(e.target.value);
                setErreurs((x) => ({ ...x, identifiant: undefined }));
              }}
            />
          </Champ>

          <Champ libelle="Nom affiché" requis erreur={erreurs.nom}>
            <input
              id="membre-nom"
              autoComplete="off"
              maxLength={80}
              placeholder="Prénom NOM"
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                setErreurs((x) => ({ ...x, nom: undefined }));
              }}
            />
          </Champ>
        </div>

        <GroupeChoix legende="Rôle" requis disposition="segments">
          {ROLES_EQUIPE.map((r) => (
            <Segment key={r} nom="membre-role" valeur={r} coche={role === r} onChoisir={setRole}>
              {LIBELLES_ROLE[r]}
            </Segment>
          ))}
        </GroupeChoix>
        <p className="lme-aide">{MISSIONS[role]}</p>

        <div className="lme-actions">
          <Bouton
            type="submit"
            className="lme-actions__principal"
            icone={<UserPlus size={18} aria-hidden />}
            chargement={enCours === "ajout"}
            disabled={enCours !== null && enCours !== "ajout"}
          >
            Ajouter à l’équipe
          </Bouton>
        </div>
      </form>
    </div>
  );
}
