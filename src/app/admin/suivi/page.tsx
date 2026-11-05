import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { exigerAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargerSuivi, LIMITE_ECRAN } from "@/lib/admin/suivi";
import {
  libelleIntervalle,
  lireTypeSuivi,
  parametresFiltres,
  resoudrePeriode,
  TYPES_SUIVI,
  type TypeSuivi,
} from "@/lib/admin/filtres";
import { dateCourte, dateFr, fcfa, nombre, quantite } from "@/lib/formatters";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { classesBouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import FiltresChiffres from "@/components/admin/FiltresChiffres";
import BoutonImprimer from "@/components/admin/BoutonImprimer";

export const metadata: Metadata = {
  title: "Feuille de suivi — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ periode?: string; boutique?: string; type?: string }> };

export default async function SuiviPage({ searchParams }: Props) {
  await exigerAdmin();
  const params = await searchParams;
  const periode = resoudrePeriode(params.periode);
  const type = lireTypeSuivi(params.type);

  const boutiques = await prisma.boutique.findMany({
    select: { id: true, store: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  const boutique = boutiques.find((b) => b.id === params.boutique) ?? null;
  const boutiqueId = boutique?.id ?? null;

  const { total, montantEngage, lignes } = await chargerSuivi({ periode, boutiqueId, type }, LIMITE_ECRAN);

  const lien = (t: TypeSuivi) => `/admin/suivi${parametresFiltres({ periode: periode.code, boutiqueId, type: t })}`;
  const perimetre = boutique ? boutique.store.name : "Toutes les boutiques";

  return (
    <div className="lme-page">
      <EnTetePage
        fil={[{ libelle: "Chiffres", href: `/admin${parametresFiltres({ periode: periode.code, boutiqueId })}` }]}
        surtitre="Administration"
        titre="Feuille de suivi"
        description={
          type === "en-cours"
            ? `${perimetre} · état au ${dateFr(new Date())}`
            : `${perimetre} · ${periode.libelle.toLowerCase()}, ${libelleIntervalle(periode)}`
        }
        actions={
          <>
            {/* Lien de téléchargement ordinaire : un <Link> préchargerait l'export. */}
            <a
              href={`/api/admin/suivi${parametresFiltres({ periode: periode.code, boutiqueId, type })}`}
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
          type={type}
        />

        <nav aria-label="Type de lignes" className="lme-sans-impression">
          <div className="lme-onglets lme-onglets--compacts lme-onglets--defilant">
            {TYPES_SUIVI.map((t) => (
              <Link
                key={t.code}
                href={lien(t.code)}
                className="lme-onglet"
                aria-current={t.code === type ? "page" : undefined}
              >
                {t.libelle}
              </Link>
            ))}
          </div>
        </nav>

        <p className="lme-aide">
          {type === "en-cours"
            ? "Motos remises et contrats en cours à ce jour : la période ne s’applique pas."
            : "Une ligne apparaît si la réservation ou la signature du contrat tombe dans la période."}
        </p>

        {lignes.length === 0 ? (
          <EtatVide icone={<FileSpreadsheet size={28} aria-hidden />} titre="Aucune ligne pour ces filtres">
            Changez de période, de boutique ou de type.
          </EtatVide>
        ) : (
          <>
            <p className="lme-petit lme-texte-2">
              <strong>{quantite(total, "ligne")}</strong> · {fcfa(montantEngage)} engagés — hors
              caducs, annulés, terminés et arrêtés
              {total > lignes.length ? ` · ${nombre(lignes.length)} premières affichées, toutes dans l’export` : ""}
            </p>

            <div className="lme-tableau-conteneur">
              <table className="lme-tableau">
                <thead>
                  <tr>
                    <th scope="col">Référence</th>
                    <th scope="col">Réservé le</th>
                    <th scope="col">Signé le</th>
                    <th scope="col">Boutique</th>
                    <th scope="col">Client</th>
                    <th scope="col">Formule</th>
                    <th scope="col">Modèle</th>
                    <th scope="col" className="lme-nombre">
                      Montant (FCFA)
                    </th>
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.reference}>
                      <th scope="row" className="lme-mono">
                        {/* Le dossier s'ouvre avec les gestes du gérant sur ses contrats. */}
                        <Link href={`/admin/contrats/${l.customerId}`}>{l.reference}</Link>
                      </th>
                      <td>{dateCourte(l.reserveLe)}</td>
                      <td>{l.signeLe ? dateCourte(l.signeLe) : "—"}</td>
                      <td>{l.boutique}</td>
                      <td>
                        {l.client}
                        <span className="lme-secondaire">{l.contact}</span>
                      </td>
                      <td>
                        {l.formule}
                        {l.dureeMois ? (
                          <span className="lme-secondaire">
                            {l.dureeMois} mois
                            {l.redevanceJournaliere ? ` · ${nombre(l.redevanceJournaliere)} F/jour` : ""}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {l.modele}
                        {l.serie ? <span className="lme-secondaire lme-mono">{l.serie}</span> : null}
                      </td>
                      <td className="lme-nombre">{nombre(l.montant)}</td>
                      <td>
                        {l.statutReservation}
                        {l.statutContrat ? <span className="lme-secondaire">Contrat : {l.statutContrat}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
