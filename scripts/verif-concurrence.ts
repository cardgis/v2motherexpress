/**
 * Concurrence — deux gérants qui attribuent la même moto au même instant.
 *
 *   npm run verif:concurrence
 *
 * ── Pourquoi ce script existe ──────────────────────────────────────────────
 * L'attribution d'un véhicule repose sur un `updateMany` conditionné à
 * `statut: "DISPONIBLE"`, qui échoue si `count !== 1`. La garantie ne vient donc
 * PAS du code applicatif mais du verrouillage de ligne de PostgreSQL : le
 * premier écrivain verrouille, les autres attendent puis réévaluent la
 * condition, qui est devenue fausse.
 *
 * C'était jusqu'ici la seule protection du système éprouvée par le seul
 * raisonnement. Deux gérants promettant la même machine au même client ne se
 * découvre pas en relisant du code : il faut provoquer la course.
 *
 * ── Données temporaires ────────────────────────────────────────────────────
 * Le script crée sa propre moto, la fait disputer, puis la supprime. Il ne
 * touche jamais à la flotte réelle, même en cas d'échec — le nettoyage est en
 * `finally`.
 */

// `.env.local` UNIQUEMENT : ce script écrit en base.
import "./env-local";

import { prisma } from "../src/lib/prisma";

const CONCURRENTS = 8;

let ok = 0;
let ko = 0;

function verifie(libelle: string, obtenu: unknown, attendu: unknown) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "OK  " : "KO  "} ${libelle}`);
  if (!bon) console.log(`       attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

async function main() {
  const boutique = await prisma.boutique.findFirst({ select: { id: true } });
  const produits = await prisma.produit.findMany({ select: { id: true }, take: 2 });

  if (!boutique || produits.length < 2) {
    console.error("\nIl faut une boutique et deux modèles en base. Lancez `npm run seed:v2`.\n");
    process.exit(1);
  }

  const [produit, autreProduit] = produits as [{ id: string }, { id: string }];
  const marque = `CONCURRENCE-${Date.now()}`;

  const moto = await prisma.vehicule.create({
    data: {
      boutiqueId: boutique.id,
      produitId: produit.id,
      numeroChassis: marque,
      statut: "DISPONIBLE",
    },
    select: { id: true },
  });

  try {
    console.log(`\n=== ${CONCURRENTS} gérants attribuent LA MÊME moto au même instant ===\n`);

    // La course : toutes les requêtes partent ensemble, sur la même ligne.
    const prises = await Promise.all(
      Array.from({ length: CONCURRENTS }, () =>
        prisma.vehicule.updateMany({
          where: { id: moto.id, boutiqueId: boutique.id, produitId: produit.id, statut: "DISPONIBLE" },
          data: { statut: "RESERVE" },
        }),
      ),
    );

    const gagnants = prises.filter((p) => p.count === 1).length;
    const perdants = prises.filter((p) => p.count === 0).length;

    verifie("UN SEUL gérant obtient la moto", gagnants, 1);
    verifie(`les ${CONCURRENTS - 1} autres repartent les mains vides`, perdants, CONCURRENTS - 1);

    const apres = await prisma.vehicule.findUnique({
      where: { id: moto.id },
      select: { statut: true },
    });
    verifie("la moto est RESERVE, une seule fois", apres?.statut, "RESERVE");

    // Une moto déjà prise ne se reprend pas, même par un second passage.
    const reprise = await prisma.vehicule.updateMany({
      where: { id: moto.id, statut: "DISPONIBLE" },
      data: { statut: "RESERVE" },
    });
    verifie("une moto déjà réservée ne se reprend pas", reprise.count, 0);

    // Le garde-fou de modèle : la condition porte aussi sur `produitId`, sans
    // quoi un gérant pourrait remettre une machine d'un autre modèle que celui
    // que le client a réservé — et le contrat imprimerait le mauvais véhicule.
    await prisma.vehicule.update({ where: { id: moto.id }, data: { statut: "DISPONIBLE" } });
    const mauvaisModele = await prisma.vehicule.updateMany({
      where: { id: moto.id, produitId: autreProduit.id, statut: "DISPONIBLE" },
      data: { statut: "RESERVE" },
    });
    verifie("une moto d'un AUTRE modèle est refusée", mauvaisModele.count, 0);

    const intacte = await prisma.vehicule.findUnique({
      where: { id: moto.id },
      select: { statut: true },
    });
    verifie("après un refus, la moto reste disponible", intacte?.statut, "DISPONIBLE");
  } finally {
    // Nettoyage systématique : la flotte réelle ne garde aucune trace du test.
    await prisma.vehicule.delete({ where: { id: moto.id } });
    const reste = await prisma.vehicule.count({ where: { numeroChassis: marque } });
    verifie("la moto de test a été supprimée", reste, 0);
  }

  console.log(`\n${ko === 0 ? "TOUS LES CONTRÔLES PASSENT" : "ÉCHECS DÉTECTÉS"} — ${ok} OK, ${ko} KO\n`);
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

main().catch(async (erreur) => {
  console.error(erreur);
  await prisma.$disconnect();
  process.exit(1);
});
