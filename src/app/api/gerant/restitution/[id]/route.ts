import { NextResponse } from "next/server";
import { exigerGerantApi } from "@/lib/auth";
import { enregistrerRestitution, ErreurRestitution } from "@/lib/restitution";
import { decoderTracePng } from "@/lib/fichiers";
import { adresseIp } from "@/lib/requete";
import type { EtatAccessoires, EtatRestitution, MotifRestitution } from "@/generated/prisma";

/**
 * Clôture d'un contrat : constat de restitution signé sur place.
 *
 * Les deux tracés sont reçus du navigateur, contrairement au constat de remise
 * qui reprend ceux du contrat : ici, le client signe devant la moto, c'est ce
 * qui rend les dégâts constatés opposables.
 */

type Contexte = { params: Promise<{ id: string }> };

const ETATS: EtatRestitution[] = ["BON_ETAT", "USURE_NORMALE", "DEGRADATIONS"];
const ACCESSOIRES: EtatAccessoires[] = ["COMPLETS", "MANQUANTS"];
const MOTIFS: MotifRestitution[] = [
  "FIN_NORMALE",
  "RUPTURE_ANTICIPEE",
  "DEFAUT_DE_PAIEMENT",
  "AUTRE",
];

function etat(valeur: unknown, defaut: EtatRestitution): EtatRestitution {
  return ETATS.includes(valeur as EtatRestitution) ? (valeur as EtatRestitution) : defaut;
}

/** Montant en FCFA entiers, ou rien. Jamais de négatif, jamais de flottant. */
function montant(valeur: unknown): number | null {
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function POST(request: Request, { params }: Contexte) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    const heure = String(body?.heureRestitution ?? "").trim();
    if (!/^\d{1,2}\s*h\s*\d{0,2}$/i.test(heure)) {
      return NextResponse.json(
        { error: "Indiquez l'heure de restitution, au format 14h30." },
        { status: 400 },
      );
    }

    // Les deux tracés sont exigés : un constat contradictoire sans la signature
    // du client ne prouve rien de ce qu'on lui oppose.
    const traceGerant = decoderTracePng(body?.traceGerant);
    if (!traceGerant.ok) {
      return NextResponse.json({ error: `Signature du gérant : ${traceGerant.erreur}` }, { status: 400 });
    }

    const traceClient = decoderTracePng(body?.traceClient);
    if (!traceClient.ok) {
      return NextResponse.json({ error: `Signature du client : ${traceClient.erreur}` }, { status: 400 });
    }

    const compteur = Number(body?.compteurKm);
    const batterie = Number(body?.niveauBatterie);

    const resultat = await enregistrerRestitution({
      gerant,
      reservationId: id,
      ip: adresseIp(request),
      traces: { gerant: traceGerant.png, client: traceClient.png },
      saisie: {
        motif: MOTIFS.includes(body?.motif) ? body.motif : "FIN_NORMALE",
        motifPrecision: body?.motifPrecision ? String(body.motifPrecision) : undefined,
        heureRestitution: heure,
        compteurKm: Number.isFinite(compteur) && compteur >= 0 ? Math.round(compteur) : null,
        niveauBatterie:
          Number.isFinite(batterie) && batterie >= 0 && batterie <= 100
            ? Math.round(batterie)
            : null,
        carrosserie: etat(body?.carrosserie, "BON_ETAT"),
        freinsPneus: etat(body?.freinsPneus, "BON_ETAT"),
        batterieChargeur: etat(body?.batterieChargeur, "BON_ETAT"),
        accessoires: ACCESSOIRES.includes(body?.accessoires) ? body.accessoires : "COMPLETS",
        accessoiresPrecision: body?.accessoiresPrecision
          ? String(body.accessoiresPrecision)
          : undefined,
        dommagesConstates: body?.dommagesConstates === true,
        dommagesPrecision: body?.dommagesPrecision ? String(body.dommagesPrecision) : undefined,
        coutReparations: montant(body?.coutReparations),
        observations: body?.observations ? String(body.observations) : undefined,
      },
    });

    return NextResponse.json({
      statut: "ARRETEE",
      empreintePv: resultat.empreinte,
      pages: resultat.pages,
      totalDu: resultat.totalDu,
    });
  } catch (error) {
    if (error instanceof ErreurRestitution) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[gerant/restitution]", error);
    return NextResponse.json({ error: "Opération impossible." }, { status: 500 });
  }
}
