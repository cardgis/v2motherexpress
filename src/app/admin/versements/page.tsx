import type { Metadata } from "next";
import Link from "next/link";
import { Download, HandCoins } from "lucide-react";
import { exigerAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  chargerEtatVersements,
  FILTRES_VERSEMENTS,
  lireFiltreVersements,
  LIMITE_ECRAN,
  type FiltreVersements,
} from "@/lib/admin/versements";
import { libelleIntervalle, parametresFiltres, resoudrePeriode } from "@/lib/admin/filtres";
import { LIBELLES_FORMULE } from "@/lib/offres";
import { LIBELLES_MODE_PAIEMENT } from "@/lib/modes-paiement";
import { dateCourte, fcfa, nombre, quantite } from "@/lib/formatters";
import { formaterTelephone } from "@/lib/phone";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { classesBouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import FiltresChiffres from "@/components/admin/FiltresChiffres";
import BoutonImprimer from "@/components/admin/BoutonImprimer";
import AnnulerVersement from "@/components/admin/AnnulerVersement";

export const metadata: Metadata = {
  title: "Versements — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ periode?: string; boutique?: string; filtre?: string }> };

export default async function VersementsPage({ searchParams }: Props) {
  await exigerAdmin();
  const params = await searchParams;
  const periode = resoudrePeriode(params.periode);
  const filtre = lireFiltreVersements(params.filtre);

  const boutiques = await prisma.boutique.findMany({
    select: { id: true, store: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  const boutique = boutiques.find((b) => b.id === params.boutique) ?? null;
  const boutiqueId = boutique?.id ?? null;

  const { total, totaux, lignes } = await chargerEtatVersements(
    { periode, boutiqueId, filtre },
    LIMITE_ECRAN,
  );

  const lien = (f: FiltreVersements) =>
    `/admin/versements${parametresFiltres({ periode: periode.code, boutiqueId })}${
      parametresFiltres({ periode: periode.code, boutiqueId }) ? "&" : "?"
    }filtre=${f}`;

  const perimetre = boutique ? boutique.store.name : "Toutes les boutiques";

  return (
    <div className="lme-page">
      <EnTetePage
        fil={[{ libelle: "Chiffres", href: "/admin" }]}
        surtitre="Administration"
        titre="État des versements"
        description={`${perimetre} · situation au ${dateCourte(new Date())}`}
        actions={
          <>
            {/* Lien de téléchargement ordinaire : un <Link> préchargerait l'export. */}
            <a
              href={`/api/admin/versements/export${parametresFiltres({ periode: periode.code, boutiqueId })}${
                parametresFiltres({ periode: periode.code, boutiqueId }) ? "&" : "?"
              }filtre=${filtre}`}
              className={classesBouton({ variante: "primaire" })}
              download
            >
              <Download size={18} aria-hidden />
              Exporter pour Excel
            </a>
            <BoutonImprimer />
          </>
        }
      />

      <div className="lme-pile">
        <FiltresChiffres
          periode={periode.code}
          boutiqueId={boutiqueId}
          boutiques={boutiques.map((b) => ({ id: b.id, nom: b.store.name }))}
        />

        <section aria-label="Totaux">
          <div className="lme-tuiles">
            <div className="lme-tuile" data-ton={totaux.retard > 0 ? "erreur" : undefined}>
              <p className="lme-tuile__valeur">{nombre(totaux.retard)}</p>
              <p className="lme-tuile__libelle">Retard total (FCFA)</p>
              <p className="lme-tuile__detail">
                {totaux.enRetard > 0 ? quantite(totaux.enRetard, "dossier") : "Aucun dossier"} en retard
              </p>
            </div>
            <div className="lme-tuile" data-ton="succes">
              <p className="lme-tuile__valeur">{nombre(totaux.encaissePeriode)}</p>
              <p className="lme-tuile__libelle">Encaissé sur la période (FCFA)</p>
              <p className="lme-tuile__detail">{libelleIntervalle(periode)}</p>
            </div>
            <div className="lme-tuile">
              <p className="lme-tuile__valeur">{nombre(totaux.encaisse)}</p>
              <p className="lme-tuile__libelle">Encaissé depuis l’origine (FCFA)</p>
              <p className="lme-tuile__detail">sur {nombre(totaux.duADate)} exigibles à ce jour</p>
            </div>
          </div>
        </section>

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

        <p className="lme-aide">
          Un solde est un état du jour : la période ne s’applique qu’au total encaissé. Les montants dus suivent
          l’acte — échéances pour une vente, redevance due 6 jours sur 7 pour une location-accession.
        </p>

        {lignes.length === 0 ? (
          <EtatVide icone={<HandCoins size={28} aria-hidden />} titre="Aucun dossier pour ces filtres">
            Les dossiers apparaissent ici dès que leur contrat est scellé.
          </EtatVide>
        ) : (
          <>
            <p className="lme-petit lme-texte-2">
              <strong>{quantite(total, "dossier")}</strong>
              {total > lignes.length ? ` · ${nombre(lignes.length)} premiers affichés, tous dans l’export` : ""}
            </p>

            <div className="lme-pile lme-pile--serree">
              {lignes.map((l) => (
                <article key={l.reservationId} className="lme-bloc">
                  <div className="lme-rangee lme-rangee--entre" style={{ alignItems: "flex-start" }}>
                    <div>
                      <h2 className="lme-sous-titre">
                        <Link href={`/admin/contrats/${l.customerId}`}>{l.client}</Link>
                      </h2>
                      <p className="lme-aide">
                        <span className="lme-mono">{l.reference}</span> · {l.modele} · {LIBELLES_FORMULE[l.formule]} ·{" "}
                        {l.boutique}
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
                      <dt className="lme-aide">Montant du contrat</dt>
                      <dd className="lme-gras">{fcfa(l.solde.duTotal)}</dd>
                    </div>
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

                  {l.solde.suiviPartiel ? (
                    <p className="lme-aide" style={{ marginTop: 10 }}>
                      Contrat scellé avant la mise en service du suivi : seuls les versements postérieurs sont
                      comptés.
                    </p>
                  ) : null}

                  {l.versements.length === 0 ? (
                    <p className="lme-aide" style={{ marginTop: 12 }}>
                      Aucun versement enregistré.
                    </p>
                  ) : (
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
                                {v.annuleLe ? <span className="lme-badge">Annulé</span> : null}
                              </p>
                              <p className="lme-ligne__meta">
                                {dateCourte(v.recuLe)} · {LIBELLES_MODE_PAIEMENT[v.mode]} · saisi par {v.saisiParNom}
                                {v.reference ? ` · réf. ${v.reference}` : ""}
                                {v.recuRef ? ` · reçu ${v.recuRef}` : ""}
                              </p>
                              {v.annuleMotif ? (
                                <p className="lme-ligne__meta">Motif d’annulation : « {v.annuleMotif} »</p>
                              ) : null}
                            </div>
                            <div className="lme-ligne__fin lme-sans-impression">
                              {v.recuPdfPath ? (
                                <a
                                  href={`/api/actes/attestation/${v.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="lme-petit"
                                >
                                  Attestation ↗<span className="lme-sr"> (nouvel onglet)</span>
                                </a>
                              ) : null}
                              {v.annuleLe ? null : (
                                <AnnulerVersement encaissementId={v.id} montant={fcfa(v.montant)} />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
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
