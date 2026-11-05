/**
 * Contrôle du générateur de références.
 *
 * 1. Concurrence — le risque n'est pas visible en usage séquentiel : il
 *    n'apparaît que si deux clients valident leur réservation dans la même
 *    fraction de seconde. On déclenche 60 générations réellement simultanées
 *    sur deux boutiques et on vérifie qu'aucune référence n'est produite deux
 *    fois.
 * 2. Reprise sur collision — un compteur en retard (restauration de
 *    sauvegarde, intervention manuelle) ne doit jamais faire échouer une
 *    réservation. Testé avec une VRAIE collision levée par PostgreSQL.
 *
 * Tout se passe sur des boutiques et un client TEMPORAIRES, créés puis
 * supprimés ici : les données réelles ne sont jamais touchées. (Une version
 * précédente remettait les vrais compteurs à zéro, ce qui faisait ensuite
 * échouer les réservations sur des références déjà attribuées.)
 *
 *   npm run verif:reference
 */

import "./env-local";

import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma";
import { creerAvecReference, prochaineReference } from "../src/lib/reference";

const PAR_BOUTIQUE = 30;
const PREFIXE = "verif-reference-";

let ko = 0;
function verifie(libelle: string, condition: boolean, detail = "") {
  if (!condition) ko++;
  console.log(`  ${condition ? "OK  " : "KO  "} ${libelle}${condition || !detail ? "" : ` (${detail})`}`);
}

/** Supprime tout ce que ce script a pu créer, y compris lors d'un lancement interrompu. */
async function nettoyer() {
  await prisma.reservation.deleteMany({
    where: { boutique: { store: { slug: { startsWith: PREFIXE } } } },
  });
  // Le Store emporte en cascade la boutique et ses compteurs ; le User, le client.
  await prisma.store.deleteMany({ where: { slug: { startsWith: PREFIXE } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIXE } } });
}

async function boutiqueTemporaire(n: number) {
  const suffixe = randomBytes(3).toString("hex").toUpperCase();
  const store = await prisma.store.create({
    data: { slug: `${PREFIXE}${n}-${suffixe}`, name: `Vérification ${n}` },
  });
  return prisma.boutique.create({
    data: {
      storeId: store.id,
      code: `V${n}${suffixe}`,
      adresse: "Boutique de test",
      telephone: "+221770000000",
      representantNom: "TEST Vérification",
    },
    select: { id: true, code: true },
  });
}

async function clientTemporaire() {
  const user = await prisma.user.create({
    data: { email: `${PREFIXE}${randomBytes(4).toString("hex")}@exemple.invalid` },
    select: { id: true },
  });
  return prisma.customer.create({ data: { userId: user.id }, select: { id: true } });
}

async function main() {
  await nettoyer();
  const compteursReels = await prisma.compteurReference.findMany({ orderBy: { id: "asc" } });

  try {
    const boutiques = [await boutiqueTemporaire(1), await boutiqueTemporaire(2)];

    // ── Concurrence ────────────────────────────────────────────────────────
    console.log(`\nGénération de ${PAR_BOUTIQUE} références simultanées par boutique…\n`);

    const references = await Promise.all(
      boutiques.flatMap((b) => Array.from({ length: PAR_BOUTIQUE }, () => prochaineReference(b.id))),
    );

    const uniques = new Set(references);
    verifie(`${references.length} références générées, toutes distinctes`, uniques.size === references.length);

    for (const b of boutiques) {
      const siennes = references
        .filter((r) => r.includes(`-${b.code}-`))
        .map((r) => Number(r.split("-").at(-1)))
        .sort((x, y) => x - y);
      const attendue = Array.from({ length: PAR_BOUTIQUE }, (_, i) => i + 1);
      verifie(
        `${b.code} : séquence continue 0001→${String(PAR_BOUTIQUE).padStart(4, "0")}`,
        JSON.stringify(siennes) === JSON.stringify(attendue),
        siennes.join(","),
      );
    }

    // ── Vraie collision en base ────────────────────────────────────────────
    console.log("\nReprise sur un compteur en retard…\n");

    const b = boutiques[1]!;
    const client = await clientTemporaire();
    const produit = await prisma.produit.findFirstOrThrow({ select: { id: true } });
    const reserver = (reference: string) =>
      prisma.reservation.create({
        data: {
          reference,
          customerId: client.id,
          boutiqueId: b.id,
          produitId: produit.id,
          formule: "VENTE_ECHELONNEE",
          montantTotal: 0,
        },
        select: { reference: true },
      });

    for (let i = 0; i < 3; i++) await creerAvecReference(b.id, reserver); // 0031 → 0033

    // Restauration simulée : le compteur revient à 30 alors que 0033 existe.
    await prisma.compteurReference.updateMany({ where: { boutiqueId: b.id }, data: { dernier: 30 } });

    const { reference } = await creerAvecReference(b.id, reserver);
    verifie("collision réelle levée par PostgreSQL → numéro libre obtenu", reference.endsWith("-0034"), reference);

    const { dernier } = await prisma.compteurReference.findFirstOrThrow({
      where: { boutiqueId: b.id },
      select: { dernier: true },
    });
    verifie("le compteur a rattrapé la plus haute référence", dernier === 34, String(dernier));

    // ── Bornes de la reprise ───────────────────────────────────────────────
    let propagee = false;
    try {
      await creerAvecReference(b.id, async () => {
        throw new Error("panne sans rapport");
      });
    } catch (e) {
      propagee = e instanceof Error && e.message === "panne sans rapport";
    }
    verifie("une autre erreur remonte immédiatement, sans nouvelle tentative", propagee);

    let appels = 0;
    let abandon = false;
    try {
      await creerAvecReference(b.id, async () => {
        appels++;
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`reference`)", {
          code: "P2002",
          clientVersion: "verification",
        });
      });
    } catch {
      abandon = true;
    }
    verifie("collisions sans fin : abandon après 5 tentatives, pas de boucle infinie", abandon && appels === 5, `${appels} appels`);
  } finally {
    await nettoyer();
  }

  // ── Les données réelles n'ont pas bougé ──────────────────────────────────
  const apres = await prisma.compteurReference.findMany({ orderBy: { id: "asc" } });
  verifie("compteurs des vraies boutiques intacts", JSON.stringify(apres) === JSON.stringify(compteursReels));

  console.log(`\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "ÉCHECS DÉTECTÉS"}\n`);
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await nettoyer().catch(() => undefined);
  process.exit(1);
});
