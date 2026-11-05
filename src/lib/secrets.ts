/**
 * Clés applicatives dérivées d'un secret maître unique.
 *
 * ── Pourquoi dériver ───────────────────────────────────────────────────────
 * Le même secret ne doit jamais servir à deux usages : une faiblesse dans
 * l'un (un jeton de session analysé, un condensat d'OTP qui fuit) ne doit rien
 * apprendre sur l'autre. HKDF (RFC 5869) produit, à partir de `AUTH_SECRET`,
 * une clé indépendante par usage. Changer `AUTH_SECRET` invalide donc d'un
 * coup les sessions ET les codes en attente, ce qui est l'effet recherché en
 * cas de compromission.
 *
 * ── Ce qui n'en dépend PAS ─────────────────────────────────────────────────
 * Le chiffrement des pièces d'identité a son propre trousseau
 * (`STORAGE_CLES_CHIFFREMENT`) : faire tourner `AUTH_SECRET` ne doit jamais
 * rendre illisibles les documents déjà stockés.
 */

import { hkdfSync } from "node:crypto";

export type UsageCle = "session" | "otp";

const LONGUEUR_MINIMALE_PRODUCTION = 32;
const SECRET_DEVELOPPEMENT = "lme-dev-secret-non-utilisable-en-production";

const cache = new Map<UsageCle, Buffer>();

function secretMaitre(): string {
  const valeur = process.env.AUTH_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!valeur || valeur.length < LONGUEUR_MINIMALE_PRODUCTION) {
      throw new Error(
        `AUTH_SECRET doit être défini en production et compter au moins ` +
          `${LONGUEUR_MINIMALE_PRODUCTION} caractères (openssl rand -hex 32).`,
      );
    }
    return valeur;
  }

  return valeur || SECRET_DEVELOPPEMENT;
}

/** Clé de 256 bits propre à un usage. Calculée une fois par processus. */
export function cleDerivee(usage: UsageCle): Buffer {
  const connue = cache.get(usage);
  if (connue) return connue;

  const cle = Buffer.from(hkdfSync("sha256", secretMaitre(), "la-mother-express/v2", usage, 32));
  cache.set(usage, cle);
  return cle;
}
