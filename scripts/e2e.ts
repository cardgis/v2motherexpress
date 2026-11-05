/**
 * Parcours authentifié — chaque écran est réellement RENDU, pour chaque rôle.
 *
 *   npm run e2e                          (le serveur de dev doit tourner)
 *   npm run e2e -- http://localhost:3001
 *
 * ── Pourquoi ce script existe ──────────────────────────────────────────────
 * Un 307 prouve qu'une route existe, pas qu'un écran fonctionne. Sans session,
 * tout le back-office redirige vers la connexion : on ne voyait donc jamais le
 * contenu d'une seule page protégée. Les écrans les plus récents n'avaient
 * jamais été rendus, ni par un test ni par un navigateur.
 *
 * ── Comment la session est obtenue ─────────────────────────────────────────
 * Par `creerJeton`, la fonction qu'emploie la connexion réelle : le cookie est
 * authentique et le serveur le valide normalement. Seul l'OTP est contourné —
 * son code est haché en base (HMAC), un script ne peut pas le relire.
 *
 * ── LECTURE SEULE ──────────────────────────────────────────────────────────
 * Aucun POST, aucune écriture. Le script ne laisse rien derrière lui.
 */

// `.env.local` UNIQUEMENT : ce script ne doit jamais viser la production.
import "./env-local";

import { prisma } from "../src/lib/prisma";
import { creerJeton, SESSION_COOKIE } from "../src/lib/auth";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

let ok = 0;
let ko = 0;
let sautes = 0;

function resultat(etat: "OK" | "KO" | "SAUTÉ", libelle: string, detail?: string) {
  if (etat === "OK") ok++;
  else if (etat === "KO") ko++;
  else sautes++;
  console.log(`  ${etat.padEnd(6)} ${libelle}`);
  if (detail) console.log(`         ${detail}`);
}

/** Cookie de session forgé pour un compte réel de la base. */
async function sessionPour(role: "ADMIN" | "GERANT" | "COMMERCIAL" | "CLIENT") {
  const user = await prisma.user.findFirst({
    where: { role, actif: true },
    select: { id: true, role: true, versionSession: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) return null;
  return `${SESSION_COOKIE}=${creerJeton(user)}`;
}

/**
 * Rend une page et vérifie qu'elle a bien produit SON contenu.
 *
 * Le code 200 ne suffit pas : Next rend sa page d'erreur avec un 200 dans
 * certains cas. On exige donc un marqueur présent dans le HTML attendu.
 */
async function page(cookie: string, chemin: string, marqueur: string, libelle: string) {
  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
  } catch (erreur) {
    resultat("KO", libelle, `${chemin} — injoignable : ${erreur instanceof Error ? erreur.message : erreur}`);
    return;
  }

  if (reponse.status !== 200) {
    resultat("KO", libelle, `${chemin} — attendu 200, obtenu ${reponse.status}`);
    return;
  }

  const html = await reponse.text();
  if (!html.includes(marqueur)) {
    resultat("KO", libelle, `${chemin} — rendu sans « ${marqueur} »`);
    return;
  }

  resultat("OK", libelle);
}

/** Flux servi par une API : on vérifie le type, pas le contenu. */
async function flux(cookie: string, chemin: string, type: string, libelle: string) {
  const reponse = await fetch(`${BASE}${chemin}`, { headers: { Cookie: cookie }, redirect: "manual" });
  if (reponse.status !== 200) {
    resultat("KO", libelle, `${chemin} — attendu 200, obtenu ${reponse.status}`);
    return;
  }
  const recu = reponse.headers.get("content-type") ?? "";
  if (!recu.includes(type)) {
    resultat("KO", libelle, `${chemin} — attendu ${type}, obtenu ${recu}`);
    return;
  }
  resultat("OK", libelle);
}

async function main() {
  console.log(`\nParcours authentifié sur ${BASE}\n`);

  const [client, gerant, admin] = await Promise.all([
    sessionPour("CLIENT"),
    sessionPour("GERANT"),
    sessionPour("ADMIN"),
  ]);

  // Identifiants réels : un écran de détail ne prouve rien sur un id inventé.
  const [customer, aClore, dossier, contrat, boutique] = await Promise.all([
    prisma.customer.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } }),
    prisma.reservation.findFirst({
      where: { statut: "ACTIVE", formule: { in: ["LOCATION_JOURNALIERE", "LOCATION_ACCESSION"] } },
      select: { id: true },
    }),
    // Le titre d'un écran est rendu quelle que soit sa branche : un dossier
    // quelconque prouve donc qu'il se compose, même hors de son cas nominal.
    prisma.reservation.findFirst({
      where: { contract: { isNot: null } },
      select: { id: true, formule: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contract.findFirst({
      where: { OR: [{ pdfSignedPath: { not: null } }, { pdfDraftPath: { not: null } }] },
      select: { id: true },
    }),
    prisma.boutique.findFirst({ select: { id: true } }),
  ]);

  // ── Client ────────────────────────────────────────────────────────────────
  console.log("=== Espace client ===");
  if (!client) resultat("SAUTÉ", "aucun compte CLIENT actif en base");
  else {
    await page(client, "/compte", "Mon espace", "accueil du client");
    await page(client, "/compte/dossier", "Mon dossier", "son dossier KYC");
    await page(client, "/compte/reserver", "Réserver un scooter", "réservation en ligne");
    if (contrat) await flux(client, `/api/contrats/${contrat.id}/pdf`, "application/pdf", "téléchargement de son contrat");
    else resultat("SAUTÉ", "aucun contrat avec PDF en base");
  }

  // ── Gérant ────────────────────────────────────────────────────────────────
  console.log("\n=== Back-office gérant ===");
  if (!gerant) resultat("SAUTÉ", "aucun compte GERANT actif en base");
  else {
    await page(gerant, "/gerant", "Back-office gérant", "tableau de bord");
    await page(gerant, "/gerant/dossiers", "Dossiers clients", "liste des dossiers");
    await page(gerant, "/gerant/versements", "Versements", "suivi des versements");
    await page(gerant, "/gerant/flotte", "Flotte", "inventaire de la flotte");
    if (customer) await page(gerant, `/gerant/dossiers/${customer.id}`, "Vérification du dossier", "fiche d'un dossier");
    else resultat("SAUTÉ", "aucun client en base");
    if (dossier) {
      await page(gerant, `/gerant/retrait/${dossier.id}`, "Retrait en boutique", "écran de retrait");

      const cible = aClore?.id ?? dossier.id;
      await page(gerant, `/gerant/restitution/${cible}`, "Restitution du véhicule", "ÉCRAN DE RESTITUTION");

      // Une vente ne se restitue pas : l'écran doit le dire au lieu d'offrir
      // un formulaire. C'est le garde-fou, pas un cas d'erreur.
      if (!aClore && dossier.formule === "VENTE_ECHELONNEE") {
        await page(
          gerant,
          `/gerant/restitution/${dossier.id}`,
          "Pas de restitution pour cette formule",
          "garde-fou : une vente ne se restitue pas",
        );
      }
    } else resultat("SAUTÉ", "aucun dossier avec contrat en base");
  }

  // ── Administration ────────────────────────────────────────────────────────
  console.log("\n=== Administration ===");
  if (!admin) resultat("SAUTÉ", "aucun compte ADMIN actif en base");
  else {
    await page(admin, "/admin", "Chiffres", "chiffres");
    await page(admin, "/admin/suivi", "Feuille de suivi", "feuille de suivi");
    // Le libellé du total : il dit ce qu'il compte, et ne compte que les vivants.
    // `periode=tout` est INDISPENSABLE : la page filtre par défaut sur le mois
    // en cours, et ce bloc ne s'affiche qu'avec au moins une ligne. Sans ce
    // paramètre, le contrôle passait en octobre et tombait au 1er novembre —
    // un test qui dépend du calendrier ne teste pas ce qu'il prétend.
    await page(admin, "/admin/suivi?periode=tout", "engagés", "TOTAL « engagés » de la feuille");
    await page(admin, "/admin/versements", "Versements", "état des versements");
    await page(admin, "/admin/contrats", "Contrats", "liste des contrats");
    await page(admin, "/admin/boutiques", "Boutiques", "boutiques");
    await page(admin, "/admin/flotte", "Flotte", "flotte de toutes les boutiques");
    if (boutique) await page(admin, `/admin/boutiques/${boutique.id}`, "Boutique", "fiche d'une boutique");
    else resultat("SAUTÉ", "aucune boutique en base");
    if (customer) await page(admin, `/admin/contrats/${customer.id}`, "Dossier", "dossier vu par l'admin");
    const cible = aClore?.id ?? dossier?.id;
    if (cible) await page(admin, `/admin/restitution/${cible}`, "Restitution", "restitution vue par l'admin");
  }

  console.log(
    `\n${ko === 0 ? "TOUS LES ÉCRANS RÉPONDENT" : "ÉCHECS DÉTECTÉS"} — ${ok} OK, ${ko} KO` +
      (sautes ? `, ${sautes} sauté(s)` : "") +
      "\n",
  );
  await prisma.$disconnect();
  process.exit(ko === 0 ? 0 : 1);
}

main().catch(async (erreur) => {
  console.error(erreur);
  await prisma.$disconnect();
  process.exit(1);
});
