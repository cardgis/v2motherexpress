import type { Metadata } from "next";
import Link from "next/link";
import { Bike, ChevronRight, ScanLine } from "lucide-react";
import { exigerEquipe, filtreBoutique } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateFr } from "@/lib/formatters";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { Badge } from "@/components/ui/Badge";
import { LienBouton } from "@/components/ui/Bouton";
import SaisieVersement from "@/components/gerant/SaisieVersement";
import type { Ton } from "@/lib/statuts";

export const metadata: Metadata = {
  title: "Back-office gérant",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const nomClient = (c: { nom: string | null; prenom: string | null }) =>
  c.nom && c.prenom ? `${c.nom.toUpperCase()} ${c.prenom}` : "Client sans nom";

export default async function BackOfficeGerantPage() {
  const gerant = await exigerEquipe();

  // Cloisonnement : le filtre boutique est appliqué CÔTÉ SERVEUR sur chaque
  // requête. Un gérant ne peut pas voir les dossiers d'une autre boutique,
  // même en manipulant l'URL ou les appels réseau.
  const perimetre = filtreBoutique(gerant);

  const [boutique, aVerifier, aEtablir, aContresigner, retraits, actives] = await Promise.all([
    gerant.boutiqueId
      ? prisma.boutique.findUnique({
          where: { id: gerant.boutiqueId },
          include: { store: { select: { name: true } } },
        })
      : null,
    prisma.customer.count({
      where: {
        statutKyc: "A_VERIFIER",
        ...(gerant.estAdmin ? {} : { reservations: { some: perimetre } }),
      },
    }),
    prisma.reservation.count({ where: { ...perimetre, statut: "EN_ATTENTE_SIGNATURE" } }),
    prisma.contract.findMany({
      where: { statut: "A_SIGNER_GERANT", reservation: perimetre },
      select: {
        id: true,
        reference: true,
        reservation: {
          select: {
            customerId: true,
            produit: { select: { nom: true } },
            customer: { select: { nom: true, prenom: true } },
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    prisma.reservation.findMany({
      where: { ...perimetre, statut: "EN_ATTENTE_RETRAIT" },
      select: {
        id: true,
        reference: true,
        expireLe: true,
        produit: { select: { nom: true } },
        customer: { select: { nom: true, prenom: true } },
      },
      orderBy: { expireLe: "asc" },
      take: 20,
    }),
    // Locations en cours : le compteur ET la liste de celles qu'on peut clore.
    // Une vente échelonnée active n'est pas close par un état des lieux — son
    // véhicule ne revient pas — elle compte mais ne s'affiche pas plus bas.
    prisma.reservation.findMany({
      where: { ...perimetre, statut: "ACTIVE" },
      select: {
        id: true,
        reference: true,
        formule: true,
        dateFin: true,
        produit: { select: { nom: true } },
        customer: { select: { nom: true, prenom: true } },
      },
      orderBy: { dateFin: "asc" },
      take: 50,
    }),
  ]);

  const aClore = actives.filter(
    (r) => r.formule === "LOCATION_JOURNALIERE" || r.formule === "LOCATION_ACCESSION",
  );

  return (
    <div className="lme-page">
      <EnTetePage
        surtitre="Back-office"
        titre={boutique ? boutique.store.name : "Toutes les boutiques"}
        description={
          gerant.lectureSeule
            ? `${gerant.nomAffichage ?? "Commercial"} — consultation. Voici où en sont les dossiers de la boutique.`
            : `${gerant.nomAffichage ?? "Gérant"}${gerant.estAdmin ? " — administrateur" : ""}. Voici ce qui attend une action de votre part.`
        }
      />

      <div className="lme-pile lme-pile--large">
        <section aria-label="Indicateurs">
          <div className="lme-tuiles">
            <Tuile valeur={aVerifier} libelle="Dossiers à vérifier" href="/gerant/dossiers" ton="attention" />
            <Tuile valeur={aContresigner.length} libelle="À contresigner" href="#a-contresigner" ton="attention" />
            <Tuile valeur={retraits.length} libelle="Retraits à faire" href="#retraits" ton="attention" />
            <Tuile valeur={aEtablir} libelle="Contrats à établir" href="/gerant/dossiers?filtre=tous" ton="info" />
            <Tuile valeur={actives.length} libelle="Locations en cours" href="#a-clore" ton="succes" />
          </div>
        </section>

        {/* Le commercial consulte, il n'encaisse pas. */}
        {gerant.lectureSeule ? null : <SaisieVersement />}

        <div className="lme-grille-verif">
          <Carte
            id="a-contresigner"
            titre="À contresigner"
            description="Le client a signé : votre contre-signature scelle le contrat."
          >
            {aContresigner.length === 0 ? (
              <p className="lme-texte-2 lme-petit">Aucun contrat n’attend votre signature.</p>
            ) : (
              <ul className="lme-liste">
                {aContresigner.map((c) => (
                  <li key={c.id}>
                    <Link href={`/gerant/dossiers/${c.reservation.customerId}`} className="lme-ligne">
                      <div className="lme-ligne__principal">
                        <p className="lme-ligne__titre">{nomClient(c.reservation.customer)}</p>
                        <p className="lme-ligne__meta">
                          {c.reference} · {c.reservation.produit.nom}
                        </p>
                      </div>
                      <div className="lme-ligne__fin">
                        <Badge ton="attention">À contresigner</Badge>
                        <ChevronRight size={18} aria-hidden />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <Carte
            id="retraits"
            titre="Retraits à faire"
            description="Clients attendus en boutique. Vérifiez l’original de la pièce avant de remettre la moto."
          >
            {retraits.length === 0 ? (
              <p className="lme-texte-2 lme-petit">Aucun client attendu pour un retrait.</p>
            ) : (
              <ul className="lme-liste">
                {retraits.map((r) => (
                  <li key={r.id} className="lme-ligne">
                    <div className="lme-ligne__principal">
                      <p className="lme-ligne__titre">{nomClient(r.customer)}</p>
                      <p className="lme-ligne__meta">
                        {r.reference} · {r.produit.nom}
                        {r.expireLe ? ` · avant le ${dateFr(r.expireLe)}` : null}
                      </p>
                    </div>
                    {gerant.lectureSeule ? (
                      <Badge ton="attention">Retrait à faire</Badge>
                    ) : (
                      <LienBouton href={`/gerant/retrait/${r.id}`} taille="sm" icone={<ScanLine size={16} aria-hidden />}>
                        Démarrer le retrait
                      </LienBouton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <Carte
            id="a-clore"
            titre="Contrats à clore"
            description="Le client rend la moto : établissez le constat de restitution, signé par vous deux sur place."
          >
            {aClore.length === 0 ? (
              <p className="lme-texte-2 lme-petit">Aucune location en cours.</p>
            ) : (
              <ul className="lme-liste">
                {aClore.map((r) => (
                  <li key={r.id} className="lme-ligne">
                    <div className="lme-ligne__principal">
                      <p className="lme-ligne__titre">{nomClient(r.customer)}</p>
                      <p className="lme-ligne__meta">
                        {r.reference} · {r.produit.nom}
                        {r.dateFin ? ` · jusqu’au ${dateFr(r.dateFin)}` : null}
                      </p>
                    </div>
                    {gerant.lectureSeule ? (
                      <Badge ton="succes">En cours</Badge>
                    ) : (
                      <LienBouton
                        href={`/gerant/restitution/${r.id}`}
                        taille="sm"
                        variante="secondaire"
                        icone={<Bike size={16} aria-hidden />}
                      >
                        Clore le contrat
                      </LienBouton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      </div>
    </div>
  );
}

function Tuile({ valeur, libelle, href, ton }: { valeur: number; libelle: string; href?: string; ton: Ton }) {
  // Un compteur à zéro reste neutre : aucune couleur d'alerte sans raison.
  const tonAffiche = valeur > 0 ? ton : undefined;
  const contenu = (
    <>
      <p className="lme-tuile__valeur">{valeur}</p>
      <p className="lme-tuile__libelle">
        {libelle}
        {href ? <ChevronRight size={16} aria-hidden /> : null}
      </p>
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
