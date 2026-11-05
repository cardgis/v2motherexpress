import type { Metadata } from "next";
import { exigerEquipe } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listerFlotte, modelesDisponibles } from "@/lib/gerant/flotte";
import EcranFlotte from "@/components/gerant/EcranFlotte";

export const metadata: Metadata = {
  title: "Flotte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FlottePage() {
  const membre = await exigerEquipe();

  const [vehicules, modeles, boutiques] = await Promise.all([
    listerFlotte(membre),
    modelesDisponibles(),
    // L'administrateur voit toutes les boutiques et choisit où ajouter une moto.
    membre.estAdmin
      ? prisma.boutique.findMany({
          where: { actif: true },
          select: { id: true, store: { select: { name: true } } },
          orderBy: { code: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <EcranFlotte
      base="/gerant"
      vehicules={vehicules}
      modeles={modeles}
      peutAjouter={!membre.lectureSeule && (membre.boutiqueId !== null || membre.estAdmin)}
      lectureSeule={membre.lectureSeule}
      boutiques={boutiques.map((b) => ({ id: b.id, nom: b.store.name }))}
    />
  );
}
