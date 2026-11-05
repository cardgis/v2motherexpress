import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utilisateurCourant } from "@/lib/auth";
import { etatDossier } from "@/lib/dossier";
import { adresseIp } from "@/lib/requete";

/**
 * Soumet le dossier à la vérification du gérant.
 *
 * C'est le seul chemin vers `A_VERIFIER`. La complétude est recontrôlée ici
 * côté serveur : le bouton peut très bien être activé de force dans le
 * navigateur, la barrière ne se trouve pas là.
 *
 * Le consentement au traitement des pièces d'identité (loi n° 2008-12) est
 * horodaté à cet instant précis.
 */
export async function POST(request: Request) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const consentement = body?.consentement === true;

    const customer = await prisma.customer.findUnique({
      where: { userId: user.id },
      include: { documents: { select: { type: true } } },
    });

    if (!customer) {
      return NextResponse.json({ error: "Aucun dossier à soumettre." }, { status: 404 });
    }
    if (customer.statutKyc === "A_VERIFIER") {
      return NextResponse.json({ error: "Votre dossier est déjà en cours de vérification." }, { status: 409 });
    }
    if (customer.statutKyc === "VALIDE") {
      return NextResponse.json({ error: "Votre dossier est déjà validé." }, { status: 409 });
    }

    if (!customer.consentementAt && !consentement) {
      return NextResponse.json(
        { error: "Votre accord est nécessaire pour que nous puissions traiter vos pièces." },
        { status: 400 },
      );
    }

    // Le consentement compte dans la complétude : on le pose avant le contrôle.
    const consentementAt = customer.consentementAt ?? new Date();
    const etat = etatDossier({ ...customer, consentementAt }, customer.documents, {
      telephoneVerifie: !!user.telephone,
    });

    if (!etat.complet) {
      return NextResponse.json(
        {
          error: "Votre dossier est incomplet.",
          etat,
        },
        { status: 400 },
      );
    }

    // Le dossier part en vérification, et toutes les réservations qui
    // l'attendaient avancent d'un cran, dans la même transaction.
    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: { statutKyc: "A_VERIFIER", consentementAt, kycMotifRejet: null },
      }),
      prisma.reservation.updateMany({
        where: { customerId: customer.id, statut: "EN_ATTENTE_DOSSIER" },
        data: { statut: "EN_ATTENTE_VALIDATION" },
      }),
    ]);

    // Jamais de numéro de pièce en clair dans les logs applicatifs.
    console.info(`[dossier] soumission ${customer.id} depuis ${adresseIp(request)}`);

    return NextResponse.json({ statutKyc: "A_VERIFIER", etat });
  } catch (error) {
    console.error("[dossier/soumettre]", error);
    return NextResponse.json({ error: "Soumission impossible." }, { status: 500 });
  }
}
