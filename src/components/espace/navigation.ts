/**
 * Plan de navigation des espaces, par profil.
 *
 * Trois destinations au plus par profil : c'est ce qui tient dans une barre
 * de navigation basse sur téléphone sans réduire les libellés à des icônes
 * muettes. Les pages de détail (un dossier, un retrait) ne figurent pas ici :
 * elles rattachent leur onglet parent via `rattachees`, et on y accède par le
 * contenu des pages, avec un fil d'Ariane pour revenir.
 */

import {
  Bike,
  CalendarPlus,
  ChartColumn,
  FileText,
  FolderOpen,
  HandCoins,
  IdCard,
  LayoutDashboard,
  Store,
  type LucideIcon,
} from "lucide-react";

export type Espace = "client" | "gerant" | "admin";

export interface LienNavigation {
  href: string;
  libelle: string;
  /** Version courte pour la barre basse, faute de place. */
  libelleCourt?: string;
  Icone: LucideIcon;
  /** Actif uniquement sur l'adresse exacte (page d'accueil d'un espace). */
  exact?: boolean;
  /** Autres chemins qui rattachent la page à cet onglet. */
  rattachees?: string[];
}

export const NAVIGATION: Record<Espace, LienNavigation[]> = {
  client: [
    // « Mes documents » s'ouvre depuis la carte de l'accueil et revient par son
    // fil d'Ariane : un quatrième onglet déborderait la barre basse.
    { href: "/compte", libelle: "Mon espace", libelleCourt: "Accueil", Icone: LayoutDashboard, exact: true, rattachees: ["/compte/contrats", "/compte/documents"] },
    { href: "/compte/reserver", libelle: "Réserver", Icone: CalendarPlus },
    { href: "/compte/dossier", libelle: "Mon dossier", libelleCourt: "Dossier", Icone: IdCard },
  ],
  gerant: [
    // Le retrait s'ouvre depuis le tableau de bord (« Retraits à faire ») :
    // c'est cet onglet qui reste allumé, en cohérence avec le fil d'Ariane.
    { href: "/gerant", libelle: "Tableau de bord", libelleCourt: "Accueil", Icone: LayoutDashboard, exact: true, rattachees: ["/gerant/retrait", "/gerant/restitution"] },
    { href: "/gerant/dossiers", libelle: "Dossiers", Icone: FolderOpen },
    // Qui doit passer payer, qui a du retard : le gérant relance lui-même.
    { href: "/gerant/versements", libelle: "Versements", libelleCourt: "Argent", Icone: HandCoins },
    { href: "/gerant/flotte", libelle: "Flotte", Icone: Bike },
  ],
  admin: [
    // La feuille de suivi détaille les chiffres : elle garde l'onglet allumé.
    { href: "/admin", libelle: "Chiffres", Icone: ChartColumn, exact: true, rattachees: ["/admin/suivi"] },
    // Dossiers et contrats de toutes les boutiques, avec les gestes du gérant,
    // sans quitter l'espace d'administration. Le retrait et la flotte s'ouvrent
    // depuis une fiche : ils restent rattachés à cet onglet.
    {
      href: "/admin/contrats",
      libelle: "Contrats",
      Icone: FileText,
      rattachees: ["/admin/retrait", "/admin/restitution", "/admin/flotte"],
    },
    // L'argent réellement rentré, dossier par dossier — à distinguer des
    // chiffres, qui portent sur la valeur contractuelle.
    { href: "/admin/versements", libelle: "Versements", libelleCourt: "Argent", Icone: HandCoins },
    { href: "/admin/boutiques", libelle: "Boutiques", Icone: Store },
  ],
};

export function estActif(lien: LienNavigation, chemin: string): boolean {
  // Un onglet peut pointer vers une adresse filtrée (« /gerant/dossiers?filtre=tous ») :
  // la comparaison porte sur le chemin seul, sans quoi l'onglet ne s'allume jamais,
  // `usePathname()` ne renvoyant pas la partie qui suit le « ? ».
  const base = lien.href.split("?")[0]!;
  const correspond = (b: string) => chemin === b || chemin.startsWith(`${b}/`);
  if (lien.rattachees?.some(correspond)) return true;
  return lien.exact ? chemin === base : correspond(base);
}
