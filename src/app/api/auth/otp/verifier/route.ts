import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierCode, ErreurOtp } from "@/lib/otp";
import { analyserIdentifiant } from "@/lib/identifiant";
import { creerJeton, optionsCookie, SESSION_COOKIE } from "@/lib/auth";
import { adresseIp } from "@/lib/requete";
import { accueilDuRole } from "@/lib/roles";

/**
 * Vérifie le code et ouvre la session.
 *
 * Premier passage d'un identifiant : le compte CLIENT est créé à la volée. Il
 * n'y a pas d'inscription séparée — un téléphone ou un e-mail vérifié suffit
 * à ouvrir un espace. Les comptes GERANT, eux, sont créés par un
 * administrateur : ce point d'entrée ne peut jamais accorder autre chose que
 * le rôle CLIENT.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifiant = analyserIdentifiant(body?.identifiant ?? body?.telephone);
    const code = String(body?.code ?? "").trim();

    if (!identifiant || !code) {
      return NextResponse.json({ error: "Identifiant et code requis." }, { status: 400 });
    }

    await verifierCode({ destinataire: identifiant.valeur, code, but: "CONNEXION" });

    const maintenant = new Date();
    const selection = { id: true, role: true, actif: true, versionSession: true } as const;

    const user =
      identifiant.type === "TELEPHONE"
        ? await prisma.user.upsert({
            where: { telephone: identifiant.valeur },
            create: { telephone: identifiant.valeur, telVerifie: true, role: "CLIENT", lastLoginAt: maintenant },
            update: { telVerifie: true, lastLoginAt: maintenant },
            select: selection,
          })
        : await prisma.user.upsert({
            where: { email: identifiant.valeur },
            create: { email: identifiant.valeur, role: "CLIENT", lastLoginAt: maintenant },
            update: { lastLoginAt: maintenant },
            select: selection,
          });

    if (!user.actif) {
      return NextResponse.json({ error: "Ce compte est désactivé." }, { status: 403 });
    }

    // Chaque profil atterrit dans son espace : client, back-office, administration.
    const destination = accueilDuRole(user.role);

    const reponse = NextResponse.json({ destination, role: user.role });
    reponse.cookies.set(SESSION_COOKIE, creerJeton(user), optionsCookie(user.role));

    console.info(`[auth] connexion ${user.role} (${identifiant.type}) depuis ${adresseIp(request)}`);
    return reponse;
  } catch (error) {
    if (error instanceof ErreurOtp) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statutHttp });
    }
    console.error("[otp/verifier]", error);
    return NextResponse.json({ error: "Vérification impossible." }, { status: 500 });
  }
}
