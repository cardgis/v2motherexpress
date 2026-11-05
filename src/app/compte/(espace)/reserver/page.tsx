import type { Metadata } from "next";
import { exigerUtilisateur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formulesDisponiblesPour, offresAccessionPour } from "@/lib/offres";
import ReservationForm, { type ProduitOffre, type BoutiqueChoix } from "@/components/compte/ReservationForm";

export const metadata: Metadata = {
  title: "Réserver un scooter",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ modele?: string; intention?: string }> };

export default async function ReserverPage({ searchParams }: Props) {
  await exigerUtilisateur();
  const params = await searchParams;

  const [produits, boutiques] = await Promise.all([
    prisma.produit.findMany({
      // Un modèle est proposé s'il est actif au catalogue. L'ancienne notion de
      // « disponibilité » du produit a été retirée : ce qui décide vraiment,
      // c'est la présence d'une moto dans la flotte de la boutique.
      where: { estActif: true },
      include: { tarification: true },
      orderBy: { modele: "asc" },
    }),
    prisma.boutique.findMany({
      where: { actif: true },
      include: { store: { select: { name: true, city: true } } },
      orderBy: { code: "asc" },
    }),
  ]);

  // Le calcul des offres se fait ici, côté serveur : le navigateur reçoit des
  // montants d'affichage, mais c'est le serveur qui refera le calcul à la
  // création. Rien de ce qui est envoyé ici n'est réutilisé comme prix.
  const offres: ProduitOffre[] = produits.map((p) => ({
    id: p.id,
    nom: p.nom,
    modele: p.modele,
    imageUrl: p.imageUrl,
    autonomieKm: p.autonomieKm,
    vitesseMaxKmh: p.vitesseMaxKmh,
    prixVente: p.tarification?.prixVenteFcfa ?? null,
    tarifJournee: p.tarification?.tarifJourneeFcfa ?? null,
    formules: formulesDisponiblesPour(p),
    offresAccession: offresAccessionPour(p.modele).map((o) => ({
      cle: o.cle,
      libelle: o.libelle,
      redevanceJournaliere: o.redevanceJournaliere,
      dureeMois: o.dureeMois,
      joursFactures: o.joursFactures,
      montantTotal: o.montantTotal,
      avecEngagement: o.avecEngagement,
      differentielSiRupture: o.differentielSiRupture,
    })),
  }));

  const choixBoutiques: BoutiqueChoix[] = boutiques.map((b) => ({
    id: b.id,
    nom: b.store.name,
    ville: b.store.city,
    adresse: b.adresse,
  }));

  // Arrivée depuis la fiche d'un modèle sur le site (« Louer » / « Acheter »).
  // Un modèle inconnu ou retiré du catalogue est simplement ignoré.
  const modeleChoisi = offres.find((_, i) => produits[i]!.slug === params.modele) ?? null;
  const selection = modeleChoisi
    ? {
        produitId: modeleChoisi.id,
        formule:
          params.intention === "achat" && modeleChoisi.formules.includes("VENTE_ECHELONNEE")
            ? ("VENTE_ECHELONNEE" as const)
            : ("" as const),
      }
    : null;

  return <ReservationForm produits={offres} boutiques={choixBoutiques} selection={selection} />;
}
