/**
 * Désigne LE compte administrateur de La Mother Express.
 *
 *   npm run admin:designer -- "77 123 45 67" "Prénom NOM"
 *   npm run admin:designer -- direction@lamotherexpress.com "Prénom NOM"
 *
 * Il n'existe qu'un administrateur : le compte désigné prend le rôle, et tout
 * autre compte administrateur redevient un simple compte client, ses sessions
 * révoquées. L'opération est sérialisée par un verrou en base : deux
 * désignations lancées au même instant ne peuvent pas laisser deux admins.
 *
 * L'administrateur se connecte ensuite comme tout le monde, par un code reçu
 * sur ce mobile ou à cette adresse : aucun mot de passe n'est créé.
 *
 * Base LOCALE uniquement (`.env.local`), comme tous les scripts du projet.
 */

import "./env-local";
import { prisma } from "../src/lib/prisma";
import { analyserIdentifiant } from "../src/lib/identifiant";

async function main() {
  const [saisie, ...mots] = process.argv.slice(2);
  const nom = mots.join(" ").trim() || "Administrateur";
  const identifiant = analyserIdentifiant(saisie);

  if (!identifiant) {
    console.error('Usage : npm run admin:designer -- "<mobile ou e-mail>" "Prénom NOM"');
    process.exit(1);
  }

  const cle = identifiant.type === "TELEPHONE" ? { telephone: identifiant.valeur } : { email: identifiant.valeur };

  const { admin, retires } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('lme:designation-administrateur'))`;

    const existant = await tx.user.findUnique({
      where: cle,
      select: { id: true, customer: { select: { _count: { select: { reservations: true } } } } },
    });

    if ((existant?.customer?._count.reservations ?? 0) > 0) {
      throw new Error(
        "Cet identifiant est celui d'un client qui a réservé : utilisez un mobile ou une adresse réservés à l'administration.",
      );
    }

    const droits = { role: "ADMIN" as const, boutiqueId: null, nomAffichage: nom, actif: true };
    const admin = existant
      ? await tx.user.update({
          where: { id: existant.id },
          data: { ...droits, versionSession: { increment: 1 } },
          select: { id: true },
        })
      : await tx.user.create({ data: { ...cle, ...droits }, select: { id: true } });

    const anciens = await tx.user.updateMany({
      where: { role: "ADMIN", id: { not: admin.id } },
      data: { role: "CLIENT", versionSession: { increment: 1 } },
    });

    return { admin, retires: anciens.count };
  });

  console.log(`✓ Administrateur : ${nom} (${identifiant.valeur}) — compte ${admin.id}`);
  if (retires > 0) console.log(`  ${retires} ancien(s) administrateur(s) redevenu(s) client, sessions révoquées.`);
  console.log("  Connexion : /compte/connexion, avec ce même identifiant.");
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
