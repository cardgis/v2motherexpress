import Link from "next/link";
import { LIEN_RESERVER } from "@/lib/suite";
import { quantite } from "@/lib/formatters";
import "@/styles/appel.css";

/**
 * Appel final, juste avant le pied de page.
 *
 * ── Un bandeau DORÉ, à son extrême ────────────────────────────────────────
 * Partout ailleurs le doré est réservé à l'action principale, et sur fond
 * clair il passe en ocre pour tenir le contraste. Ici il devient le FOND :
 * c'est la dernière chose qu'on voit, et c'est l'action principale de toute
 * la page. Le code couleur n'est pas contourné, il est appliqué à fond.
 *
 * Le texte dessus est en encre et jamais en blanc : du blanc sur #e8a534
 * tombe sous 2:1.
 *
 * ── Ce qui est conservé ───────────────────────────────────────────────────
 * `nombreModeles` vient du catalogue et suit les ajouts et retraits de
 * l'administration — c'était déjà le cas, et c'est ce qui empêche la page
 * d'annoncer « 5 modèles » le jour où il y en a six. Le formateur
 * `quantite()` accorde le mot, et les deux boutons gardent leurs
 * destinations : le tunnel de réservation et le catalogue.
 *
 * Les particules décoratives sont retirées : elles doublaient celles du
 * bandeau d'accueil, et sur un fond doré elles ne se voient pas.
 */
export function HomeCTASection({ nombreModeles }: { nombreModeles: number }) {
  return (
    <section className="lme-appel">
      <div className="lme-appel__bande">

        <div className="lme-appel__texte">
          <p className="lme-appel__surtitre">Mobilité électrique au Sénégal</p>
          <h2 className="lme-appel__titre">Un scooter, aujourd’hui.</h2>
          <p className="lme-appel__accroche">
            De la balade urbaine aux longues distances, nos{" "}
            <strong>{quantite(nombreModeles, "modèle")} Revoo</strong> couvrent tous les usages.
            Réservez en ligne en quelques minutes, ou appelez votre agence.
          </p>
        </div>

        <div className="lme-appel__actions">
          <Link href={LIEN_RESERVER} className="lme-appel__bouton lme-appel__bouton--principal">
            Réserver en ligne
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </Link>
          <Link href="/produits" className="lme-appel__bouton lme-appel__bouton--contour">
            {nombreModeles > 1 ? `Voir les ${nombreModeles} modèles` : "Voir le catalogue"}
          </Link>
        </div>

      </div>
    </section>
  );
}
