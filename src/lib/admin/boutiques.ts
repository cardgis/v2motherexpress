/**
 * Boutiques et équipes — réservé à l'administrateur.
 *
 * ── Ouvrir une boutique ────────────────────────────────────────────────────
 * Une boutique V2 s'appuie sur un point de vente du catalogue (`Store`, qui
 * porte le stock par modèle) : les deux sont créés ensemble, dans une seule
 * transaction. Son CODE préfixe les références de contrat (LME-2026-DKR-0001)
 * et ne change plus jamais après la création : il est imprimé sur des actes.
 *
 * ── Nommer l'équipe ────────────────────────────────────────────────────────
 * Gérant ou commercial se connectent comme tout le monde, par code reçu sur
 * leur mobile ou leur e-mail : l'administrateur ne crée ni ne transmet aucun
 * mot de passe. Un identifiant déjà utilisé par un client qui a réservé est
 * refusé : un compte professionnel ne doit pas mélanger son propre dossier
 * avec les dossiers qu'il examine.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { analyserIdentifiant } from "@/lib/identifiant";
import { estViolationUnicite } from "@/lib/erreurs-prisma";
import { ROLES_EQUIPE } from "@/lib/roles";
import { ErreurAdmin } from "./erreurs";

// ---------------------------------------------------------------------------
// Saisies
// ---------------------------------------------------------------------------

export const schemaBoutique = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom de la boutique.").max(60, "Nom : 60 caractères maximum."),
  ville: z.string().trim().min(2, "Indiquez la ville.").max(60, "Ville : 60 caractères maximum."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Code : trois lettres, par exemple DKR."),
  adresse: z
    .string()
    .trim()
    .min(5, "Indiquez l’adresse de la boutique.")
    .max(160, "Adresse : 160 caractères maximum."),
  telephone: z.string().trim().min(6, "Indiquez le téléphone de la boutique.").max(32, "Téléphone invalide."),
  representantNom: z
    .string()
    .trim()
    .min(3, "Indiquez le représentant qui signe les actes.")
    .max(80, "Représentant : 80 caractères maximum."),
});

/** Le code n'est pas modifiable : il figure dans les références déjà émises. */
export const schemaModificationBoutique = schemaBoutique
  .omit({ code: true })
  .partial()
  .extend({ actif: z.boolean().optional() });

export const schemaMembre = z.object({
  identifiant: z.string().trim().min(3, "Indiquez le numéro de mobile ou l’e-mail.").max(254),
  nom: z.string().trim().min(3, "Indiquez le nom tel qu’il s’affichera.").max(80, "Nom : 80 caractères maximum."),
  role: z.enum(ROLES_EQUIPE, { message: "Choisissez gérant ou commercial." }),
});

export type SaisieBoutique = z.infer<typeof schemaBoutique>;
export type SaisieModificationBoutique = z.infer<typeof schemaModificationBoutique>;
export type SaisieMembre = z.infer<typeof schemaMembre>;

/** Téléphone d'une boutique : un fixe est accepté, contrairement à la connexion. */
function telephoneBoutique(saisie: string): string {
  const numero = parsePhoneNumberFromString(saisie, "SN");
  if (!numero?.isValid()) throw new ErreurAdmin("Numéro de téléphone invalide.", { champ: "telephone", statut: 400 });
  return numero.number;
}

function slugifier(texte: string): string {
  const slug = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "boutique";
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listerBoutiques() {
  const [boutiques, enCours] = await Promise.all([
    prisma.boutique.findMany({
      include: {
        store: { select: { name: true, city: true } },
        users: { where: { role: { in: [...ROLES_EQUIPE] } }, select: { role: true } },
        _count: { select: { vehicules: true } },
      },
      orderBy: [{ actif: "desc" }, { code: "asc" }],
    }),
    prisma.reservation.groupBy({ by: ["boutiqueId"], where: { statut: "ACTIVE" }, _count: { _all: true } }),
  ]);

  return boutiques.map((b) => ({
    id: b.id,
    code: b.code,
    nom: b.store.name,
    ville: b.store.city,
    adresse: b.adresse,
    actif: b.actif,
    gerants: b.users.filter((u) => u.role === "GERANT").length,
    commerciaux: b.users.filter((u) => u.role === "COMMERCIAL").length,
    motos: b._count.vehicules,
    enCours: enCours.find((e) => e.boutiqueId === b.id)?._count._all ?? 0,
  }));
}

export async function chargerBoutique(id: string) {
  const b = await prisma.boutique.findUnique({
    where: { id },
    include: {
      store: { select: { name: true, city: true } },
      users: {
        where: { role: { in: [...ROLES_EQUIPE] } },
        select: {
          id: true,
          role: true,
          nomAffichage: true,
          telephone: true,
          email: true,
          actif: true,
          lastLoginAt: true,
        },
        orderBy: [{ role: "desc" }, { nomAffichage: "asc" }],
      },
      _count: { select: { vehicules: true, reservations: true } },
    },
  });
  if (!b) return null;

  return {
    id: b.id,
    code: b.code,
    nom: b.store.name,
    ville: b.store.city ?? "",
    adresse: b.adresse,
    telephone: b.telephone,
    representantNom: b.representantNom,
    actif: b.actif,
    motos: b._count.vehicules,
    reservations: b._count.reservations,
    equipe: b.users,
  };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export async function creerBoutique(saisie: SaisieBoutique) {
  const telephone = telephoneBoutique(saisie.telephone);

  const codePris = await prisma.boutique.findUnique({ where: { code: saisie.code }, select: { id: true } });
  if (codePris) {
    throw new ErreurAdmin(`Le code ${saisie.code} est déjà celui d’une autre boutique.`, { champ: "code" });
  }

  const base = slugifier(saisie.nom);
  const slugPris = await prisma.store.findUnique({ where: { slug: base }, select: { id: true } });
  const slug = slugPris ? `${base}-${saisie.code.toLowerCase()}` : base;

  try {
    return await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { slug, name: saisie.nom, city: saisie.ville } });
      return tx.boutique.create({
        data: {
          storeId: store.id,
          code: saisie.code,
          adresse: saisie.adresse,
          telephone,
          representantNom: saisie.representantNom,
        },
        select: { id: true, code: true },
      });
    });
  } catch (erreur) {
    // Deux créations simultanées avec le même code : la base tranche.
    if (estViolationUnicite(erreur)) {
      throw new ErreurAdmin(`Le code ${saisie.code} ou ce nom est déjà utilisé.`, { champ: "code" });
    }
    throw erreur;
  }
}

export async function modifierBoutique(id: string, saisie: SaisieModificationBoutique) {
  const boutique = await prisma.boutique.findUnique({ where: { id }, select: { storeId: true } });
  if (!boutique) throw new ErreurAdmin("Boutique introuvable.", { statut: 404 });

  const telephone = saisie.telephone !== undefined ? telephoneBoutique(saisie.telephone) : undefined;

  await prisma.$transaction([
    prisma.store.update({
      where: { id: boutique.storeId },
      data: {
        name: saisie.nom,
        city: saisie.ville,
        // Une boutique fermée disparaît aussi des stocks affichés sur le site.
        isActive: saisie.actif,
      },
    }),
    prisma.boutique.update({
      where: { id },
      data: {
        adresse: saisie.adresse,
        telephone,
        representantNom: saisie.representantNom,
        actif: saisie.actif,
      },
    }),
  ]);
}

/**
 * Nomme un gérant ou un commercial, ou change le rôle ou la boutique d'un
 * membre existant. Ses sessions ouvertes sont révoquées : il se reconnecte
 * avec ses nouveaux droits.
 */
export async function nommerMembre(boutiqueId: string, saisie: SaisieMembre) {
  const identifiant = analyserIdentifiant(saisie.identifiant);
  if (!identifiant) {
    throw new ErreurAdmin(
      "Numéro de mobile ou adresse e-mail invalide. Pour un numéro étranger, " +
        "indiquez l'indicatif : +33 6 12 34 56 78.",
      { champ: "identifiant", statut: 400 },
    );
  }

  const boutique = await prisma.boutique.findUnique({ where: { id: boutiqueId }, select: { id: true } });
  if (!boutique) throw new ErreurAdmin("Boutique introuvable.", { statut: 404 });

  const cle = identifiant.type === "TELEPHONE" ? { telephone: identifiant.valeur } : { email: identifiant.valeur };

  return prisma.$transaction(async (tx) => {
    const existant = await tx.user.findUnique({
      where: cle,
      select: { id: true, role: true, customer: { select: { _count: { select: { reservations: true } } } } },
    });

    if (existant?.role === "ADMIN") {
      throw new ErreurAdmin("Cet identifiant est celui du compte administrateur.", { champ: "identifiant" });
    }
    if (existant?.role === "CLIENT" && (existant.customer?._count.reservations ?? 0) > 0) {
      throw new ErreurAdmin(
        "Cet identifiant appartient à un client qui a déjà réservé. Utilisez un autre numéro ou une autre adresse pour son compte professionnel.",
        { champ: "identifiant" },
      );
    }

    const droits = { role: saisie.role, boutiqueId, nomAffichage: saisie.nom, actif: true };

    return existant
      ? tx.user.update({
          where: { id: existant.id },
          data: { ...droits, versionSession: { increment: 1 } },
          select: { id: true, role: true },
        })
      : tx.user.create({ data: { ...cle, ...droits }, select: { id: true, role: true } });
  });
}

/** Retire un membre de l'équipe : il redevient un simple compte client. */
export async function retirerMembre(userId: string) {
  const membre = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!membre || (membre.role !== "GERANT" && membre.role !== "COMMERCIAL")) {
    throw new ErreurAdmin("Ce compte ne fait partie d’aucune équipe.", { statut: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: "CLIENT", boutiqueId: null, versionSession: { increment: 1 } },
  });
}
