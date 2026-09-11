# La Mother Express — Moto Project

## Stack
- **Next.js 16** App Router, React 19, TypeScript
- **Prisma** + PostgreSQL (pg)
- **UIKit 3.6.3** (CSS/JS dans `public/assets/`) — sans dépendance jQuery
- Seuls scripts chargés dans `src/app/layout.tsx` : `uikit.min.js` et `uikit-icons.min.js` (`<Script strategy="afterInteractive">`)
- **Plus de jQuery, Slick, ion.rangeSlider, FontAwesome ni `main.js`** — voir « Scripts morts » plus bas

## Routes
| Route | Page |
|---|---|
| `/` | Page d'accueil (produits, hero, vidéos) |
| `/about` | À propos |
| `/contact` | Contact |
| `/produits` | Produits |
| `/admin/catalogue` | Admin — gestion catalogue (auth requise) |
| `/admin/login` | Admin — login |

## Architecture composants clés
```
layout.tsx
  ├── Header (client) ← TOUJOURS MONTÉ, jamais dans RouteBoundary
  │     ├── SearchButton (client)
  │     ├── OffcanvasButton (client)
  │     └── NavbarOverlays (client)
  └── RouteBoundary (key={pathname} → force remount du contenu de page)
        └── [page] (children)
              └── HomePageContent / AboutPage / etc. (sans Header)
```

---

## BUG RÉCURRENT — Interactivité cassée après navigation SPA

### Symptôme
Après avoir navigué vers une autre page et être revenu sur la page d'accueil :
- Le bouton `+` sur les cards produit n'ouvre pas le dialog de détail
- Le menu burger (petit écran) n'apparaît pas
- L'overlay de recherche n'apparaît pas

### Cause racine
`public/assets/js/interaction-handler.js` manipule le DOM directement via `classList.add('is-open')` / `classList.remove('is-open')`.

React gère `className` via son virtual DOM. Quand React re-rend un composant (après navigation ou pour n'importe quelle raison), il **écrase** les classes ajoutées par le script externe — conflit total entre le script et React.

### Solution validée (NE PAS REVENIR EN ARRIÈRE)

**Règle absolue : ne jamais utiliser `interaction-handler.js` ni l'API `<dialog>` native pour les éléments React.**

#### Menu burger + overlays (`Header` / `NavbarOverlays`)
- `Header.tsx` est un composant **client** (`'use client'`)
- State React `menuOpen` et `searchOpen` géré dans `Header`
- `className` conditionnel dans `NavbarOverlays` : `navbar-overlay${menuOpen ? ' is-open' : ''}`
- Fermeture : clic sur le fond, bouton ×, touche Escape (via `useEffect` + `document.addEventListener`)
- `OffcanvasButton` et `SearchButton` reçoivent un prop `onClick`
- Navigation via `<Link>` Next.js (pas `<a href>`) — ferme overlay via `onClick={onCloseMenu/Search}`

#### Bouton `+` produit (`ProductCard`)
- PAS de `<dialog>` natif, PAS de `showModal()`, PAS de `dialogRef`
- `panelOpen` est un simple `useState(false)` React
- Overlay rendu conditionnellement : `{panelOpen && <div style={{ position:'fixed', inset:0, zIndex:9000 }}>...`
- Fermeture : clic sur backdrop (`e.target === e.currentTarget`), bouton ×, Escape via `useEffect([panelOpen])`

### Ce qui NE marche PAS (déjà testé)
- Compter sur `interaction-handler.js` seul → casse après SPA navigation
- `document.getElementById()` dans useEffect pour trouver le dialog → fragile après remount
- Ajouter `RouteBoundary` seul sans migrer vers React state → insuffisant
- Mettre `Header` à l'intérieur de `RouteBoundary` (dans les pages) → Header se démonte/remonte à chaque nav
- Migrer vers React state MAIS laisser Header dans les pages individuelles → même problème de remontage
- `<dialog>` natif + `showModal()` → conflit avec script caché en cache navigateur, instable après SPA nav
- `interaction-handler.js` avec `capture: true` → écrase les classes React à chaque re-render

---

## RouteBoundary
`src/components/RouteBoundary.tsx` — wraps les `children` avec `<Fragment key={pathname}>` pour forcer un remount complet à chaque changement de route. Nécessaire mais pas suffisant sans React state.

## DisableBfcache
`src/components/DisableBfcache.tsx` — force un reload si la page est restaurée depuis le bfcache du navigateur (event `pageshow` avec `event.persisted`).

## interaction-handler.js
**NE PLUS CHARGER CE SCRIPT.** La balise `<Script>` a été retirée de `layout.tsx`.
Le fichier `public/assets/js/interaction-handler.js` existe encore mais n'est pas chargé.
Toute gestion d'Escape ou de clic est désormais faite dans les composants React (Header, ProductCard).

## Prisma
- Schéma dans `prisma/schema.prisma`
- Client généré dans `src/generated/prisma/`
- Import : `import { prisma } from "@/lib/prisma"`

## Admin auth
Cookie-based, logique dans `src/lib/admin-auth.ts`. Pages admin vérifient le cookie et redirigent vers `/admin/login` si absent.

---

## Images — pipeline WebP

**Ne jamais utiliser `next/image`.** Il consomme le quota Vercel « Image Optimization —
Transformations », et il entre en conflit avec la mise en page CSS du thème UIKit.

Les variantes responsive sont **pré-générées au build**, pas à la volée :

```bash
npm run optimize:images   # scripts/optimize-images.mjs
```

Le script parcourt `public/assets/img`, écrit des `<nom>-<largeur>.webp` à côté des
originaux (jamais d'upscale), et régénère `src/lib/image-manifest.ts`.

**À relancer après tout ajout d'image, et à commiter** — les `.webp` sont des assets
versionnés, pas des artefacts de build.

### Afficher une image

```tsx
import { responsiveImage } from "@/lib/img";

<img {...responsiveImage("/assets/img/header1.png", "100vw")} alt="…" />
```

`responsiveImage(src, sizes)` renvoie `{ src, srcSet, sizes }`. Si l'image est absente du
manifest (upload admin, URL externe), elle renvoie la source d'origine intacte — l'affichage
ne casse jamais.

Le second argument décrit la **largeur d'affichage réelle**, pas la taille du fichier. Sans
lui le navigateur suppose `100vw` et télécharge la plus grande variante. C'est ce qui faisait
télécharger `header1.png` en entier (1,85 MB) pour une vignette de 120 px dans le footer.

**Garder des `<img>` simples — pas de `<picture>`.** Le DOM reste identique à celui du thème,
donc aucun risque vis-à-vis des sélecteurs CSS UIKit ni du bug d'interactivité SPA ci-dessus.
L'avertissement ESLint `@next/next/no-img-element` est attendu et assumé.

## Scripts morts (supprimés)

`jquery.min.js`, `slick.min.js`, `ion.rangeSlider.min.js`, `main.js` et
`fontawesome.all.min.js` ont été retirés de `layout.tsx` — 1,39 MB par page pour du code qui
ne s'exécutait jamais. Les fichiers existent encore dans `public/assets/` mais ne sont pas
chargés.

Vérification faite sélecteur par sélecteur : aucune cible de `main.js` n'existe dans
l'application (`.gallery-slider`, `.gallery-slider-nav`, `#range-price`, `#range-mileage`,
`#page-preloader`). jQuery ne servait plus qu'à ces scripts morts, et était chargé en
`beforeInteractive` — il bloquait le rendu pour rien. Les icônes sociales du footer sont en
SVG inline depuis longtemps, FontAwesome ne dessinait plus rien.

**Ne pas les recharger.** Si une fonctionnalité du thème est réintroduite, la réécrire en
React plutôt que de rebrancher jQuery.

## Contexte Vercel

Le site a été coupé (`402 DEPLOYMENT_DISABLED`) en septembre 2026 après un dépassement du
quota Fast Data Transfer : 303 GB pour 100 GB autorisés. Cause identifiée — un scraper via
Londres (`lhr1`), 650K requêtes soit 76,8 % du trafic, contre 18,8 % pour Paris et 2,3 % pour
Le Cap qui constituent le public réel.

Traité par : **Bot Protection en mode challenge** (Firewall Vercel), la conversion WebP et la
suppression des scripts morts. Toute régression sur le poids des pages a un coût direct et
immédiat sur ce quota.
