import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utilisateurCourant } from "@/lib/auth";
import { ecrireBlob, supprimerBlob } from "@/lib/storage";
import { etatDossier } from "@/lib/dossier";
import { EXTENSIONS, typeReel } from "@/lib/fichiers";
import type { TypeDocument } from "@/generated/prisma";

/**
 * Dépôt d'une pièce justificative.
 *
 * Le fichier est chiffré puis déposé dans un stockage privé dont aucune URL
 * n'est jamais exposée : la lecture passe exclusivement par
 * `/api/documents/[id]`, qui contrôle l'autorisation avant de relayer les
 * octets.
 *
 * Le type retenu est celui des OCTETS, jamais celui annoncé par le navigateur
 * (voir `src/lib/fichiers.ts`). L'empreinte SHA-256 est conservée : elle
 * permet de détecter qu'une pièce aurait été remplacée après validation.
 */

const TYPES_ACCEPTES: TypeDocument[] = [
  "PIECE_RECTO",
  "PIECE_VERSO",
  "PERMIS_RECTO",
  "PERMIS_VERSO",
  "JUSTIFICATIF_DOMICILE",
  "SELFIE",
];

/** Le navigateur compresse avant l'envoi ; cette limite est un filet de sécurité. */
const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await utilisateurCourant();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  // Refus AVANT de lire le corps : sinon un envoi de plusieurs centaines de
  // Mo serait chargé intégralement en mémoire avant d'être rejeté.
  const annonce = Number(request.headers.get("content-length") ?? 0);
  if (annonce > TAILLE_MAX_OCTETS + 64 * 1024) {
    return NextResponse.json({ error: "Fichier trop lourd (8 Mo maximum)." }, { status: 413 });
  }

  try {
    const formulaire = await request.formData();
    const type = String(formulaire.get("type") ?? "") as TypeDocument;
    const fichier = formulaire.get("fichier");

    if (!TYPES_ACCEPTES.includes(type)) {
      return NextResponse.json({ error: "Type de document inconnu." }, { status: 400 });
    }
    if (!(fichier instanceof File) || fichier.size === 0) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      return NextResponse.json(
        { error: "Fichier trop lourd (8 Mo maximum). Reprenez la photo avec moins de détail." },
        { status: 413 },
      );
    }

    const octets = new Uint8Array(await fichier.arrayBuffer());
    const mimeType = typeReel(octets);
    if (!mimeType) {
      return NextResponse.json(
        { error: "Format non accepté. Envoyez une photo (JPEG, PNG, WebP, HEIC) ou un PDF." },
        { status: 415 },
      );
    }

    const customer = await prisma.customer.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true, statutKyc: true },
    });

    if (customer.statutKyc === "VALIDE" || customer.statutKyc === "A_VERIFIER") {
      return NextResponse.json(
        { error: "Votre dossier est en vérification ou validé : les pièces ne peuvent plus être modifiées." },
        { status: 409 },
      );
    }

    const chemin = `clients/${customer.id}/${type.toLowerCase()}-${Date.now()}.${EXTENSIONS[mimeType]}`;
    const { sha256, taille } = await ecrireBlob(chemin, octets, mimeType);

    // Un même type ne peut exister qu'une fois : le nouveau dépôt remplace
    // l'ancien, dont le blob est supprimé pour ne pas laisser traîner une
    // pièce d'identité orpheline dans le stockage.
    const { document, ancien } = await prisma.$transaction(async (tx) => {
      const ancien = await tx.customerDocument.findFirst({
        where: { customerId: customer.id, type },
        select: { id: true, blobPath: true },
      });
      if (ancien) await tx.customerDocument.delete({ where: { id: ancien.id } });

      const document = await tx.customerDocument.create({
        data: {
          customerId: customer.id,
          type,
          blobPath: chemin,
          mimeType,
          tailleOctets: taille,
          sha256,
        },
        select: { id: true, type: true, mimeType: true, uploadedAt: true },
      });
      return { document, ancien };
    });

    if (ancien) {
      // Après la transaction : mieux vaut un blob orphelin qu'une ligne
      // pointant vers un fichier déjà effacé.
      await supprimerBlob(ancien.blobPath).catch((e) =>
        console.error("[documents] blob non supprimé", e),
      );
    }

    const apres = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: { documents: { where: { purgeAt: null }, select: { type: true } } },
    });

    return NextResponse.json(
      { document, etat: etatDossier(apres, apres.documents, { telephoneVerifie: !!user.telephone }) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[documents]", error);
    return NextResponse.json({ error: "Envoi impossible." }, { status: 500 });
  }
}
