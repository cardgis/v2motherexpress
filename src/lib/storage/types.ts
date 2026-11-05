export interface Blob {
  octets: Uint8Array;
  mimeType: string;
}

/**
 * Ce qu'un fournisseur de stockage doit savoir faire — rien de plus.
 *
 * Un driver ne voit passer QUE des octets déjà chiffrés : il n'a besoin
 * d'aucune confiance particulière et peut être remplacé sans migration de
 * sécurité.
 */
export interface DriverStockage {
  lire(chemin: string): Promise<{ octets: Uint8Array; mimeType?: string }>;
  ecrire(chemin: string, octets: Uint8Array, mimeType: string): Promise<void>;
  supprimer(chemin: string): Promise<void>;
  existe(chemin: string): Promise<boolean>;
}

export function variableRequise(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`Stockage : variable d'environnement manquante ${nom}`);
  return valeur;
}

/** Préfixe facultatif, pour partager un bucket entre environnements. */
export function avecPrefixe(chemin: string): string {
  const prefixe = (process.env.STORAGE_PREFIXE ?? "").replace(/^\/+|\/+$/g, "");
  return prefixe ? `${prefixe}/${chemin}` : chemin;
}
