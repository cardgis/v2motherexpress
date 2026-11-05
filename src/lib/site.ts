/**
 * Adresse publique du site, et ce qu'on en déduit.
 *
 * Cette valeur était recopiée dans cinq fichiers, avec DEUX replis différents
 * selon l'endroit — et c'était le vrai danger, pas la duplication. Les pages
 * de métadonnées retombaient sur `https://lamotherexpress.com`, tandis que les
 * LIENS ENVOYÉS AUX CLIENTS retombaient sur `http://localhost:3000`.
 *
 * Autrement dit, une variable d'environnement oubliée en production n'aurait
 * pas cassé le site : elle aurait fait partir, par SMS, des liens de signature
 * vers `http://localhost:3000/signer/…`. Le gérant aurait vu son contrat
 * transmis, le client un lien mort, et personne n'aurait su pourquoi.
 */

const BRUT = process.env.NEXT_PUBLIC_SITE_URL?.trim();

/** `https://lamotherexpress.com` en dernier recours : vrai domaine, pas localhost. */
export const SITE_URL = BRUT || (process.env.NODE_ENV === "production" ? "https://lamotherexpress.com" : "http://localhost:3000");

/**
 * Un domaine `*.vercel.app` est PROVISOIRE : il ne doit pas être indexé.
 *
 * Deux raisons, et la première est la plus coûteuse. La V2 sert les mêmes
 * pages vitrine que le site en ligne, avec des URL canoniques différentes :
 * un moteur y verrait du contenu dupliqué, et c'est le vrai domaine qui en
 * paierait le prix — précisément ce que le travail de référencement cherche à
 * construire. Ensuite, le site V1 a déjà été coupé par un aspirateur qui
 * faisait 77 % de son trafic ; inviter les robots sur un déploiement qui sert
 * en plus des PDF serait refaire la même erreur.
 *
 * La condition porte sur le DOMAINE et non sur un interrupteur à basculer : le
 * jour où une vraie adresse pointe ici, l'indexation s'ouvre d'elle-même, sans
 * que personne n'ait à se souvenir de la rallumer.
 */
export const DOMAINE_PROVISOIRE = (() => {
  try {
    return new URL(SITE_URL).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
})();

/**
 * Configuration du site incomplète — faute d'exploitation, pas d'utilisateur.
 *
 * Portée par une classe à elle pour que les routes puissent la distinguer
 * d'une erreur métier et répondre autrement : son message est destiné au
 * GÉRANT, qui doit comprendre que le problème n'est pas de son fait et savoir
 * quoi faire. « Opération impossible » le laisserait réessayer en boucle.
 */
export class ErreurConfiguration extends Error {
  constructor(
    message: string,
    /** Nom de la variable manquante — pour les journaux, jamais pour l'écran. */
    readonly variable: string,
  ) {
    super(message);
    this.name = "ErreurConfiguration";
  }
}

/**
 * Lien ABSOLU destiné à un client — signature, code QR de retrait.
 *
 * Refuse de fabriquer un lien en production quand l'adresse n'est pas
 * configurée, au lieu d'en produire un vers localhost. L'erreur apparaît alors
 * chez le gérant, au moment où il transmet le contrat, et non chez le client
 * trois jours plus tard devant un lien mort.
 *
 * ── Pourquoi ne pas déduire l'adresse de la requête ? ──────────────────────
 * On pourrait lire l'en-tête `Host` et se passer de variable. Ce serait une
 * FAILLE : cet en-tête est fourni par le client et peut être forgé. Un
 * attaquant obtiendrait un lien de signature pointant vers son propre site,
 * envoyé par SMS au nom de La Mother Express. La variable d'environnement est
 * justement ce qui ne peut pas être falsifié — c'est un choix, pas un oubli.
 */
export function lienPublic(chemin: string): string {
  if (!BRUT && process.env.NODE_ENV === "production") {
    throw new ErreurConfiguration(
      "L'adresse publique du site n'est pas configurée : le lien de signature ne " +
        "peut pas être fabriqué sans risquer d'envoyer le client vers une adresse " +
        "inexistante. Prévenez l'administrateur ; aucune action de votre part ne " +
        "corrigera cela.",
      "NEXT_PUBLIC_SITE_URL",
    );
  }
  return `${SITE_URL.replace(/\/$/, "")}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}
