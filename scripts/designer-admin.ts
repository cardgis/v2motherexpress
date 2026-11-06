/**
 * Désigne un compte administrateur de La Mother Express.
 *
 *   npm run admin:designer -- "77 123 45 67" "Prénom NOM"
 *   npm run admin:designer -- direction@lamotherexpress.com "Prénom NOM"
 *   npm run admin:designer -- "77 123 45 67" "Prénom NOM" --exclusif
 *
 * ── PLUSIEURS administrateurs sont désormais admis (2026-11-06) ────────────
 * Le projet n'en autorisait qu'un : chaque désignation rétrogradait les autres
 * en client. Alexandre a demandé deux comptes, un pour lui et un pour Didier,
 * ce qui correspond à deux responsables de l'entreprise.
 *
 * Rien ne s'y opposait : aucune contrainte en base ne porte sur le rôle, et
 * tout le contrôle d'accès teste `role === "ADMIN"`, donc fonctionne pour un
 * nombre quelconque. L'unicité n'était qu'une politique inscrite dans ce
 * script.
 *
 * Par défaut, la désignation AJOUTE sans rien retirer. L'opération
 * destructrice est devenue celle qu'on demande explicitement, et non celle
 * qu'on subit : sans ce changement, désigner Didier aurait rétrogradé
 * Alexandre sans l'avertir.
 *
 * `--exclusif` rétablit l'ancien comportement : le compte désigné devient le
 * SEUL administrateur, les autres redeviennent clients et leurs sessions sont
 * révoquées. C'est la manœuvre de reprise en main si un accès échappe.
 *
 * Dans les deux cas, la liste complète des administrateurs est affichée à la
 * fin. Une politique qui se voit vaut mieux qu'une règle qu'on suppose.
 *
 * L'administrateur se connecte ensuite comme tout le monde, par un code reçu
 * sur ce mobile ou à cette adresse : aucun mot de passe n'est créé.
 *
 * Base LOCALE uniquement (`.env.local`), comme tous les scripts du projet.
 * Pour viser la production : DATABASE_URL="<adresse directe>" npx tsx …
 */

import "./env-local";
import { prisma } from "../src/lib/prisma";
import { analyserIdentifiant } from "../src/lib/identifiant";
import { masquerIdentifiant } from "../src/lib/phone";

async function main() {
  const arguments_ = process.argv.slice(2);
  const exclusif = arguments_.includes("--exclusif");
  const [saisie, ...mots] = arguments_.filter((a) => a !== "--exclusif");
  const nom = mots.join(" ").trim() || "Administrateur";
  const identifiant = analyserIdentifiant(saisie);

  if (!identifiant) {
    console.error('Usage : npm run admin:designer -- "<mobile ou e-mail>" "Prénom NOM" [--exclusif]');
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

    // Rétrogradation UNIQUEMENT sur demande explicite.
    const anciens = exclusif
      ? await tx.user.updateMany({
          where: { role: "ADMIN", id: { not: admin.id } },
          data: { role: "CLIENT", versionSession: { increment: 1 } },
        })
      : { count: 0 };

    return { admin, retires: anciens.count };
  });

  console.log(`\n✓ Administrateur : ${nom} (${identifiant.valeur}) — compte ${admin.id}`);
  if (retires > 0) {
    console.log(`  ${retires} ancien(s) administrateur(s) redevenu(s) client, sessions révoquées.`);
  }

  // La liste finale, toujours : c'est elle qui dit la vérité, pas la politique
  // qu'on croit appliquée.
  const tous = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { nomAffichage: true, telephone: true, email: true, actif: true },
    orderBy: { nomAffichage: "asc" },
  });

  console.log(`\n  ${tous.length} administrateur(s) au total :`);
  for (const a of tous) {
    const id = a.telephone ?? a.email ?? "—";
    console.log(`    ${(a.nomAffichage ?? "sans nom").padEnd(24)} ${masquerIdentifiant(id)}${a.actif ? "" : "  (désactivé)"}`);
  }
  console.log("\n  Connexion : /compte/connexion, avec ce même identifiant.\n");
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
