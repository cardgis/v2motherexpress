/**
 * Métadonnées de requête : adresse IP et agent utilisateur.
 *
 * Elles servent à deux choses sensibles — les preuves de la piste d'audit et
 * la limitation de débit des codes — et ne doivent donc pas pouvoir être
 * falsifiées par le client.
 *
 * ── Le piège de x-forwarded-for ────────────────────────────────────────────
 * Chaque proxy AJOUTE à droite l'adresse de celui qui lui parle. Le premier
 * élément de la liste est donc celui que le client a écrit lui-même : s'y
 * fier permet à un robot de changer d'adresse à chaque requête et d'échapper
 * à toute limitation. On lit au contraire depuis la DROITE, en sautant le
 * nombre de proxys de confiance placés devant l'application.
 *
 *   PROXY_SAUTS_DE_CONFIANCE=1   un seul proxy (Vercel, Azure Container Apps,
 *                                load balancer OVH, Nginx…) — valeur par défaut
 *   PROXY_SAUTS_DE_CONFIANCE=2   CDN + load balancer (Cloudflare → OVH LB…)
 *   PROXY_SAUTS_DE_CONFIANCE=0   aucun proxy : l'en-tête est ignoré
 */

import { isIP } from "node:net";

function sautsDeConfiance(): number {
  const valeur = Number(process.env.PROXY_SAUTS_DE_CONFIANCE ?? 1);
  return Number.isInteger(valeur) && valeur >= 0 ? valeur : 1;
}

/** Retire un éventuel port (« 1.2.3.4:5678 », « [::1]:80 ») et valide. */
function nettoyer(valeur: string | undefined | null): string | null {
  if (!valeur) return null;
  let ip = valeur.trim();
  if (ip.startsWith("[")) ip = ip.slice(1, ip.indexOf("]"));
  else if (ip.includes(".") && ip.includes(":")) ip = ip.slice(0, ip.lastIndexOf(":"));
  return isIP(ip) ? ip : null;
}

export function adresseIp(request: Request): string {
  const sauts = sautsDeConfiance();

  if (sauts > 0) {
    const chaine = (request.headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const candidate = nettoyer(chaine[chaine.length - sauts]);
    if (candidate) return candidate;

    const reelle = nettoyer(request.headers.get("x-real-ip"));
    if (reelle) return reelle;
  }

  return "inconnue";
}

export function userAgent(request: Request): string {
  return request.headers.get("user-agent")?.slice(0, 500) ?? "inconnu";
}
