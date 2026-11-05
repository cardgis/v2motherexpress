import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { exigerEquipe } from "@/lib/auth";
import {
  chargerEtatVersements,
  FILTRES_VERSEMENTS,
  lireFiltreVersements,
  LIMITE_ECRAN,
  type FiltreVersements,
} from "@/lib/admin/versements";
import { resoudrePeriode } from "@/lib/admin/filtres";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { LIBELLES_MODE_PAIEMENT } from "@/lib/modes-paiement";
import { dateCourte, fcfa, quantite } from "@/lib/formatters";
import { formaterTelephone } from "@/lib/phone";
import { cheminDossier } from "@/components/gerant/espace-backoffice";
import BoutonAttestation from "@/components/gerant/BoutonAttestation";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";

export const metadata: Metadata = {
  title: "Versements",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ filtre?: string }> };

/**
 * Où en est l'argent, pour CETTE boutique.
 *
 * Même calcul que l'écran de l'administrateur, au périmètre près : le gérant
 * voit qui doit passer et qui a du retard, et relance lui-même. C'est son
 * pense-bête du matin, pas un tableau de direction — d'où l'absence de
 * période et d'export, qui restent côté administration.
 */
export default async function VersementsGerantPage({ searchParams }: Props) {
  const membre = await exigerEquipe();
  const { filtre: saisie } = await searchParams;
  const filtre = lireFiltreVersements(saisie);

  const { total, totaux, lignes } = await chargerEtatVersements(
    { periode: resoudrePeriode("tout"), boutiqueId: membre.boutiqueId, filtre },
    LIMITE_ECRAN,
  );

  const lien = (f: FiltreVersements) => `/gerant/versements?filtre=${f}`;

  return (
    <div className="lme-page">
      <EnTetePage
        fil={[{ libelle: "Tableau de bord", href: "/gerant" }]}
        surtitre="Back-office"
        titre="Versements"
        description={
          totaux.retard > 0
            ? `${fcfa(totaux.retard)} en retard sur ${quantite(totaux.enRetard, "dossier")}`
            : "Aucun retard à ce jour."
        }
      />

      <div className="lme-pile">
        <nav aria-label="Filtrer les dossiers" className="lme-sans-impression">
          <div className="lme-onglets lme-onglets--compacts lme-onglets--defilant">
            {FILTRES_VERSEMENTS.map((f) => (
              <Link
                key={f.code}
                href={lien(f.code)}
                className="lme-onglet"
                aria-current={f.code === filtre ? "page" : undefined}
              >
                {f.libelle}
              </Link>
            ))}
          </div>
        </nav>

        {lignes.length === 0 ? (
          <EtatVide icone={<HandCoins size={28} aria-hidden />} titre="Aucun dossier pour ce filtre">
            Les dossiers apparaissent ici dès que leur contrat est scellé.
          </EtatVide>
        ) : (
          <>
            <p className="lme-petit lme-texte-2">{quantite(total, "dossier")}</p>

            <div className="lme-pile lme-pile--serree">
              {lignes.map((l) => (
                <article key={l.reservationId} className="lme-bloc">
                  <div className="lme-rangee lme-rangee--entre" style={{ alignItems: "flex-start" }}>
                    <div>
                      <h2 className="lme-sous-titre">
                        <Link href={cheminDossier("/gerant", l.customerId)}>{l.client}</Link>
                      </h2>
                      <p className="lme-aide">
                        <span className="lme-mono">{l.reference}</span> · {l.modele} ·{" "}
                        {LIBELLES_FORMULE[l.formule]}
                        {l.contact ? ` · ${formaterTelephone(l.contact)}` : ""}
                      </p>
                    </div>
                    <span
                      className="lme-montant"
                      style={{ color: l.solde.retard > 0 ? "var(--lme-erreur)" : undefined }}
                    >
                      {l.solde.solde
                        ? "Soldé"
                        : l.solde.retard > 0
                          ? `${fcfa(l.solde.retard)} en retard`
                          : "À jour"}
                    </span>
                  </div>

                  <dl className="lme-grille-champs" style={{ marginTop: 14 }}>
                    <div>
                      <dt className="lme-aide">Dû à ce jour</dt>
                      <dd className="lme-gras">{fcfa(l.solde.duADate)}</dd>
                    </div>
                    <div>
                      <dt className="lme-aide">Encaissé</dt>
                      <dd className="lme-gras">{fcfa(l.solde.encaisse)}</dd>
                    </div>
                    <div>
                      <dt className="lme-aide">Reste au terme</dt>
                      <dd className="lme-gras">{fcfa(l.solde.restant)}</dd>
                    </div>
                    {l.solde.joursDeRetard ? (
                      <div>
                        <dt className="lme-aide">Retard en jours</dt>
                        <dd className="lme-gras">{quantite(l.solde.joursDeRetard, "jour")}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {l.versements.length > 0 ? (
                    <details style={{ marginTop: 12 }}>
                      <summary className="lme-petit lme-gras">
                        {quantite(l.versements.filter((v) => v.annuleLe === null).length, "versement")}
                        {l.dernierVersement ? ` · dernier le ${dateCourte(l.dernierVersement)}` : ""}
                      </summary>

                      <ul className="lme-liste" style={{ marginTop: 10 }}>
                        {l.versements.map((v) => (
                          <li key={v.id} className="lme-ligne">
                            <div className="lme-ligne__principal">
                              <p className="lme-ligne__titre">
                                <span style={{ textDecoration: v.annuleLe ? "line-through" : undefined }}>
                                  {fcfa(v.montant)}
                                </span>
                              </p>
                              <p className="lme-ligne__meta">
                                {dateCourte(v.recuLe)} · {LIBELLES_MODE_PAIEMENT[v.mode]}
                                {v.recuRef ? ` · reçu ${v.recuRef}` : ""}
                              </p>
                              {v.annuleMotif ? (
                                <p className="lme-ligne__meta">Annulé : « {v.annuleMotif} »</p>
                              ) : null}
                            </div>
                            {v.annuleLe ? null : (
                              <div className="lme-ligne__fin lme-sans-impression">
                                <BoutonAttestation
                                  encaissementId={v.id}
                                  dejaTiree={v.recuPdfPath !== null}
                                />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="lme-aide" style={{ marginTop: 12 }}>
                      Aucun versement enregistré. La saisie se fait depuis le tableau de bord.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
