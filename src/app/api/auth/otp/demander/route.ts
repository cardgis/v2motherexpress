import { NextResponse } from "next/server";
import { demanderCode, ErreurOtp } from "@/lib/otp";
import { analyserIdentifiant } from "@/lib/identifiant";
import { masquerIdentifiant } from "@/lib/phone";
import { adresseIp } from "@/lib/requete";

/**
 * Vercel coupe une fonction à 10 s par défaut. Or l'envoi Dexchange prend
 * jusqu'à 25 s — son API parle à l'opérateur avant de répondre — et un délai
 * dépassé N'ANNULE PAS le SMS déjà lancé : le client recevrait un code que
 * `demanderCode` vient d'invalider en voyant l'échec. Sans cette ligne, le
 * correctif de `DELAI_DEXCHANGE_MS` serait annulé par la plateforme.
 */
export const maxDuration = 60;

/**
 * Demande d'un code de connexion, par SMS ou par e-mail selon l'identifiant.
 *
 * La réponse est la même, qu'un compte existe ou non pour cet identifiant :
 * elle ne permet pas de savoir qui est client de La Mother Express.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    // `telephone` : ancien nom du champ, accepté pour compatibilité.
    const identifiant = analyserIdentifiant(body?.identifiant ?? body?.telephone);

    if (!identifiant) {
      return NextResponse.json(
        {
          error:
            "Identifiant invalide. Saisissez un numéro de mobile (77 123 45 67, ou avec " +
            "l'indicatif pour un numéro étranger : +33 6 12 34 56 78) ou une adresse e-mail.",
        },
        { status: 400 },
      );
    }

    const { expiresAt, canal, codeDeDeveloppement } = await demanderCode({
      identifiant,
      but: "CONNEXION",
      ip: adresseIp(request),
    });

    return NextResponse.json({
      // Masqué : l'écran suivant le rappelle sans qu'un identifiant complet
      // ne transite dans une réponse d'API.
      destinataireMasque: masquerIdentifiant(identifiant.valeur),
      type: identifiant.type,
      expiresAt: expiresAt.toISOString(),
      canal,
      // Uniquement avec un driver de développement, qui n'envoie rien.
      codeDeDeveloppement,
    });
  } catch (error) {
    if (error instanceof ErreurOtp) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statutHttp });
    }
    console.error("[otp/demander]", error);
    return NextResponse.json({ error: "Envoi du code impossible." }, { status: 500 });
  }
}
