import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utilisateurCourant } from "@/lib/auth";
import { etatDossier, schemaDossierPartiel, CHAMPS_COORDONNEES, CHAMPS_IDENTITE, identiteFigee } from "@/lib/dossier";

/**
 * Enregistrement progressif du dossier client.
 *
 * Appelée à chaque étape franchie du formulaire, et non une seule fois à la
 * fin : sur une connexion 3G instable, un client qui perd le réseau au
 * troisième écran ne doit pas avoir à tout ressaisir.
 *
 * Le corps est validé partiellement — on contrôle ce qui est envoyé sans
 * exiger que tout soit là. La complétude est vérifiée séparément, au moment
 * de la soumission.
 */
export async function PATCH(request: Request) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  try {
    const brut = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Les clés RÉELLEMENT envoyées, avant validation : certains champs ont une
    // valeur par défaut dans le schéma (`nationalite`) et apparaissent donc
    // toujours dans le résultat validé, même quand le client ne les envoie pas.
    // Se fier au résultat validé ferait passer toute requête pour une
    // modification d'identité.
    const clesEnvoyees = Object.keys(brut);

    const analyse = schemaDossierPartiel.safeParse(brut);
    if (!analyse.success) {
      const probleme = analyse.error.issues[0];
      return NextResponse.json(
        {
          error: probleme?.message ?? "Saisie invalide.",
          // Nom du champ fautif : le formulaire colore ce champ-là en rouge.
          champ: typeof probleme?.path[0] === "string" ? probleme.path[0] : null,
        },
        { status: 400 },
      );
    }

    const donnees = analyse.data;

    const existant = await prisma.customer.findUnique({
      where: { userId: user.id },
      select: { statutKyc: true },
    });

    // ── Ce qui reste modifiable, et ce qui ne l'est plus ───────────────────
    //
    // Une fois le dossier soumis au gérant, les champs qu'il confronte à la
    // pièce d'identité sont figés : les laisser changer romprait le lien
    // entre ce qui a été vérifié et ce qui figure sur le contrat.
    //
    // Les coordonnées, elles, restent modifiables. Un client qui déménage
    // doit pouvoir se mettre à jour sans appeler la boutique, et cela ne
    // touche aucun contrat déjà signé : `Contract.donnees` est un instantané.
    let aEcrire: Record<string, unknown> = donnees;

    if (identiteFigee(existant?.statutKyc)) {
      const identiteModifiee = CHAMPS_IDENTITE.filter((c) => clesEnvoyees.includes(c));

      if (identiteModifiee.length > 0) {
        return NextResponse.json(
          {
            error:
              existant?.statutKyc === "VALIDE"
                ? "Votre identité a été vérifiée par la boutique et ne peut plus être modifiée ici. Vos coordonnées, elles, restent modifiables."
                : "Votre dossier est en cours de vérification : votre identité n'est plus modifiable. Vos coordonnées, elles, restent modifiables.",
          },
          { status: 409 },
        );
      }

      aEcrire = Object.fromEntries(
        CHAMPS_COORDONNEES.filter((c) => clesEnvoyees.includes(c)).map((c) => [
          c,
          (donnees as Record<string, unknown>)[c],
        ]),
      );

      if (Object.keys(aEcrire).length === 0) {
        return NextResponse.json({ error: "Aucune modification applicable." }, { status: 409 });
      }
    }

    // Un dossier rejeté redevient modifiable, et repart de INCOMPLET.
    const statutKyc = existant?.statutKyc === "REJETE" ? "INCOMPLET" : undefined;

    const customer = await prisma.customer.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...donnees },
      update: { ...aEcrire, ...(statutKyc ? { statutKyc, kycMotifRejet: null } : {}) },
      include: { documents: { where: { purgeAt: null }, select: { type: true } } },
    });

    return NextResponse.json({
      etat: etatDossier(customer, customer.documents, { telephoneVerifie: !!user.telephone }),
    });
  } catch (error) {
    console.error("[dossier]", error);
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  }
}
