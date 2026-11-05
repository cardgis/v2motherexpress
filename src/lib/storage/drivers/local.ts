/**
 * Driver de stockage sur disque — DÉVELOPPEMENT UNIQUEMENT.
 *
 * ── Pourquoi « .storage » est écrit en dur ─────────────────────────────────
 * Turbopack analyse les opérations de système de fichiers pour déterminer ce
 * qu'il doit embarquer. Un sous-dossier lu depuis une variable d'environnement
 * lui est opaque : il embarque alors TOUT le projet par précaution. Un
 * littéral statique lui suffit à ne tracer que ce dossier.
 */

import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DriverStockage } from "../types";

function complet(chemin: string): string {
  return path.join(process.cwd(), ".storage", chemin);
}

export const driverLocal: DriverStockage = {
  async lire(chemin) {
    const fichier = complet(chemin);
    const octets = await fs.readFile(fichier);
    // Le disque ne porte pas de métadonnée : le type est stocké à côté. Il ne
    // sert qu'aux blobs antérieurs au chiffrement, qui le portent en en-tête.
    const mimeType = await fs
      .readFile(`${fichier}.type`, "utf-8")
      .then((t) => t.trim())
      .catch(() => undefined);
    return { octets: new Uint8Array(octets), mimeType };
  },

  async ecrire(chemin, octets, mimeType) {
    const fichier = complet(chemin);
    await fs.mkdir(path.dirname(fichier), { recursive: true });

    // Écriture dans un fichier temporaire puis renommage : un arrêt brutal en
    // pleine écriture ne laisse jamais un document tronqué à sa place.
    const temporaire = `${fichier}.${randomBytes(6).toString("hex")}.tmp`;
    await fs.writeFile(temporaire, octets);
    await fs.rename(temporaire, fichier);
    await fs.writeFile(`${fichier}.type`, mimeType, "utf-8");
  },

  async supprimer(chemin) {
    const fichier = complet(chemin);
    await fs.rm(fichier, { force: true });
    await fs.rm(`${fichier}.type`, { force: true });
  },

  async existe(chemin) {
    return fs
      .access(complet(chemin))
      .then(() => true)
      .catch(() => false);
  },
};
