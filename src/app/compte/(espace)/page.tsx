import type { Metadata } from "next";
import type { ComponentType } from "react";
import QRCode from "qrcode";
import {
  ArrowRight,
  CalendarPlus,
  FileText,
  Hourglass,
  IdCard,
  PenLine,
  QrCode,
  Store,
} from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateFr, fcfa } from "@/lib/formatters";
import { presentationStatut } from "@/lib/statuts";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Carte } from "@/components/ui/Carte";
import { StatutBadge } from "@/components/ui/Badge";
import { LienBouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { Alerte } from "@/components/ui/Alerte";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

/** La session est relue à chaque affichage : pas de mise en cache. */
export const dynamic = "force-dynamic";

interface ProchaineEtape {
  Icone: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  titre: string;
  detail: string;
  action?: { href: string; libelle: string };
}

const TEXTE_DOSSIER: Record<string, string> = {
  INCOMPLET: "Il manque encore des informations ou des pièces pour que la boutique puisse l’examiner.",
  A_VERIFIER: "La boutique vérifie vos pièces. Vous n’avez rien à faire pour le moment.",
  VALIDE: "Votre identité est vérifiée : vos prochaines réservations iront plus vite.",
  REJETE: "La boutique vous demande une correction avant de pouvoir préparer votre contrat.",
};

export default async function EspaceClientPage() {
  const user = await exigerUtilisateur();

  const [reservations, customer] = await Promise.all([
    prisma.reservation.findMany({
      where: { customer: { userId: user.id } },
      include: {
        produit: { select: { nom: true } },
        boutique: { select: { store: { select: { name: true } } } },
        contract: { select: { id: true, statut: true } },
        handover: { select: { statut: true, pvPdfPath: true } },
        // Constat de sortie : la pièce qui arrête l'état du véhicule au retour.
        restitution: { select: { statut: true, pvPdfPath: true } },
        // Reçus de versement : le client les retrouve même s'il perd le papier.
        encaissements: {
          where: { annuleLe: null, recuPdfPath: { not: null } },
          select: { id: true, montant: true, recuLe: true, recuRef: true },
          orderBy: { recuLe: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findUnique({
      where: { userId: user.id },
      select: { prenom: true, statutKyc: true, kycMotifRejet: true },
    }),
  ]);

  // QR de retrait : le gérant le scanne en boutique et la fiche s'ouvre sur
  // son téléphone. Il n'a de sens qu'entre le scellement et la remise.
  const aRetirer = reservations.find((r) => r.statut === "EN_ATTENTE_RETRAIT");
  const qrRetrait = aRetirer
    ? await QRCode.toDataURL(
        `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/gerant/retrait/${aRetirer.id}`,
        { width: 320, margin: 1, errorCorrectionLevel: "M" },
      )
    : null;

  // Un brouillon n'est jamais montré au client : il ne voit que ce que la
  // boutique lui a explicitement transmis.
  const contrats = reservations.filter((r) => r.contract && r.contract.statut !== "BROUILLON");
  const constats = reservations.filter((r) => r.handover?.pvPdfPath);
  const restitutions = reservations.filter((r) => r.restitution?.pvPdfPath);
  const attestations = reservations.flatMap((r) =>
    r.encaissements.map((e) => ({ ...e, reference: r.reference })),
  );

  const etape = prochaineEtape();

  function prochaineEtape(): ProchaineEtape | null {
    const aSigner = contrats.find((r) => r.contract!.statut === "A_SIGNER_CLIENT");
    if (aSigner) {
      return {
        Icone: PenLine,
        titre: "Votre contrat est prêt à être signé",
        detail: `${aSigner.produit.nom} — ${aSigner.reference}. Lisez-le, puis signez : un code de vérification vous sera envoyé.`,
        action: { href: `/compte/contrats/${aSigner.contract!.id}/signer`, libelle: "Lire et signer" },
      };
    }
    if (customer?.statutKyc === "REJETE") {
      return {
        Icone: IdCard,
        titre: "Votre dossier est à corriger",
        detail: customer.kycMotifRejet ?? "La boutique vous demande une correction.",
        action: { href: "/compte/dossier", libelle: "Corriger mon dossier" },
      };
    }
    if (aRetirer) {
      return {
        Icone: QrCode,
        titre: "Votre scooter vous attend en boutique",
        detail: `Présentez votre code de retrait à ${aRetirer.boutique.store.name}, avec l’original de votre pièce d’identité.`,
        action: { href: "#retrait", libelle: "Afficher mon code" },
      };
    }
    if (reservations.some((r) => r.statut === "EN_ATTENTE_DOSSIER")) {
      return {
        Icone: IdCard,
        titre: "Complétez votre dossier",
        detail: "Vos informations et vos pièces justificatives permettent à la boutique de préparer votre contrat.",
        action: { href: "/compte/dossier", libelle: "Compléter mon dossier" },
      };
    }
    if (customer?.statutKyc === "A_VERIFIER") {
      return {
        Icone: Hourglass,
        titre: "Votre dossier est en cours de vérification",
        detail: "La boutique examine vos pièces. Votre contrat vous sera proposé ici dès qu’il sera prêt.",
      };
    }
    if (reservations.some((r) => r.statut === "EN_ATTENTE_SIGNATURE")) {
      return {
        Icone: Hourglass,
        titre: "La boutique prépare votre contrat",
        detail: "Il apparaîtra ici, prêt à signer, dès que la boutique l’aura relu.",
      };
    }
    if (reservations.length === 0) {
      return {
        Icone: CalendarPlus,
        titre: "Réservez votre scooter",
        detail: "Choisissez un modèle, une formule et votre boutique de retrait en quelques minutes.",
        action: { href: "/compte/reserver", libelle: "Réserver" },
      };
    }
    return null;
  }

  return (
    <div className="lme-page">
      <EnTetePage
        surtitre="Mon espace"
        titre={customer?.prenom ? `Bonjour ${customer.prenom}` : "Bonjour"}
        description="Vos réservations, votre dossier et vos contrats, au même endroit."
        actions={
          reservations.length > 0 ? (
            <LienBouton href="/compte/reserver" variante="secondaire" icone={<CalendarPlus size={18} aria-hidden />}>
              Nouvelle réservation
            </LienBouton>
          ) : null
        }
      />

      <div className="lme-pile lme-pile--large">
        {etape ? (
          <section className="lme-prochaine" aria-labelledby="prochaine-etape">
            <span className="lme-prochaine__icone">
              <etape.Icone size={24} aria-hidden />
            </span>
            <div className="lme-prochaine__texte">
              <p className="lme-surtitre" style={{ marginBottom: 2 }}>
                Prochaine étape
              </p>
              <h2 id="prochaine-etape" className="lme-prochaine__titre">
                {etape.titre}
              </h2>
              <p className="lme-prochaine__detail">{etape.detail}</p>
            </div>
            {etape.action ? (
              <LienBouton href={etape.action.href} taille="lg">
                {etape.action.libelle}
                <ArrowRight size={18} aria-hidden />
              </LienBouton>
            ) : null}
          </section>
        ) : null}

        {qrRetrait && aRetirer ? (
          <Carte
            id="retrait"
            accent
            titre="Mon code de retrait"
            description={`Réservation ${aRetirer.reference} — ${aRetirer.produit.nom}, à retirer à ${aRetirer.boutique.store.name}`}
          >
            <div className="lme-rangee" style={{ alignItems: "flex-start", gap: 20 }}>
              {/* Image générée côté serveur en data-URL : next/image n'apporte rien ici. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrRetrait}
                alt={`Code QR de retrait de la réservation ${aRetirer.reference}`}
                width={168}
                height={168}
                className="lme-qr"
              />
              <div className="lme-pile lme-pile--serree" style={{ flex: "1 1 260px" }}>
                <p>Le gérant scanne ce code : votre dossier s’ouvre directement sur son téléphone.</p>
                <Alerte ton="attention" titre="Munissez-vous de l’original de votre pièce d’identité">
                  Sans cette vérification, le scooter ne peut pas vous être remis.
                </Alerte>
              </div>
            </div>
          </Carte>
        ) : null}

        <div className="lme-colonnes">
          <Carte titre="Mes réservations">
            {reservations.length === 0 ? (
              <EtatVide
                icone={<Store size={28} aria-hidden />}
                titre="Aucune réservation"
                action={<LienBouton href="/compte/reserver">Réserver un scooter</LienBouton>}
              >
                Votre première réservation apparaîtra ici.
              </EtatVide>
            ) : (
              <ul className="lme-liste">
                {reservations.map((r) => (
                  <li key={r.id} className="lme-ligne">
                    <div className="lme-ligne__principal">
                      <p className="lme-ligne__titre">{r.produit.nom}</p>
                      <p className="lme-ligne__meta">
                        {r.reference} · {r.boutique.store.name}
                        {r.dateDebut ? ` · à partir du ${dateFr(r.dateDebut)}` : null}
                      </p>
                    </div>
                    <div className="lme-ligne__fin">
                      <span className="lme-gras">{fcfa(r.montantTotal)}</span>
                      <StatutBadge type="reservation" statut={r.statut} lecteur="client" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <div className="lme-pile">
            <Carte
              titre="Mon dossier"
              actions={customer ? <StatutBadge type="kyc" statut={customer.statutKyc} lecteur="client" /> : null}
            >
              <p className="lme-texte-2 lme-petit">
                {customer
                  ? TEXTE_DOSSIER[customer.statutKyc]
                  : "Il vous sera demandé lors de votre première réservation : identité, pièce, coordonnées et justificatifs."}
              </p>
              <div style={{ marginTop: 14 }}>
                <LienBouton
                  href="/compte/dossier"
                  variante="secondaire"
                  taille="sm"
                  icone={<IdCard size={16} aria-hidden />}
                >
                  {customer ? "Voir mon dossier" : "Commencer mon dossier"}
                </LienBouton>
              </div>
            </Carte>

            <Carte titre="Mes documents">
              {contrats.length === 0 &&
              constats.length === 0 &&
              attestations.length === 0 &&
              restitutions.length === 0 ? (
                <p className="lme-texte-2 lme-petit">
                  Votre contrat et votre constat de remise apparaîtront ici dès qu’ils seront établis.
                </p>
              ) : (
                <ul className="lme-liste">
                  {contrats.map((r) => {
                    const statut = r.contract!.statut;
                    return (
                      <li key={r.contract!.id} className="lme-ligne">
                        <div className="lme-ligne__principal">
                          <p className="lme-ligne__titre">
                            <FileText size={16} aria-hidden />
                            Contrat {r.reference}
                          </p>
                          <p className="lme-ligne__meta">{r.produit.nom}</p>
                          <p style={{ marginTop: 8 }}>
                            <StatutBadge type="contrat" statut={statut} lecteur="client" />
                          </p>
                        </div>
                        <div className="lme-ligne__fin">
                          <LienBouton
                            href={`/api/contrats/${r.contract!.id}/pdf`}
                            nouvelOnglet
                            variante="secondaire"
                            taille="sm"
                            aria-label={`Lire le contrat ${r.reference}, ${presentationStatut("contrat", statut, "client").libelle}`}
                          >
                            Lire
                          </LienBouton>
                          {statut === "A_SIGNER_CLIENT" ? (
                            <LienBouton href={`/compte/contrats/${r.contract!.id}/signer`} taille="sm">
                              Signer
                            </LienBouton>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}

                  {attestations.map((a) => (
                    <li key={`attestation-${a.id}`} className="lme-ligne">
                      <div className="lme-ligne__principal">
                        <p className="lme-ligne__titre">
                          <FileText size={16} aria-hidden />
                          Reçu de {fcfa(a.montant)}
                        </p>
                        <p className="lme-ligne__meta">
                          {a.reference} — versement du {dateFr(a.recuLe)}
                          {a.recuRef ? ` · ${a.recuRef}` : ""}
                        </p>
                      </div>
                      <LienBouton
                        href={`/api/actes/attestation/${a.id}`}
                        nouvelOnglet
                        variante="secondaire"
                        taille="sm"
                      >
                        Lire
                      </LienBouton>
                    </li>
                  ))}

                  {constats.map((r) => (
                    <li key={`constat-${r.id}`} className="lme-ligne">
                      <div className="lme-ligne__principal">
                        <p className="lme-ligne__titre">
                          <FileText size={16} aria-hidden />
                          Constat de remise
                        </p>
                        <p className="lme-ligne__meta">{r.reference} — état du véhicule à la remise</p>
                      </div>
                      <LienBouton href={`/api/actes/constat/${r.id}`} nouvelOnglet variante="secondaire" taille="sm">
                        Lire
                      </LienBouton>
                    </li>
                  ))}

                  {restitutions.map((r) => (
                    <li key={`restitution-${r.id}`} className="lme-ligne">
                      <div className="lme-ligne__principal">
                        <p className="lme-ligne__titre">
                          <FileText size={16} aria-hidden />
                          Constat de restitution
                        </p>
                        <p className="lme-ligne__meta">
                          {r.reference} — état du véhicule au retour
                        </p>
                      </div>
                      <LienBouton
                        href={`/api/actes/restitution/${r.id}`}
                        nouvelOnglet
                        variante="secondaire"
                        taille="sm"
                      >
                        Lire
                      </LienBouton>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>
        </div>
      </div>
    </div>
  );
}
