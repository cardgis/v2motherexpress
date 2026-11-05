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
 * Lien ABSOLU destiné à un client — signature, code QR de retrait.
 *
 * Refuse de fabriquer un lien en production quand l'adresse n'est pas
 * configurée, au lieu d'en produire un vers localhost. L'erreur apparaît alors
 * chez le gérant, au moment où il transmet le contrat, et non chez le client
 * trois jours plus tard devant un lien mort.
 */
export function lienPublic(chemin: string): string {
  if (!BRUT && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL n'est pas configurée : impossible de fabriquer un lien " +
        "destiné à un client sans risquer de l'envoyer vers une adresse inexistante.",
    );
  }
  return `${SITE_URL.replace(/\/$/, "")}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}
