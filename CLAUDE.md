# La Mother Express — Moto Project

## Stack
- **Next.js 16** App Router, React 19, TypeScript
- **Prisma** + PostgreSQL (pg)
- **UIKit** (CSS/JS via CDN dans `public/assets/`)
- **jQuery** + Slick slider (via CDN)
- Scripts chargés dans `src/app/layout.tsx` via `<Script strategy="afterInteractive">`

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
