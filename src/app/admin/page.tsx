import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { exigerAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargerTableauDeBord } from "@/lib/admin/statistiques";
import { libelleIntervalle, parametresFiltres, resoudrePeriode, SERIES, type TypeSuivi } from "@/lib/admin/filtres";
import { fcfa, nombre, quantite } from "@/lib/formatters";
import type { Ton } from "@/lib/statuts";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Alerte } from "@/components/ui/Alerte";
import { LienBouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import FiltresChiffres from "@/components/admin/FiltresChiffres";
import BoutonImprimer from "@/components/admin/BoutonImprimer";
import GraphiqueMensuel from "@/components/admin/GraphiqueMensuel";

export const metadata: Metadata = {
  title: "Chiffres — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ periode?: string; boutique?: string }> };

export default async function ChiffresPage({ searchParams }: Props) {
  await exigerAdmin();
  const params = await searchParams;
  const periode = resoudrePeriode(params.periode);

  const boutiques = await prisma.boutique.findMany({
    select: { id: true, store: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  // Une boutique inconnue dans l'adresse retombe sur « toutes » plutôt qu'une erreur.
  const boutique = boutiques.find((b) => b.id === params.boutique) ?? null;
  const boutiqueId = boutique?.id ?? null;

  const { indicateurs, enCours, aTraiter, parBoutique, parModele, douzeMois } = await chargerTableauDeBord({
    periode,
    boutiqueId,
  });

  const suivi = (type: TypeSuivi) => `/admin/suivi${parametresFiltres({ periode: periode.code, boutiqueId, type })}`;
  const enPreparation = aTraiter.contratsAEtablir + aTraiter.chezLeClient + aTraiter.aContresigner;
  const maxModele = Math.max(1, ...parModele.map((m) => m.total));
  const total = (lire: (b: (typeof parBoutique)[number]) => number) => parBoutique.reduce((n, b) => n + lire(b), 0);

  return (
    <div className="lme-page">
      <EnTetePage
        surtitre="Administration"
        titre="Chiffres clés"
        description={`${boutique ? boutique.store.name : "Toutes les boutiques"} · ${periode.libelle.toLowerCase()}, ${libelleIntervalle(periode)}`}
        actions={
          <>
            <LienBouton href={suivi("tout")} icone={<FileSpreadsheet size={18} aria-hidden />}>
              Feuille de suivi
            </LienBouton>
            <BoutonImprimer />
          </>
        }
      />

      <div className="lme-pile lme-pile--large">
        <FiltresChiffres
          periode={periode.code}
          boutiqueId={boutiqueId}
          boutiques={boutiques.map((b) => ({ id: b.id, nom: b.store.name }))}
        />

        <section aria-labelledby="titre-periode" className="lme-pile">
          <h2 id="titre-periode" className="lme-sous-titre">
            Sur la période
          </h2>
          <div className="lme-tuiles">
            <TuileChiffre
              valeur={indicateurs.ventes.nombre}
              libelle="Ventes signées"
              detail={fcfa(indicateurs.ventes.montant)}
              href={suivi("ventes")}
              ton="succes"
            />
            <TuileChiffre
              valeur={indicateurs.longues.nombre}
              libelle="Locations longue durée signées"
              detail={`${fcfa(indicateurs.longues.montant)} de valeur contractuelle`}
              href={suivi("longue")}
              ton="succes"
            />
            <TuileChiffre
              valeur={indicateurs.courtes.nombre}
              libelle="Locations courte durée réservées"
              detail={fcfa(indicateurs.courtes.montant)}
              href={suivi("courte")}
              ton="succes"
            />
            <TuileChiffre
              valeur={indicateurs.reservationsRecues}
              libelle="Réservations reçues"
              detail="Toutes formules confondues"
              href={suivi("tout")}
              ton="info"
            />
          </div>
        </section>

        <section aria-labelledby="titre-jour" className="lme-pile">
          <h2 id="titre-jour" className="lme-sous-titre">
            Aujourd’hui
          </h2>
          <div className="lme-tuiles">
            <TuileChiffre
              valeur={enCours.total}
              libelle="Contrats en cours"
              detail={`${quantite(enCours.ventes, "vente")} · ${enCours.longues} longue durée · ${enCours.courtes} courte durée`}
              href={suivi("en-cours")}
              ton="succes"
            />
            <TuileChiffre
              valeur={aTraiter.retraits}
              libelle="Signés, moto à remettre"
              href={suivi("en-cours")}
              ton="attention"
            />
            <TuileChiffre
              valeur={aTraiter.dossiers}
              libelle="Dossiers à vérifier"
              href="/admin/contrats?filtre=a-verifier"
              ton="attention"
            />
            <TuileChiffre
              valeur={enPreparation}
              libelle="Contrats en préparation"
              detail={`${aTraiter.contratsAEtablir} à établir · ${aTraiter.chezLeClient} chez le client · ${aTraiter.aContresigner} à contresigner`}
              href="/admin/contrats"
              ton="info"
            />
          </div>
        </section>

        <Carte
          titre="Douze derniers mois"
          description="Contrats signés chaque mois (ventes, longue durée) et locations courte durée réservées."
        >
          <GraphiqueMensuel mois={douzeMois} titre="Activité des douze derniers mois" />
        </Carte>

        <Carte titre="Par boutique" description={`${periode.libelle} — montants en FCFA.`}>
          <div className="lme-tableau-conteneur">
            <table className="lme-tableau">
              <thead>
                <tr>
                  <th scope="col">Boutique</th>
                  <th scope="col" className="lme-nombre">Ventes</th>
                  <th scope="col" className="lme-nombre">Montant ventes</th>
                  <th scope="col" className="lme-nombre">Longue durée</th>
                  <th scope="col" className="lme-nombre">Valeur longue durée</th>
                  <th scope="col" className="lme-nombre">Courte durée</th>
                  <th scope="col" className="lme-nombre">En cours</th>
                  <th scope="col" className="lme-nombre">Motos disponibles</th>
                </tr>
              </thead>
              <tbody>
                {parBoutique.map((b) => (
                  <tr key={b.id}>
                    <th scope="row">
                      <Link href={`/admin/boutiques/${b.id}`}>{b.nom}</Link>
                      <span className="lme-secondaire">
                        {b.code}
                        {b.actif ? "" : " · fermée"}
                      </span>
                    </th>
                    <td className="lme-nombre">{b.ventes.nombre}</td>
                    <td className="lme-nombre">{nombre(b.ventes.montant)}</td>
                    <td className="lme-nombre">{b.longues.nombre}</td>
                    <td className="lme-nombre">{nombre(b.longues.montant)}</td>
                    <td className="lme-nombre">{b.courtes.nombre}</td>
                    <td className="lme-nombre">{b.enCours}</td>
                    <td className="lme-nombre">
                      {b.motosDisponibles} / {b.motos}
                    </td>
                  </tr>
                ))}
              </tbody>
              {parBoutique.length > 1 ? (
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="lme-nombre">{total((b) => b.ventes.nombre)}</td>
                    <td className="lme-nombre">{nombre(total((b) => b.ventes.montant))}</td>
                    <td className="lme-nombre">{total((b) => b.longues.nombre)}</td>
                    <td className="lme-nombre">{nombre(total((b) => b.longues.montant))}</td>
                    <td className="lme-nombre">{total((b) => b.courtes.nombre)}</td>
                    <td className="lme-nombre">{total((b) => b.enCours)}</td>
                    <td className="lme-nombre">
                      {total((b) => b.motosDisponibles)} / {total((b) => b.motos)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </Carte>

        <Carte titre="Par modèle" description={`${periode.libelle} — ventes, longue et courte durée.`}>
          {parModele.length === 0 ? (
            <EtatVide titre="Aucune activité sur la période">Changez de période pour voir la répartition.</EtatVide>
          ) : (
            <div className="lme-pile">
              <ul className="lme-barres">
                {parModele.map((m) => (
                  <li key={m.id} className="lme-barre">
                    <span className="lme-barre__nom" title={m.nom}>
                      {m.nom}
                    </span>
                    <span className="lme-barre__piste" aria-hidden>
                      {SERIES.map((serie) =>
                        m[serie.cle] > 0 ? (
                          <span
                            key={serie.cle}
                            style={{ width: `${(m[serie.cle] / maxModele) * 100}%`, background: serie.couleur }}
                          />
                        ) : null,
                      )}
                    </span>
                    <span className="lme-barre__valeur">
                      {m.total}
                      <span className="lme-sr">
                        {" "}
                        : {quantite(m.ventes, "vente")}, {m.longues} longue durée, {m.courtes} courte durée
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="lme-legende">
                {SERIES.map((serie) => (
                  <li key={serie.cle}>
                    <span className="lme-legende__pastille" style={{ background: serie.couleur }} aria-hidden />
                    {serie.libelle}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Carte>

        <Alerte
          ton="info"
          titre="Comment lire ces chiffres"
          actions={
            <LienBouton href="/admin/versements" variante="secondaire" taille="sm">
              Voir l’état des versements
            </LienBouton>
          }
        >
          Les montants sont ceux des contrats : prix de vente, et valeur indicative des redevances pour la longue
          durée. Ce ne sont pas des encaissements, qui seront suivis avec l’échéancier. Une vente ou une location
          longue durée compte à la date où son contrat est scellé ; un contrat devenu caduc n’est pas compté. Les
          locations courte durée comptent à la date de réservation sur le site.
        </Alerte>
      </div>
    </div>
  );
}

function TuileChiffre({
  valeur,
  libelle,
  detail,
  href,
  ton,
}: {
  valeur: number;
  libelle: string;
  detail?: string;
  href?: string;
  ton: Ton;
}) {
  // Un compteur à zéro reste neutre : aucune couleur sans raison.
  const tonAffiche = valeur > 0 ? ton : undefined;
  const contenu = (
    <>
      <p className="lme-tuile__valeur">{nombre(valeur)}</p>
      <p className="lme-tuile__libelle">
        {libelle}
        {href ? <ChevronRight size={16} aria-hidden /> : null}
      </p>
      {detail ? <p className="lme-tuile__detail">{detail}</p> : null}
    </>
  );

  return href ? (
    <Link href={href} className="lme-tuile" data-ton={tonAffiche}>
      {contenu}
    </Link>
  ) : (
    <div className="lme-tuile" data-ton={tonAffiche}>
      {contenu}
    </div>
  );
}
