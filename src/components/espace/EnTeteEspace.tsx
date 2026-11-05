"use client";

/**
 * En-tête des espaces client et gérant.
 *
 * Collant (`position: sticky`) : il reste dans le flux de la page et ne peut
 * donc jamais recouvrir le contenu — contrairement à l'en-tête transparent du
 * site vitrine, positionné en absolu par-dessus la page.
 *
 * Menu du compte : liste déroulante sur ordinateur, feuille sous l'en-tête
 * sur mobile. Motif « bouton + panneau » (aria-expanded) plutôt qu'un menu
 * ARIA complet : ce ne sont que des liens et un bouton, la navigation au
 * clavier naturelle (Tab) suffit.
 *
 * Conformément à CLAUDE.md : état React uniquement, aucun `<dialog>` natif.
 */

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown, House, LogOut, Phone, UserRound } from "lucide-react";
import { NAVIGATION, estActif, type Espace } from "./navigation";

export interface IdentiteAffichee {
  nom: string;
  detail: string;
  initiales: string | null;
}

export interface LienRaccourci {
  href: string;
  libelle: string;
}

const TELEPHONE_BOUTIQUE = "+221772320235";

export default function EnTeteEspace({
  espace,
  titreEspace,
  identite,
  pastilles = {},
  raccourcis = [],
}: {
  espace: Espace;
  titreEspace: string;
  identite: IdentiteAffichee;
  /** Compteurs affichés à côté d'un onglet, par adresse. */
  pastilles?: Record<string, number>;
  /** Passages vers un autre espace du même compte (administrateur ⇄ back-office). */
  raccourcis?: LienRaccourci[];
}) {
  const chemin = usePathname();
  const router = useRouter();

  const [ouvert, setOuvert] = useState(false);
  const [deconnexion, setDeconnexion] = useState(false);
  const [cheminAffiche, setCheminAffiche] = useState(chemin);

  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);

  // Le menu se referme à chaque changement de page, pendant le rendu plutôt
  // que dans un effet : il ne s'affiche jamais ouvert sur la nouvelle page.
  if (chemin !== cheminAffiche) {
    setCheminAffiche(chemin);
    setOuvert(false);
  }

  useEffect(() => {
    if (!ouvert) return;

    panneau.current?.querySelector<HTMLElement>("a, button")?.focus();

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [ouvert]);

  async function seDeconnecter() {
    setDeconnexion(true);
    await fetch("/api/auth/deconnexion", { method: "POST" }).catch(() => undefined);
    router.replace("/");
    router.refresh();
  }

  const liens = NAVIGATION[espace];
  const accueil = liens[0]!.href;

  return (
    <header className="lme-entete">
      <div className="lme-entete__interieur">
        <Link href={accueil} className="lme-marque">
          <Image
            src="/assets/img/logo-la-mother-express.svg"
            alt="La Mother Express"
            width={84}
            height={34}
            priority
            unoptimized
          />
          <span className="lme-marque__espace">{titreEspace}</span>
        </Link>

        <nav aria-label="Navigation principale" className="lme-nav-principale">
          <ul className="lme-nav">
            {liens.map((lien) => {
              const actif = estActif(lien, chemin);
              const compteur = pastilles[lien.href] ?? 0;
              return (
                <li key={lien.href}>
                  <Link href={lien.href} className="lme-nav__lien" aria-current={actif ? "page" : undefined}>
                    <lien.Icone size={18} aria-hidden />
                    {lien.libelle}
                    {compteur > 0 ? (
                      <span className="lme-pastille">
                        {compteur}
                        <span className="lme-sr"> en attente</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="lme-entete__droite">
          <Link href="/" className="lme-lien-site">
            <House size={16} aria-hidden />
            Voir le site
          </Link>

          <button
            ref={bouton}
            type="button"
            className="lme-compte"
            aria-expanded={ouvert}
            aria-controls="menu-compte"
            onClick={() => setOuvert((o) => !o)}
          >
            <span className="lme-avatar" aria-hidden>
              {identite.initiales ?? <UserRound size={18} />}
            </span>
            <span className="lme-compte__nom">{identite.nom}</span>
            <ChevronDown size={16} aria-hidden className="lme-compte__chevron" />
            <span className="lme-sr">Menu du compte</span>
          </button>

          {ouvert ? (
            <>
              <div className="lme-voile" aria-hidden onClick={() => setOuvert(false)} />
              <div id="menu-compte" ref={panneau} className="lme-menu">
                <div className="lme-menu__identite">
                  <p className="lme-menu__nom">{identite.nom}</p>
                  <p className="lme-menu__detail">{identite.detail}</p>
                </div>

                {raccourcis.map((r) => (
                  <Link key={r.href} href={r.href} className="lme-menu__element">
                    <ArrowLeftRight size={18} aria-hidden />
                    {r.libelle}
                  </Link>
                ))}
                <Link href="/" className="lme-menu__element">
                  <House size={18} aria-hidden />
                  Voir le site La Mother Express
                </Link>
                <a href={`tel:${TELEPHONE_BOUTIQUE}`} className="lme-menu__element">
                  <Phone size={18} aria-hidden />
                  Appeler la boutique
                </a>

                <div className="lme-menu__separateur" role="separator" />

                <button
                  type="button"
                  className="lme-menu__element lme-menu__element--danger"
                  onClick={seDeconnecter}
                  disabled={deconnexion}
                >
                  <LogOut size={18} aria-hidden />
                  {deconnexion ? "Déconnexion…" : "Se déconnecter"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
