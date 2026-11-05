import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigerUtilisateur } from "@/lib/auth";
import { creerJetonSignature, ErreurSignature } from "@/lib/contrats/signature";

/**
 * Passerelle vers la signature, pour un client déjà connecté.
 *
 * Le parcours de signature est authentifié par un lien opaque, conçu pour
 * arriver par WhatsApp sur un téléphone déconnecté. Un client déjà dans son
 * espace n'a aucune raison d'attendre ce message : on lui fabrique son propre
 * jeton et on l'envoie directement sur le même écran.
 *
 * Il n'existe donc qu'UNE implémentation de la signature, avec ses garde-fous
 * — code à usage unique, mention d'engagement, piste d'audit.
 */

export const dynamic = "force-dynamic";

export default async function SignerDepuisEspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await exigerUtilisateur();
  const { id } = await params;

  const contrat = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      statut: true,
      reservation: { select: { customer: { select: { userId: true } } } },
    },
  });

  // Un contrat qui n'est pas le sien n'existe pas : on ne révèle rien.
  if (!contrat || contrat.reservation.customer.userId !== user.id) redirect("/compte");

  // Déjà signé, ou pas encore prêt : l'espace personnel dit où en est le dossier.
  if (contrat.statut !== "A_SIGNER_CLIENT") redirect("/compte");

  try {
    const jeton = await creerJetonSignature(contrat.id);
    redirect(`/signer/${jeton}`);
  } catch (error) {
    // `redirect` lève une exception de contrôle que Next.js doit recevoir :
    // seule une vraie erreur de signature est rattrapée ici.
    if (error instanceof ErreurSignature) redirect("/compte");
    throw error;
  }
}
