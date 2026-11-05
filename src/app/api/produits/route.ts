import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Catalogue public : lecture seule.
 *
 * Cette route exposait aussi POST, PATCH et DELETE, copies exactes de
 * `/api/admin/produits` que plus aucun écran n'appelait. Une route d'écriture
 * inutilisée reste une surface d'attaque : l'administration du catalogue
 * passe désormais uniquement par `/api/admin/produits`.
 */
export async function GET() {
  const produits = await prisma.produit.findMany({
    where: { estActif: true },
    include: { tarification: true },
    orderBy: { tarification: { prixVenteFcfa: "asc" } },
  });

  return NextResponse.json(produits);
}
