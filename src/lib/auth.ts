/**
 * Sessions des comptes V2 — clients, gérants, administrateurs.
 *
 * Un seul système de session pour tous les profils, administrateur compris :
 * l'ancien accès au catalogue par e-mail et mot de passe a été retiré.
 *
 * ── Jeton ──────────────────────────────────────────────────────────────────
 * Payload signé en HMAC-SHA256 (clé dérivée de AUTH_SECRET), sans stockage
 * côté serveur : n'importe quelle instance le valide, ce qui permet de
 * multiplier les serveurs sans session partagée.
 *
 * ── Ce qui est relu en base à CHAQUE requête ────────────────────────────────
 * Le rôle, la boutique, l'état actif et la version de session. Un gérant
 * révoqué ou muté perd ses droits immédiatement ; une déconnexion invalide
 * tous les jetons émis auparavant, y compris un cookie volé.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleDerivee } from "@/lib/secrets";
import { accueilDuRole } from "@/lib/roles";
import type { Role } from "@/generated/prisma";

export const SESSION_COOKIE = "lme_session";

/**
 * Un client garde sa session un mois : il revient rarement, et se reconnecter
 * en 3G coûte. Un compte du back-office voit des pièces d'identité : sa
 * session est plus courte.
 */
const DUREE_JOURS: Record<Role, number> = { CLIENT: 30, GERANT: 7, COMMERCIAL: 7, ADMIN: 1 };

type Payload = { sub: string; exp: number; v: number };

export type Utilisateur = {
  id: string;
  telephone: string | null;
  email: string | null;
  role: Role;
  nomAffichage: string | null;
  boutiqueId: string | null;
  /** Le profil KYC n'existe qu'une fois le formulaire client entamé. */
  customerId: string | null;
  statutKyc: string | null;
};

// ---------------------------------------------------------------------------
// Jeton
// ---------------------------------------------------------------------------

const signer = (corps: string) =>
  createHmac("sha256", cleDerivee("session")).update(corps).digest("base64url");

export function creerJeton(user: { id: string; role: Role; versionSession: number }): string {
  const payload: Payload = {
    sub: user.id,
    exp: Date.now() + DUREE_JOURS[user.role] * 24 * 3_600_000,
    v: user.versionSession,
  };
  const corps = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${corps}.${signer(corps)}`;
}

export function verifierJeton(jeton?: string | null): Payload | null {
  if (!jeton || jeton.length > 512) return null;

  const [corps, signature, reste] = jeton.split(".");
  if (!corps || !signature || reste !== undefined) return null;

  const recue = Buffer.from(signature);
  const calculee = Buffer.from(signer(corps));
  if (recue.length !== calculee.length || !timingSafeEqual(recue, calculee)) return null;

  try {
    const payload = JSON.parse(Buffer.from(corps, "base64url").toString("utf-8")) as Payload;
    if (
      typeof payload?.sub !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.v !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lecture de la session
// ---------------------------------------------------------------------------

/** Retourne l'utilisateur connecté, ou `null`. Ne redirige pas. */
export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const payload = verifierJeton((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, actif: true, versionSession: payload.v },
    select: {
      id: true,
      telephone: true,
      email: true,
      role: true,
      nomAffichage: true,
      boutiqueId: true,
      customer: { select: { id: true, statutKyc: true } },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    telephone: user.telephone,
    email: user.email,
    role: user.role,
    nomAffichage: user.nomAffichage,
    boutiqueId: user.boutiqueId,
    customerId: user.customer?.id ?? null,
    statutKyc: user.customer?.statutKyc ?? null,
  };
}

/** Invalide tous les jetons émis pour ce compte, sur tous les appareils. */
export async function revoquerSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { versionSession: { increment: 1 } },
  });
}

/** Exige un compte connecté, quel que soit son rôle. */
export async function exigerUtilisateur(): Promise<Utilisateur> {
  const user = await utilisateurCourant();
  if (!user) redirect("/compte/connexion");
  return user;
}

export type MembreEquipe = Utilisateur & {
  estAdmin: boolean;
  /** Commercial : consulte, ne décide ni ne signe. */
  lectureSeule: boolean;
};

/**
 * Exige un membre de l'équipe — gérant, commercial ou administrateur — pour
 * les pages de CONSULTATION du back-office.
 *
 * Un gérant ou un commercial est toujours rattaché à une boutique : toute
 * requête du back-office doit filtrer sur `boutiqueId`. L'administrateur n'a
 * pas de boutique et voit l'ensemble — d'où `boutiqueId: null` dans son cas,
 * à traiter explicitement côté appelant.
 */
export async function exigerEquipe(): Promise<MembreEquipe> {
  const user = await utilisateurCourant();
  if (!user) redirect("/compte/connexion");
  if (user.role === "CLIENT") redirect("/compte");

  if (user.role !== "ADMIN" && !user.boutiqueId) {
    throw new Error(`Compte ${user.id} (${user.role}) sans boutique rattachée — accès refusé.`);
  }

  return { ...user, estAdmin: user.role === "ADMIN", lectureSeule: user.role === "COMMERCIAL" };
}

/**
 * Exige un gérant ou l'administrateur, pour les pages d'ACTION (retrait).
 * Un commercial est ramené au tableau de bord de sa boutique.
 */
export async function exigerGerant(): Promise<MembreEquipe> {
  const membre = await exigerEquipe();
  if (membre.lectureSeule) redirect("/gerant");
  return membre;
}

/**
 * Équivalent de `exigerGerant` pour les routes d'API : retourne `null` au lieu
 * de rediriger. Une redirection HTTP en réponse à un appel `fetch` produirait
 * un HTML de page de connexion là où le client attend du JSON.
 *
 * Toutes les routes qui MODIFIENT le back-office passent par ici : un
 * commercial y reçoit un refus, quelle que soit l'interface qu'il utilise.
 */
export async function exigerGerantApi(): Promise<Utilisateur | null> {
  const user = await utilisateurCourant();
  if (!user) return null;
  if (user.role !== "GERANT" && user.role !== "ADMIN") return null;
  if (user.role === "GERANT" && !user.boutiqueId) return null;
  return user;
}

/** Gérant ou commercial de CETTE boutique : droit de lecture sur ses documents. */
export function estEquipeDeLaBoutique(
  user: { role: Role; boutiqueId: string | null },
  boutiqueId: string,
): boolean {
  return (user.role === "GERANT" || user.role === "COMMERCIAL") && !!user.boutiqueId && user.boutiqueId === boutiqueId;
}

/**
 * Exige l'administrateur. Tout autre compte connecté retourne à son propre
 * espace, sans message : l'existence de l'administration n'a pas à être
 * signalée.
 */
export async function exigerAdmin(): Promise<Utilisateur> {
  const user = await utilisateurCourant();
  if (!user) redirect("/compte/connexion");
  if (user.role !== "ADMIN") redirect(accueilDuRole(user.role));
  return user;
}

export async function exigerAdminApi(): Promise<Utilisateur | null> {
  const user = await utilisateurCourant();
  return user?.role === "ADMIN" ? user : null;
}

/**
 * Clause `where` de cloisonnement à appliquer à toute requête du back-office.
 * Un gérant ne voit que sa boutique ; un admin voit tout.
 */
export function filtreBoutique(user: { role: Role; boutiqueId: string | null }) {
  return user.role === "ADMIN" ? {} : { boutiqueId: user.boutiqueId ?? "__aucune__" };
}

// ---------------------------------------------------------------------------
// Pose et retrait du cookie
// ---------------------------------------------------------------------------

export function optionsCookie(role: Role) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_JOURS[role] * 24 * 3_600,
  };
}
