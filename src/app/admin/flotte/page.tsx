import type { Metadata } from "next";
import { exigerAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listerFlotte, modelesDisponibles } from "@/lib/gerant/flotte";
import EcranFlotte from "@/components/gerant/EcranFlotte";

export const metadata: Metadata = {
  title: "Flotte — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Flotte de toutes les boutiques, depuis l'administration.
 *
 * Même écran que celui du back-office : l'administrateur y ajoute une moto en
 * choisissant sa boutique. Il y arrive depuis une fiche de dossier, quand
 * aucune moto du modèle réservé n'est disponible.
 */
export default async function FlotteAdminPage() {
  const admin = await exigerAdmin();

  const [vehicules, modeles, boutiques] = await Promise.all([
    listerFlotte(admin),
    modelesDisponibles(),
    prisma.boutique.findMany({
      where: { actif: true },
      select: { id: true, store: { select: { name: true } } },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <EcranFlotte
      base="/admin"
      vehicules={vehicules}
      modeles={modeles}
      peutAjouter
      lectureSeule={false}
      boutiques={boutiques.map((b) => ({ id: b.id, nom: b.store.name }))}
    />
  );
}
