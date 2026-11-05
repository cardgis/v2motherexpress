import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigerGerantApi } from "@/lib/auth";
import { genererBrouillon, ErreurGeneration, ErreurSnapshot } from "@/lib/contrats";
import { MODES_PAIEMENT } from "@/lib/modes-paiement";

/**
 * Génère le contrat pré-rempli d'une réservation.
 *
 * Réservé au gérant : c'est un acte engageant, il ne se déclenche pas depuis
 * l'espace client. Le périmètre de boutique est vérifié ici même — un gérant
 * de Mbour ne peut pas produire un contrat pour un dossier de Thiès.
 *
 * ── Convention des champs saisis ───────────────────────────────────────────
 * Champ ABSENT      → la valeur enregistrée n'est pas touchée.
 * Chaîne VIDE       → la saisie est effacée : l'acte retombe sur la fiche
 *                     véhicule ou le catalogue, puis sur « Néant ».
 * Les longueurs sont bornées : ces valeurs s'impriment sur un acte d'une page
 * dont la mise en page ne supporte pas un texte arbitraire.
 */

const schema = z.object({
  reservationId: z.string().min(1).max(64),
  dateDebut: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date de prise d'effet invalide.")
    .optional(),
  dateSignature: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date de signature invalide.")
    .optional(),
  modele: z.string().max(80, "Marque / modèle : 80 caractères maximum.").optional(),
  numeroSerie: z.string().max(60, "Numéro de série : 60 caractères maximum.").optional(),
  immatriculation: z.string().max(30, "Immatriculation : 30 caractères maximum.").optional(),
  redevanceJournaliere: z.union([z.string().max(15), z.number()]).optional(),
  // Liste fermée : une valeur inconnue est refusée, jamais imprimée.
  modesPaiement: z
    .array(z.enum(MODES_PAIEMENT, { message: "Mode de paiement inconnu." }))
    .max(MODES_PAIEMENT.length)
    .optional(),

  // ── Vente échelonnée ───────────────────────────────────────────────────
  // Le prix commande l'échéancier : une valeur hors barème serait refusée par
  // `appliquerValeursGerant`, qui exige un montant positif.
  prixVente: z.union([z.string().max(15), z.number()]).optional(),
  // Liste fermée de deux valeurs : l'article 9 n'en propose pas d'autre.
  etatVente: z.enum(["NEUF", "OCCASION"], { message: "État du véhicule inconnu." }).optional(),

  // ── Location journalière ───────────────────────────────────────────────
  // Heures saisies telles qu'elles s'impriment sur l'acte : « 08h30 ».
  heureDepart: z.string().max(10, "Heure de départ : 10 caractères maximum.").optional(),
  heureRetour: z.string().max(10, "Heure de retour : 10 caractères maximum.").optional(),
  caution: z.union([z.string().max(15), z.number()]).optional(),
  limiteKm: z.union([z.string().max(10), z.number()]).optional(),
  forfaitKmSupp: z.union([z.string().max(15), z.number()]).optional(),
  zoneUtilisation: z.string().max(120, "Zone d'utilisation : 120 caractères maximum.").optional(),
  etatGeneral: z.string().max(200, "État général : 200 caractères maximum.").optional(),
});

function lireDate(saisie: string | undefined): Date | undefined | "invalide" {
  if (!saisie) return undefined;
  const date = new Date(`${saisie}T00:00:00Z`);
  const annee = date.getUTCFullYear();
  if (Number.isNaN(date.getTime()) || annee < 2020 || annee > 2100) return "invalide";
  return date;
}

/**
 * `undefined` laisse la valeur calculée, une chaîne vide l'efface. Les
 * séparateurs de milliers saisis à la main sont retirés — « 2 500 » et
 * « 2500 » doivent donner le même montant.
 */
function lireMontant(saisie: string | number | undefined): number | null | undefined {
  if (saisie === undefined) return undefined;
  if (typeof saisie === "number") return saisie;
  const chiffres = saisie.replace(/[^0-9]/g, "");
  return chiffres === "" ? null : Number(chiffres);
}

export async function POST(request: Request) {
  const gerant = await exigerGerantApi();
  if (!gerant) {
    return NextResponse.json({ error: "Accès réservé au back-office." }, { status: 403 });
  }

  try {
    const analyse = schema.safeParse(await request.json().catch(() => ({})));
    if (!analyse.success) {
      return NextResponse.json(
        { error: analyse.error.issues[0]?.message ?? "Saisie invalide." },
        { status: 400 },
      );
    }
    const saisie = analyse.data;

    const dateDebut = lireDate(saisie.dateDebut);
    if (dateDebut === "invalide") {
      return NextResponse.json({ error: "Date de prise d'effet invalide." }, { status: 400 });
    }

    const dateSignature = lireDate(saisie.dateSignature);
    if (dateSignature === "invalide") {
      return NextResponse.json({ error: "Date de signature invalide." }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: saisie.reservationId },
      select: { boutiqueId: true },
    });

    // Cloisonnement — même réponse qu'un dossier inexistant.
    if (!reservation || (gerant.role !== "ADMIN" && reservation.boutiqueId !== gerant.boutiqueId)) {
      return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
    }

    const { contract, empreinte, pages } = await genererBrouillon(saisie.reservationId, {
      acteurUserId: gerant.id,
      dateDebut,
      dateSignature,
      modele: saisie.modele,
      numeroSerie: saisie.numeroSerie,
      immatriculation: saisie.immatriculation,
      redevanceJournaliere: lireMontant(saisie.redevanceJournaliere),
      modesPaiement: saisie.modesPaiement,
      prixVente: lireMontant(saisie.prixVente),
      etatVente: saisie.etatVente,
      heureDepart: saisie.heureDepart,
      heureRetour: saisie.heureRetour,
      caution: lireMontant(saisie.caution),
      limiteKm: lireMontant(saisie.limiteKm),
      forfaitKmSupp: lireMontant(saisie.forfaitKmSupp),
      zoneUtilisation: saisie.zoneUtilisation,
      etatGeneral: saisie.etatGeneral,
    });

    return NextResponse.json({
      contratId: contract.id,
      reference: contract.reference,
      statut: contract.statut,
      pages,
      empreinte,
    });
  } catch (error) {
    if (error instanceof ErreurGeneration || error instanceof ErreurSnapshot) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[contrats]", error);
    return NextResponse.json({ error: "Génération impossible." }, { status: 500 });
  }
}
