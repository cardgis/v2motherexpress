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
| `/compte` | Espace client (V2) |
| `/gerant` | Back-office boutique — gérant, commercial en consultation |
| `/admin` | Administration — compte unique : chiffres, suivi, boutiques |

## Architecture composants clés
```
layout.tsx
  ├── Header (client) ← TOUJOURS MONTÉ, jamais dans RouteBoundary
  │     ├── OffcanvasButton (client)
  │     └── NavbarOverlays (client)   ← menu seul : la recherche a été retirée
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
- State React `menuOpen` géré dans `Header`
- `className` conditionnel dans `NavbarOverlays` : `navbar-overlay${menuOpen ? ' is-open' : ''}`
- Fermeture : clic sur le fond, bouton ×, touche Escape (via `useEffect` + `document.addEventListener`)
- `OffcanvasButton` reçoit un prop `onClick`
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

## Espaces client et gérant (V2)

Les routes `/compte`, `/gerant` et `/signer` n'utilisent PAS l'en-tête du site
vitrine : `Header.tsx` renvoie `null` sur ces chemins. Son en-tête transparent,
positionné en absolu, masquait les titres de ces pages.

```
compte/connexion/layout.tsx   → CadreSimple (sans session, sans navigation)
compte/(espace)/layout.tsx    → CadreEspace « client » (session exigée, gérant redirigé)
gerant/layout.tsx             → CadreEspace « gérant » (gérant, commercial, admin)
admin/layout.tsx              → CadreEspace « admin » (administrateur unique)
signer/layout.tsx             → CadreSimple (signature par lien)
```

- `CadreEspace` : en-tête collant (`sticky`, dans le flux : il ne recouvre
  jamais le contenu), menu du compte, barre de navigation basse sur mobile
  (fixe ; `.lme-contenu` réserve sa hauteur en marge basse).
- Plan de navigation par profil : `src/components/espace/navigation.ts`.
- Composants d'interface : `src/components/ui/` (Bouton, Champ, Alerte,
  Badge, Carte, EnTetePage, Etapes, Choix…). Styles : `src/styles/espace.css`,
  tout préfixé `lme-`, rattaché à `.lme-app`. Ne pas utiliser les classes
  `uk-` dans ces espaces.
- Code couleur : doré = action principale, vert = succès/validation, bleu =
  en attente d'un tiers, ambre = action requise, rouge = erreur ou action
  irréversible uniquement, gris = neutre/verrouillé. Libellé et couleur de
  chaque statut : `src/lib/statuts.ts`.
- `RouteBoundary` garde une clé STABLE au sein de chaque espace : leur cadre
  n'est pas remonté à chaque page (tout y est en état React).

## RouteBoundary
`src/components/RouteBoundary.tsx` — wraps les `children` avec `<Fragment key={pathname}>` pour forcer un remount complet à chaque changement de route. Nécessaire mais pas suffisant sans React state.

## DisableBfcache
`src/components/DisableBfcache.tsx` — force un reload si la page est restaurée depuis le bfcache du navigateur (event `pageshow` avec `event.persisted`).

## interaction-handler.js
**NE PLUS RECHARGER CE SCRIPT.** La balise `<Script>` avait été retirée de `layout.tsx` ;
le fichier lui-même a été **supprimé** de `public/assets/js/` le 2026-11-14.
Toute gestion d'Escape ou de clic est désormais faite dans les composants React (Header, ProductCard).

## Prisma
- Schéma dans `prisma/schema.prisma`
- Client généré dans `src/generated/prisma/`
- Import : `import { prisma } from "@/lib/prisma"`

## Administration et rôles (V2)
- **PLUSIEURS administrateurs** (`User.role = ADMIN`), désignés par
  `npm run admin:designer -- "<mobile ou e-mail>" "Prénom NOM"`. Le projet n'en
  autorisait qu'un jusqu'au 2026-11-06 ; Alexandre en a demandé deux, un pour
  lui et un pour Didier, soit les deux responsables de l'entreprise. Rien ne
  s'y opposait : aucune contrainte en base ne porte sur le rôle, et tout le
  contrôle d'accès teste `role === "ADMIN"`. L'unicité n'était qu'une politique
  inscrite dans le script.
- **La désignation AJOUTE par défaut**, elle ne retire plus. L'opération
  destructrice est devenue celle qu'on demande : `--exclusif` fait du compte
  désigné le SEUL administrateur et révoque les sessions des autres — manœuvre
  de reprise en main si un accès échappe. Sans ce changement, désigner le second
  responsable aurait rétrogradé le premier sans l'avertir.
- Le script affiche **la liste complète des administrateurs** à la fin, dans
  tous les cas : une politique qui se voit vaut mieux qu'une règle qu'on
  suppose. Connexion par code comme les autres comptes. L'ancien accès par mot
  de passe (`admin-auth.ts`, `/admin/login`) est supprimé ; la table
  `AdminUser` reste pour l'historique.
- Contrôles : `exigerAdmin()` / `exigerAdminApi()` pour `/admin` ;
  `exigerEquipe()` pour les pages de CONSULTATION du back-office (gérant,
  commercial, admin) ; `exigerGerant()` pour les pages d'ACTION ;
  `exigerGerantApi()` pour toute route qui modifie (refuse le commercial).
- COMMERCIAL = lecture seule sur sa boutique (dossiers, pièces, contrats,
  flotte). Ne jamais lui ouvrir une route d'écriture.
- Chiffres : `src/lib/admin/statistiques.ts` (définition de chaque chiffre en
  tête de fichier) ; feuille de suivi et export CSV : `src/lib/admin/suivi.ts`.

## Versements (lot 7, étape 1)
- `src/lib/versements.ts` — deux tables : `Echeance` (ce qui est dû, figé au
  scellement) et `Encaissement` (ce qui est reçu, une ligne par versement).
  Aucun cumul stocké : le solde se recalcule toujours.
- L'échéancier n'existe QUE pour la vente (60 % + 4 × 10 %) et la courte durée.
  La location-accession n'en a pas : l'acte prévoit une redevance journalière
  due 6 j/7, donc le dû se calcule à la date du jour.
- Le gérant saisit depuis `/gerant` (`exigerGerantApi`), l'administrateur seul
  annule, avec un motif (`exigerAdminApi`). Rien ne s'efface.
- `SUIVI_VERSEMENTS_DEPUIS` borne le suivi à la mise en ligne : les versements
  antérieurs ne sont pas repris, le dû non plus (`Reservation.suiviDepuis`).
- Contrôles : `npm run verif:versements`.
- Écran admin : `/admin/versements` — état par dossier (dû à ce jour, encaissé,
  retard), filtres tous / en retard / à jour / soldés, export CSV, et annulation
  motivée depuis le détail. `src/lib/admin/versements.ts`.
- La protection CSV contre l'injection de formule est commune aux feuilles :
  `src/lib/admin/csv.ts`.
- **Contrat ARRÊTÉ** (`StatutReservation.ARRETEE`, libellé « Contrat arrêté ») —
  posé par le constat de restitution, à distinguer de `TERMINEE`, qui dit d'un
  contrat qu'il s'est BIEN fini (vente soldée, accession menée à terme). Le
  dossier reste visible dans le suivi : c'est là qu'on voit le reste à recouvrer.
- La clôture GÈLE le compteur (`DonneesSolde.arreteLe`). Sans ce gel, une
  accession rompue au 100ᵉ jour continuait d'accumuler 2 500 F/jour jusqu'au
  total du contrat, sur un engagement éteint. `duTotal`, `restant` et `solde`
  s'adossent au dû gelé, PAS à `montantTotal` : les mois restants ne sont plus
  dus — l'article 5 ne réclame que la période effectivement utilisée.
- La clôture crée des ÉCHÉANCES pour ce que le constat met à la charge du
  client : différentiel de l'article 5, frais de remise en état, exigibles à la
  date de l'arrêt. Les redevances impayées n'y figurent pas, le compteur les
  portant déjà. Une accession a donc des échéances une fois arrêtée, alors
  qu'elle n'en a aucune tant qu'elle court — d'où `calculerDuADate` qui ajoute
  les échéances échues à TOUTES les formules.

## Fin de parcours : annulation, expiration, caducité (2026-09-29)

Trois manques comblés le même jour. Avant cela, un dossier ne pouvait ni
s'annuler ni s'éteindre : une moto réservée pour un client qui ne venait plus
restait bloquée indéfiniment.

- **Annulation par la boutique** — `src/lib/annulation.ts`,
  `POST /api/gerant/reservations/[id]` avec `{ action: "annuler", motif }`.
  Gérant et admin seulement : décision d'Alexandre, le client qui se désiste
  appelle ou passe. Motif obligatoire (10 caractères), conservé sur la
  RÉSERVATION (`annuleLe`, `annuleParUserId`, `annuleMotif`) et non sur le
  contrat — une annulation peut précéder tout contrat, un `ContractEvent` seul
  perdrait la trace. `estAnnulable()` dit jusqu'où : tant que le contrat n'est
  pas scellé. Un contrat signé du client mais pas contresigné reste annulable,
  la boutique étant libre de ne pas s'engager. Au-delà : résiliation.
- **Cron d'expiration** — `src/lib/expiration.ts`,
  `npm run cron:expiration` (`--apercu` pour voir sans écrire). Honore la
  promesse que `Reservation.expireLe` faisait déjà. Passe en `CADUQUE` les
  réservations `EN_ATTENTE_RETRAIT` dont le délai est dépassé, libère la moto,
  inscrit un événement `EXPIRE`. Une transaction PAR réservation : un dossier
  bancal ne doit pas retenir les autres. À appeler une fois par jour ; chez un
  hébergeur qui ne déclenche que par HTTP, il faudra une route protégée par un
  secret appelant la même fonction.
- **Pièce non conforme : le KYC tombe** — dans `verifierPiece`. Le dossier passe
  en `REJETE` avec un motif lisible par le client, et ses autres réservations en
  attente de validation repartent en attente de pièces. Sans cela le KYC restait
  `VALIDE` et le client reprenait une réservation aussitôt, en sautant la
  vérification. Le doute porte sur la personne, pas sur un contrat.

### Contrôles ajoutés le 2026-09-29

| Commande | Ce qu'elle éprouve |
|---|---|
| `npm run e2e` | chaque écran RENDU pour chaque rôle, session forgée par `creerJeton` — lecture seule |
| `npm run verif:concurrence` | 8 gérants se disputent la même moto : un seul l'obtient |
| `npm run verif:expiration` | le cron libère vraiment, et ne touche pas ce qui est dans les temps |
| `npm run verif:annulation` | annulation, refus au-delà du scellement, et rejet du KYC |
| `npm run verif:purge` | la purge des pièces : 48 h après le retrait complet, et épargnée si un dossier attend encore |
| `npm run verif:statistiques` | une réservation ne compte pas comme une location aboutie |
| `npm run verif:sms` | l'envoi SMS sur le vrai fournisseur, numéro par numéro |
| `npm run verif:solde` | le solde prépayé Dexchange — code de sortie 1 sous le seuil |
| `npm run verif:prod` | la CONFIGURATION avant déploiement — bloquants vs alertes, code de sortie 1 |

Les contrôles de concurrence, d'expiration et d'annulation écrivent en base :
ils fabriquent leurs propres données, les suppriment en `finally`, et ne
touchent jamais aux dossiers réels. `verif:sms` et `verif:solde` n'écrivent
rien et ne consomment aucun quota — ils parlent au fournisseur, pas à la base.



## Hébergement : Vercel (décision d'Alexandre, 2026-11-05)

`vercel.json` fixe la région `cdg1` (Paris — la plus proche de Dakar parmi les
régions européennes, et les données restent dans l'UE) et déclare le cron
quotidien à 3 h UTC, qui est aussi 3 h à Dakar toute l'année.

Quatre contraintes de la plateforme touchent CE projet en particulier. Les
trois premières sont traitées dans le code ; la quatrième est une décision.

### 1. Vercel ne sait pas lancer un script — `/api/cron/expiration`

`npm run cron:expiration` reste la voie normale sur un serveur qui tourne en
continu. Vercel ne sait que frapper une URL, d'où cette route, qui appelle
**exactement la même fonction** : aucune logique n'est dupliquée, donc les deux
voies ne peuvent pas dériver l'une de l'autre.

Elle est protégée par `CRON_SECRET`, et **se désactive (503) si le secret est
absent** plutôt que de fonctionner sans protection : libérer des motos sur
simple appel public serait pire que ne pas les libérer. Le piège évité est celui
de la forme qu'on lit partout :

```ts
if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
```

Sans variable définie, elle compare à la chaîne « Bearer undefined », qu'il
suffit d'envoyer. L'ordre est donc inversé — refuser l'absence de secret
d'abord, comparer ensuite, et à temps constant pour ne pas livrer le secret à
qui mesure les durées de réponse.

### 2. Vercel coupe à 10 s — et l'envoi SMS en prend 25

C'est la contrainte la plus sournoise, parce qu'elle annulerait silencieusement
un correctif déjà en place. L'API Dexchange parle à l'opérateur avant de
répondre, d'où `DELAI_DEXCHANGE_MS = 25_000`. Or un délai dépassé **n'annule
pas** le SMS déjà lancé : le client recevrait un code que `demanderCode` vient
d'invalider en voyant l'échec. D'où `export const maxDuration = 60` sur les
deux routes qui envoient — `/api/auth/otp/demander` et `/api/signature` — et sur
la route de cron, qui traite plusieurs réservations.

### 3. Vercel n'a pas de disque — `STORAGE_DRIVER="local"` y est inopérant

Le système de fichiers est en lecture seule hors `/tmp`, et `/tmp` disparaît
avec l'instance. Ce n'est donc pas « risqué », c'est inopérant : les pièces
d'identité et les PDF signés seraient perdus, et les preuves des contrats avec
eux. `npm run verif:prod` détecte la variable `VERCEL` et **transforme cette
alerte en bloquant** sur cette plateforme. N'importe quel service S3 convient
(Scaleway, OVH, R2, AWS) : le pilote `s3` existe déjà.

### 4. Le pool de connexions — la décision qui reste

Chaque instance ouvre son propre pool, et Vercel en démarre autant que le
trafic l'exige : 10 connexions par instance saturent une base managée en
quelques dizaines d'instances. Descendre `DATABASE_POOL_MAX` à 1-3 ET passer par
le pooler du fournisseur (PgBouncer, pooler Neon). Le contrôle le signale dès
qu'il tourne sur Vercel.

### Le stockage reste chez Vercel : `STORAGE_DRIVER="vercel"`

Décision du 2026-11-05 — « je reste que sur vercel ». Aucun prestataire
supplémentaire, donc une seule facture et un seul tableau de bord. Le pilote
`drivers/vercel.ts` existait déjà et `@vercel/blob` était déjà installé.

**Les blobs sont écrits en accès PRIVÉ**, découvert le 2026-11-05 en relisant le
SDK : la version 2 accepte `access: "private"`, et un blob privé exige un jeton
pour être lu. La version précédente n'offrait que des URL publiques non
devinables, ce qui obligeait à faire reposer toute la confidentialité sur le
chiffrement applicatif. Le pilote a été réécrit en conséquence — la lecture
passe maintenant par `get(chemin, { access: "private" })` et son flux, non plus
par un `fetch` de l'URL. Fait **avant** qu'aucun document n'existe, donc sans
aucune migration.

Trois couches protègent donc les pièces d'identité :

1. **l'accès au blob est refusé sans jeton** ;
2. le contenu est **chiffré par l'application avant d'arriver au pilote** —
   `index.ts` lui passe `chiffrer(...)`, et la clé ne quitte jamais nos
   variables d'environnement ;
3. le type MIME est générisé en `application/octet-stream` : rien ne dit même
   qu'il s'agit d'un PDF ou d'une photo.

`STORAGE_PATH_SALT` reste **obligatoire en production** et le pilote refuse de
démarrer sans lui. Ce n'est plus la barrière principale depuis l'accès privé,
mais se dégrader en silence sur un stockage de pièces d'identité n'est pas
acceptable, et cette couche ne coûte rien.

`BLOB_READ_WRITE_TOKEN` est injecté automatiquement par Vercel dès que le
stockage est créé dans l'onglet *Storage* : il ne se renseigne à la main que
pour travailler hors de la plateforme.

### Exploitation : forcer la relecture des variables d'environnement

**Les variables Vercel sont liées au DÉPLOIEMENT, pas au projet.** Une variable
ajoutée après coup n'atteint le site qu'à la construction suivante — et le
bouton « Redeploy » du tableau de bord ne la fait pas toujours relire. Le
2026-11-06, une demi-heure a été perdue à croire `BLOB_READ_WRITE_TOKEN`
absente alors qu'elle était seulement non lue.

Le geste qui marche, et qui déclenche une vraie construction :

```bash
git commit --allow-empty -m "chore: forcer un déploiement pour relire les variables"
git push
```

Comptez une à deux minutes avant que le nouveau déploiement serve le trafic.

### Exploitation : lire l'état réel plutôt que le journal

Deux pièges se sont présentés le même jour, et ils se contournent de la même
façon — en provoquant une trace fraîche au lieu de lire l'historique.

**Le journal Vercel affiche un historique.** Des lignes antérieures à un
correctif ressemblent à des erreurs actuelles. Pour obtenir une ligne
horodatée MAINTENANT, appeler la sonde depuis l'extérieur :

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<domaine>/api/sante
```

Chaque appel écrit sa ligne. Un **200** atteste la base ET la configuration du
stockage ; un **503** fait écrire `[sante] stockage non configuré : <variable>`
dans les journaux, où le nom de la variable manquante se lit directement. La
réponse publique, elle, ne révèle rien.

**Et ne pas conclure d'un `curl` qui échoue.** Un `000` signifie que rien n'a
répondu — serveur arrêté, bascule de déploiement en cours —, et un `grep` sur
une réponse vide compte zéro, ce qui ressemble à un succès. Vérifier qu'une
page contient ce qu'elle doit contenir, pas seulement qu'elle ne contient plus
ce qu'on a retiré.

### Migrations : le SENS décide de l'ordre (2026-11-12)

Les deux ordres ont été éprouvés le même jour, dans les deux sens, et chacun a
causé une panne.

| Migration | Ordre | Sinon |
|---|---|---|
| **ADDITIVE** (colonne, valeur d'énumération) | `migrate deploy` **PUIS** le code | le code déployé réclame une colonne absente |
| **DESTRUCTIVE** (`DROP COLUMN`, retrait d'une valeur) | le code servi **PUIS** `migrate deploy` | l'ancien code, encore en vol, sélectionne ce qui vient de disparaître |

**`/api/sante` ne peut pas dire à lui seul si un déploiement est servi**, et
c'est ce qui a coûté vingt minutes de production. La sonde répondait 200
pendant l'attente parce que l'ANCIEN code allait parfaitement avec l'ANCIEN
schéma : elle ne devient rouge qu'une fois la migration passée, donc trop tard.
Attendre deux minutes à la montre n'est pas une preuve.

D'où le champ `commit` dans sa réponse. **Avant une migration destructive,
constater que le commit servi est bien le vôtre :**

```bash
curl -s https://<domaine>/api/sante     # {"statut":"ok","commit":"bb4a7bc"}
git rev-parse --short HEAD              # doit donner le même
```

Si les deux diffèrent, la construction n'est pas finie — ou elle a échoué.
`git commit --allow-empty` puis `git push` force une vraie construction, et la
bascule se voit à un `000` passager suivi d'un 200.

**Pour atteindre la production**, forcer l'URL : `prisma.config.ts` fait lire
`.env.local` avant `.env`, donc toute commande Prisma vise la base LOCALE par
défaut — garde-fou voulu, et `db:reset` est sans danger grâce à lui.

```powershell
$env:DATABASE_URL = (Get-Content .neon-direct.url -Raw).Trim()
npx prisma migrate deploy
```

Le `DATABASE_URL` de `.env` pointe sur une base Neon **abandonnée** (aucune
table applicative) : ce n'est pas l'adresse de la production.


## Conservation des pièces d'identité — SANS LIMITE DE DURÉE (2026-11-15)

**Décision d'Alexandre : les pièces justificatives sont conservées de façon
indéterminée.** Rien n'est effacé, et aucune date d'effacement n'est même
posée — `purgeApres` et `purgeAt` restent nuls.

La règle précédente était : 48 heures après le RETRAIT COMPLET — contrat final
signé des deux côtés, état des lieux fait, moto livrée, `Handover.completedAt`
marquant cet instant. Elle est **éteinte**, pas supprimée.

### Pourquoi éteindre plutôt que supprimer

Une règle de conservation se révise dans les deux sens. Le mécanisme est écrit,
éprouvé par `npm run verif:purge` sur de vrais blobs, et il décide
correctement du cas difficile : un client aux dossiers multiples, dont l'un
attend encore le retrait — purger après la livraison d'un autre supprimerait la
pièce que le gérant doit encore examiner. Le réécrire un jour sous la pression
d'un avis juridique serait la pire façon de le remettre en service.

**Pour le rallumer**, les deux gestes vont ensemble :
`PURGE_PIECES_ACTIVE="true"`, et remettre l'entrée `/api/cron/purge` dans
`vercel.json` — elle en a été retirée, sans quoi Vercel frapperait chaque nuit
une route qui ne fait plus rien. Le délai reste réglable par
`PURGE_PIECES_HEURES`.

`npm run cron:purge` et `/api/cron/purge` le DISENT quand la purge est
éteinte, au lieu de répondre « 0 pièce effacée » — ce qui se lirait comme un
cron en bonne santé n'ayant rien trouvé à faire.

### Ce que cela engage

Une photographie de carte d'identité est la donnée la plus sensible du système.
La garder indéfiniment est un choix d'exploitant, pas un défaut : il appelle
une mention dans la politique de confidentialité et, le jour venu, un avis au
regard de la loi 2008-12 et de la CDP. Le chiffrement au stockage et l'absence
d'URL publique restent les deux protections qui, elles, ne dépendent d'aucun
délai.

Rien dans l'interface n'annonçait les 48 heures au client — vérifié avant le
changement. Les neuf requêtes filtrant `where: { purgeAt: null }` continuent
de fonctionner sans rien changer : elles voient simplement toujours toutes les
pièces.

## Compression des pièces à la réception (2026-11-15)

Conséquence directe de la conservation indéterminée : ce qui entre dans le
stockage y reste, donc chaque kilo-octet l'est pour toujours.
`lib/pieces-compression.ts` ramène chaque image à **1600 px en WebP, qualité
76**, avant l'écriture. Mesuré : une pièce telle que le navigateur l'envoie —
1800 px, 221 Ko — tombe à **112 Ko, soit 49 % de moins**. À 1600 px une carte
d'identité occupe encore plus de 1200 pixels de large, au-delà de 350 points
par pouce : le numéro reste lisible avec de la marge.

### Deux étages, et ce n'est pas une redondance

`DossierForm` compresse déjà DANS LE NAVIGATEUR, aux mêmes réglages — d'abord
pour le client, dont le forfait mobile sénégalais paie chaque octet. Mais cette
compression-là est une **convention** : elle dépend d'une bibliothèque chargée
à la demande et d'un formulaire qu'on peut contourner. Celle du serveur est une
**garantie** : rien n'entre dans le stockage sans y passer.

### Trois effets de bord qui valaient à eux seuls le détour

1. **Les métadonnées partent.** Une photo de téléphone porte souvent les
   coordonnées GPS du lieu de la prise de vue — sur une carte d'identité, le
   domicile du client.
2. **L'orientation est appliquée, pas perdue.** Un téléphone tenu à la
   verticale enregistre des pixels COUCHÉS et pose `orientation: 6` pour
   qu'on les redresse. Les pixels mentent, l'EXIF dit la vérité, et la
   conversion jette l'EXIF : sans `.rotate()` AVANT, la pièce est stockée
   couchée pour toujours. C'est le piège classique, et `verif:compression`
   le garde.
3. **Le HEIC devient lisible.** Un iPhone envoie du HEIC, que Chrome et
   Firefox ne savent pas afficher : la pièce partait au stockage dans un
   format que le gérant ne pouvait pas ouvrir.

### Les deux garde-fous d'écriture

**L'ordre compte** : le type réel est établi sur les octets REÇUS
(`lib/fichiers.ts`), avant toute conversion — on ne compresse jamais un
fichier dont on n'a pas d'abord prouvé qu'il est ce qu'il prétend être. Et le
SHA-256 porte sur les octets STOCKÉS, c'est-à-dire sur ce que le gérant verra.

**En cas d'échec, on garde l'original.** `sharp` est un module natif : il peut
manquer dans un environnement d'exécution, un fichier peut être trop abîmé pour
être relu. Le pire acceptable est le comportement d'avant — jamais un dépôt
refusé. `sharp` est passée de `devDependencies` à `dependencies` et
figure dans `serverExternalPackages` : elle sert désormais à l'exécution, pas
seulement au build.

`npm run verif:compression` éprouve les huit propriétés, sans toucher ni la
base ni le stockage.

### Ce que la compression ne résout PAS : le volume des constats

Un dossier complet pèse 8 à 9 Mo, dont les pièces d'identité ne font qu'un
quart. Le gros vient des **photos de constat** — minimum 4 à la remise, 4 à la
restitution, 0,8 Mo chacune, et aucun plafond au nombre. Elles ne passent PAS
par `comprimerPiece` : elles ont leur propre route, et elles sont embarquées
dans les PDF par `pdf-lib`, qui ne lit que JPEG et PNG — les convertir en
WebP casserait les actes. Si le stockage devient un sujet, les leviers sont là :
plafonner le nombre de photos, ou descendre de 1600 à 1200 pixels.

## Quotas OTP : le verrou par IP distingue les buts (2026-11-16)

`npm run verif:quotas` — 6 contrôles, données temporaires, aucun message envoyé.

| verrou | avant | après |
|---|---|---|
| par destinataire, tous buts | 3 / 15 min, 10 / 24 h | **5** / 15 min, 10 / 24 h |
| par IP, `CONNEXION` | 10 / 15 min, 40 / 24 h | inchangé |
| par IP, `SIGNATURE` | 10 / 15 min, 40 / 24 h | **60 / 15 min, 240 / 24 h** |
| plafond global SMS | 50 / h | **150 / h** |

### Pourquoi la signature n'est plus logée à la même enseigne

Le « SMS pumping » suppose de **choisir** le numéro surtaxé qu'on fait appeler.
À la connexion, l'appelant saisit librement ce numéro : le verrou par IP y est
la protection principale, et il reste strict. À la signature, le numéro vient
du compte attaché au contrat et l'appel exige un jeton de signature qui est
lui-même un secret — le verrou n'y protégeait presque rien.

Pendant ce temps, il pouvait bloquer un vrai client. **Au retrait, le client
signe sur place**, souvent par le wifi de la boutique : tous les clients du
jour y partagent une seule adresse, et à deux codes chacun les 40 quotidiens
tombaient au vingtième. Le NAT des opérateurs sénégalais aggrave le cas — des
abonnés sans rapport entre eux partagent une même adresse publique. Le client
se retrouvait devant le gérant, incapable de signer, pour une fraude qu'il ne
pouvait pas commettre.

### Le piège que `verif:quotas` garde

**Les compteurs par IP sont filtrés PAR BUT**, comme les limites. Sans ce
filtre — et c'était le cas de ma première version — les codes de signature de
la journée gonflaient le compteur comparé au quota de connexion : le chemin
qu'on venait d'élargir rebloquait l'autre par la bande, et personne ne l'aurait
vu avant une matinée de retraits. Deux des six contrôles ne servent qu'à ça.

Le quota par destinataire, lui, reste commun aux deux buts : il protège la
personne, pas le chemin. Changer de but ne le débloque pas.

### Le plafond horaire, et la porte de secours qui n'existait pas

50 SMS/heure bloquait **tout le monde** d'un coup, client debout devant son
gérant compris : deux boutiques et quinze retraits font déjà 30 codes, avant
les connexions et les renvois. Porté à 150 dans `vercel-variables.txt` — **à
reporter sur Vercel**, le fichier ne fait pas le déploiement.

Le message invitait alors à « utiliser votre e-mail » alors que
`EMAIL_DRIVER=console` : l'issue de secours proposée n'existait pas. Il
s'adapte désormais au canal réellement ouvert, et rementionnera l'e-mail de
lui-même le jour où il le sera. Le journal dit aussi à quel niveau le plafond
a sauté — c'est la seule trace qui permette de comprendre, après coup, pourquoi
une matinée entière n'a pas pu signer.

### Ce qui n'a PAS été touché

La gestion de la disponibilité des motos et la saisie de la flotte côté admin
(Alexandre, 2026-11-16 : « pas pour maintenant »). Le parcours complet consomme
une moto du parc existant, il ne sait pas en créer.

## Le parcours complet : `npm run e2e:parcours` (2026-11-16)

```bash
SMS_DRIVER=console npm run dev     # dans un autre terminal
npm run e2e:parcours
```

Seize contrôles éprouvent chaque brique séparément, et `e2e.ts` vérifie que
chaque écran se rend. **Aucun ne jouait la chaîne** : un client qui arrive sans
compte, dépose ses pièces, attend la validation du gérant, signe par code et
repart avec la moto. Or c'est dans les jointures que les parcours cassent.

Quarante contrôles, huit étapes, par les MÊMES routes HTTP que le navigateur :
connexion OTP d'un numéro inconnu → identité → trois pièces → soumission →
réservation en accession → validation et affectation par le gérant → contrat,
transmission, signature du client par code, contre-signature → confrontation de
la pièce, quatre photos, constat de remise → état final.

### `SMS_DRIVER=console` sur le serveur, sans quoi le script s'arrête

Le code OTP est haché en base : un script ne peut pas le relire. Avec le pilote
`console`, l'API le renvoie dans sa réponse. Sans lui, chaque étape enverrait
un vrai SMS : le script détecte l'absence de code et s'arrête AVANT d'en
demander un second. Seule la session du gérant est forgée, par `creerJeton` —
le back-office n'est pas le sujet du test.

### Trois pièges rencontrés en l'écrivant, et ce qu'ils ont appris

1. **Un numéro NEUF à chaque exécution.** Le quota anti-abus autorise 3 codes
   par destinataire et par quart d'heure ; un parcours en consomme 2. Avec un
   numéro fixe, la deuxième exécution d'affilée se heurtait à un 429
   parfaitement justifié. Le script tire donc un numéro dans `+2217000…`, hors
   des plages attribuées. La protection n'est pas contournée, elle est jouée
   par un client différent.
2. **La moto doit être RENDUE au nettoyage.** Supprimer la réservation ne
   libère pas le véhicule : il reste `EN_LOCATION`. Trois motos sur six du parc
   local y étaient déjà passées avant que le contrôle « une moto disponible
   existe » ne tombe. Le script mémorise la moto et la repose.
3. **L'ordre de suppression est imposé par deux clés étrangères non en
   cascade** — `Handover_reservationId_fkey` et `Contract_reservationId_fkey`
   retiennent la réservation. Les photos, les échéances, le dossier et les
   pièces partent seuls.

Un balayage de fin efface aussi les comptes laissés par une exécution
interrompue : la base locale ne se remplit pas de clients fantômes.

### Un contrôle qui avait tort

Le script attendait d'abord un échéancier après le scellement. **En
location-accession il n'y en a pas, et c'est voulu** : l'acte prévoit une
redevance JOURNALIÈRE, pas des mensualités — le dû se calcule jour par jour
(`duADate`). Une vente échelonnée, elle, pose cinq échéances. C'était le
contrôle qui se trompait, pas le code.

### Ce qu'il ne couvre pas

La restitution, les versements et l'annulation ont leurs propres contrôles
(`verif:versements`, `verif:annulation`). Et il ne prouve rien sur la
production : il tourne en local, contre `.env.local`, comme tous les scripts
qui écrivent.

## Avant de déployer : `npm run verif:prod`

Ce contrôle répond à une seule question — si on démarre l'application avec cet
environnement, qu'est-ce qui va mal se passer ? Il distingue deux niveaux, et la
différence est le cœur de l'outil : **BLOQUANT** (ça ne marchera pas, ou pas
sûrement — code de sortie 1) et **ALERTE** (ça marchera, mais un choix est fait
par défaut à votre place).

**C'est le SEUL script qui n'importe pas `./env-local`**, et c'est voulu. Tous
les autres s'attachent à `.env.local` pour ne jamais pouvoir écrire sur la
production ; celui-ci doit au contraire juger l'environnement RÉEL de la machine
où il tourne. Il reste sans danger parce qu'il ne lit et n'écrit aucune base :
il ne regarde que des variables. Pour l'essayer localement :
`DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/verif-prod.ts`.

Ce qu'il attrape et qu'un humain relit mal :

- **Un secret de développement recopié en production.** `AUTH_SECRET` est déjà
  contrôlé par le code, mais sur sa LONGUEUR seule : `dev-only-client-secret-…`
  fait 48 caractères et passerait. Seule son allure le trahit.
- **L'étiquette de `STORAGE_CLES_CHIFFREMENT`.** Le format est « étiquette:clé » ;
  inspecter la clé n'a pas de sens — du hasard en base64 contient n'importe quoi —
  mais l'étiquette est choisie par un humain, et `dev2026` dit tout. À remplacer
  AVANT la mise en service : la changer ensuite rendrait illisible tout ce qui
  aura été chiffré avec.
- **`STORAGE_DRIVER="local"`**, qui met les pièces d'identité et les PDF signés
  sur le disque de la machine — effacé à chaque déploiement chez la plupart des
  hébergeurs. Les preuves des contrats disparaîtraient.
- **`EMAIL_DRIVER="console"`**, donc canal e-mail fermé : un client qui
  s'identifie par une adresse ne recevra jamais son code.
- **`SUIVI_VERSEMENTS_DEPUIS` vide**, qui ferait réclamer des versements
  antérieurs à la mise en ligne.
- **`PROXY_SAUTS_DE_CONFIANCE` non réglé** : mal lu, l'IP des visiteurs devient
  falsifiable et les quotas par IP ne protègent plus rien.

Il ne touche aucune base, donc trois choses restent à faire sur l'hébergeur :
`npx prisma migrate deploy`, `npm run verif:solde` (le crédit n'est pas de la
configuration) et la planification quotidienne de `npm run cron:expiration`.
## Dexchange ne dessert QUE le Sénégal (2026-11-20)

**Établi par un vrai envoi**, pas par une supposition. `npm run verif:sms` sur
un numéro français :

```
✓ numéro normalisé en E.164
✓ FR autorisé (63 pays dans la liste)
✓ SMS_DRIVER = dexchange
KO  Dexchange a refusé — HTTP 400, « Envoi non autorisé vers ce(s)
    numéro(s) : 336… (pays non disponible) »
```

La configuration annonçait **63 pays** — les 54 d'Afrique plus neuf de
diaspora. Elle promettait donc pour le compte d'un prestataire qui ne tenait
pas : le filtre laissait passer, et l'échec survenait chez le fournisseur, où
le client ne lisait qu'une panne technique. `SMS_PAYS_AUTORISES` vaut
désormais **`SN`**, et le refus est propre et explicite.

### La liste des pays desservis n'est pas publique

Cherchée à la source avant de trancher. `docs.dexchange-sms.com` dit
seulement : « Les envois ne sont autorisés que vers les pays **activés** sur
la plateforme », et renvoie vers une page Tarifs qui répond **404**. La
spécification OpenAPI complète ne contient **aucune** énumération de pays et
**aucun** endpoint `/countries`, `/destinations` ou `/coverage` — sept
chemins seulement : `/send/sms`, `/balance`, `/send/otp`, `/verify/otp` et
trois WhatsApp.

« Activés sur la plateforme » veut dire **activés sur NOTRE compte** : ce
n'est pas une donnée publique par nature. La source faisant autorité est le
tableau de bord Dexchange, ou `support@dexchange.sn`. Alexandre a confirmé le
2026-11-20 : **le Sénégal seul**.

À savoir si la question revient : un refus « pays non disponible » **ne débite
aucune unité** (leur documentation le dit, et c'est vérifié). Tester un pays
fermé est donc gratuit ; tester un pays ouvert envoie un vrai SMS à un vrai
numéro, ce qui interdit de balayer la liste à l'aveugle.

### Trois textes promettaient avec la configuration

Ils ont été corrigés en même temps, sans quoi ils auraient survécu à la
limite qu'ils décrivaient :

1. Le refus de pays renvoyait vers « Connectez-vous avec votre adresse
   e-mail » — dont l'onglet a été retiré la veille et dont le canal est fermé
   (`EMAIL_DRIVER=console`). Proposer une issue qui n'existe pas est pire que
   d'énoncer la limite : la personne cherche une porte au lieu d'appeler la
   boutique. Le message l'invite désormais à appeler.
2. Le message d'identifiant invalide donnait « +33 6 12 34 56 78 » en exemple
   de numéro accepté.
3. L'aide du champ de connexion disait « Numéro étranger : avec l'indicatif ».

`npm run verif:quotas` garde les trois : un numéro français doit être refusé
AVANT l'envoi avec le code `PAYS_NON_DESSERVI`, et son message ne doit pas
mentionner l'e-mail.

### Le piège du « 07 », insoluble et assumé

`normaliserTelephone` retire le « zéro de courtoisie » : `0771234567` devient
`+221771234567`. Un mobile français `07 55 66 77 88` tapé sans indicatif
devient donc `+221 75 566 77 88`, un numéro sénégalais parfaitement valide —
le code partirait chez un inconnu. Les deux écritures sont rigoureusement
identiques en chiffres : **on ne peut que choisir le défaut**, et pour un
service qui ne dessert que le Sénégal, le Sénégal est le bon. Le garde-fou
reste l'écran suivant, qui affiche `+221 ••••• 88` : un étranger y verrait
son indicatif changé.

## Envoi des codes : Dexchange (2026-11-04)

Choix d'Alexandre : **Dexchange, fournisseur basé à Dakar, devient la route du
Sénégal**. C'est le premier fournisseur dont un SMS soit réellement arrivé sur
un téléphone sénégalais — expéditeur `LM-EXPRESS` validé le 2026-11-03 et
livraison constatée sur Orange (77), Expresso (70) et Free (76). C'est
désormais le SEUL fournisseur de SMS du projet : voir plus bas pourquoi les
deux autres ont été retirés.

- `SMS_DRIVER="dexchange"` → `src/lib/envoi/index.ts`,
  `POST {base}/send/sms`, corps `{ signature, content, number: [...] }`.
  Variables : `DEXCHANGE_API_KEY`, `DEXCHANGE_SIGNATURE`, et au besoin
  `DEXCHANGE_BASE_URL`, `DEXCHANGE_AUTH_HEADER`, `DEXCHANGE_AUTH_PREFIX`.
- **Leur documentation se trompe sur sa propre authentification.** Elle annonce
  `X-Api-Key` et présente `Authorization: Bearer` comme déprécié : c'est
  l'inverse, seul Bearer est accepté et le reste répond 401. D'où l'en-tête et
  son préfixe en variables — le jour où leur migration aboutit, on bascule sans
  toucher au code. Un 401 sur une clé que l'on sait bonne vient de là.
- **L'API veut le numéro sans le `+`** (`221772922620`) là où nous stockons de
  l'E.164. Le `+` est retiré dans le pilote, au plus près du fournisseur, pour
  que le reste du code ignore cette bizarrerie.
- **Le compte est PRÉPAYÉ, et c'est le vrai risque d'exploitation.** Un solde à
  zéro n'est pas une gêne : c'est le site fermé, plus aucune connexion ni
  signature, et rien ne le dit dans l'application. D'où `soldeDexchange()` et
  `npm run verif:solde`, dont le CODE DE SORTIE est l'alerte (0 bon, 1 sous le
  seuil, 2 illisible) : un crontab poste ce qui part sur la sortie d'erreur, ce
  qui donne la supervision sans dépendre de notre canal e-mail — lequel serait
  précisément en panne si la clé était le problème. Seuil à 200 SMS et non 20 :
  un seuil se mesure en délai de rechargement, pas en messages.
- Leur réponse ne porte **aucun statut par message**, là où d'autres API en
  fournissent un : chez eux, un 200 vaut acceptation et rien de plus.
  L'identifiant `[dexchange]` journalisé est la seule prise pour retrouver un
  envoi auprès de leur support.
- **Accents interdits dans un SMS** : un seul fait basculer le message en
  UCS-2, 70 caractères au lieu de 160, et double la facture. `gsm7()` les
  retire et le signale dans les journaux pour qu'on corrige à la source.

### Ce qui n'a PAS été repris du module fourni

Le module livré par un autre fil était autonome et refaisait notre moteur OTP.
Seuls le transport et la surveillance du solde ont été greffés. Écartés, et
pourquoi :

| Écarté | Raison |
|---|---|
| `lib/otp/service.ts` | notre `src/lib/otp.ts` est plus strict : HMAC et non SHA-256 nu, verrou consultatif, plafonds par IP et globaux, essai réservé atomiquement avant comparaison, liste de pays |
| `OTP_PEPPER` | `cleDerivee("otp")` dérive déjà du secret existant ; un second secret pour le même usage est un second secret à perdre |
| `lib/prisma.ts` | le nôtre utilise le client généré et `@prisma/adapter-pg` |
| routes `/api/otp/*` | les nôtres vivent sous `/api/auth/otp/` et sont déjà branchées |
| `OtpVerifyForm.tsx` | classes Tailwind, alors que les espaces n'utilisent que `lme-` ; `ConnexionForm.tsx` fait déjà le travail |
| `vercel.json` | l'hébergeur n'est pas choisi — un script reste appelable partout |
| Resend | le pilote `smtp` couvre déjà n'importe quel service d'e-mail, et Alexandre a remis ce canal à plus tard |
| `whatsappFallback` | Dexchange y génère SON code à 4 chiffres : cela court-circuite notre chaîne de preuve, inutilisable pour une signature |

## Infobip et Twilio ont été RETIRÉS (2026-11-04)

Décision d'Alexandre après la mise en service de Dexchange. Les deux pilotes,
leurs variables et leur documentation sont supprimés du dépôt. La raison tient
en une phrase : **aucun des deux n'a jamais délivré un seul SMS**, ni au Sénégal
ni en France, et garder deux pilotes morts donnait l'illusion d'un repli qui
n'existait pas.

Ce qu'il faut en retenir, si la question d'y revenir se posait :

- **Infobip.** Onze envois de test, deux causes distinctes lues dans leurs
  journaux : en France `EC_ACCOUNT_NOT_PROVISIONED_FOR_CHANNEL` (le pays n'était
  pas ouvert sur le compte), au Sénégal `EC_SM_DELIVERY_FAILURE` sur six envois,
  vers deux numéros dont un téléphone de gérant actif sur place. La demande
  d'enregistrement de l'expéditeur `LMEXPRESS`, déposée le 2026-10-02 par leur
  route « International » avec lettre d'autorisation, est restée sans réponse —
  alors que leur route « Local » déclarait cet enregistrement impossible car non
  requis. Le compte reste approvisionné : **la clé d'API doit être révoquée dans
  leur portail**, elle ne sert plus à rien ici.
- **Twilio.** Jamais mis en service. Vers le Sénégal, un long numéro
  international est de toute façon bloqué par Orange et Expresso (erreur
  21612), et l'expéditeur alphanumérique y exige un compte payant.
- **La leçon de méthode**, qui vaut plus que les deux diagnostics : c'est
  d'avoir enfin lu les ACCUSÉS DE LIVRAISON, chez Infobip, qui a tranché ce que
  le raisonnement n'arrivait pas à trancher. Sur le trajet, une corrélation —
  cinq échecs d'affilée — a été prise pour une cause. Ne jamais conclure d'un
  faisceau d'échecs sans le journal du fournisseur sous les yeux.

L'abstraction a fait son travail : remettre un fournisseur demande un
`Transport` et une ligne dans le sélecteur de `src/lib/envoi/index.ts`, rien de
plus. Aucune ligne métier n'a bougé en changeant d'opérateur.

### E-mail : fournisseur à choisir, sous-domaine déjà décidé

Expéditeur retenu : `no-reply@email.lamotherexpress.com`.

Le **fournisseur** est redevenu une question ouverte — Infobip portait l'e-mail
par son relais SMTP, et Dexchange ne fait pas d'e-mail. Ce choix ne demande
aucun code : le pilote `smtp` accepte Brevo, Mailjet, Amazon SES, OVH, Scaleway
TEM. Quatre variables, et c'est tout.

Le **sous-domaine**, lui, reste décidé et vaut pour n'importe quel fournisseur.
`lamotherexpress.com` sert la V1 et Alexandre n'a pas la main sur ses DNS. Le
sous-domaine `email.lamotherexpress.com` résout les deux problèmes à la fois :
il isole la réputation d'envoi du domaine principal, et aucun enregistrement de
la racine n'est touché, donc **le site V1 ne peut pas être affecté**.

L'argument qui l'établit, et qui ne dépend d'aucun prestataire : les
enregistrements de vérification sont pour l'essentiel des **CNAME**, et un CNAME
ne peut pas être posé sur l'apex d'un domaine. Ils vivent donc nécessairement
sur des sous-domaines et ne peuvent pas remplacer l'enregistrement A qui sert le
site.

**Sans vérification du domaine, aucun e-mail ne part**, quel que soit le
fournisseur — le relais SMTP seul ne suffit pas. C'est un préalable
administratif, pas du code. Compter jusqu'à 48 heures de propagation DNS.
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
ne s'exécutait jamais. **Les fichiers ont été supprimés de `public/assets/` le 2026-11-14**,
avec `interaction-handler.js`, `ion.rangeSlider.css`, `slick.css` et `slick-theme.css` :
1,45 Mo que plus aucune balise ne demandait. Le décrochage avait déjà rendu le gain de
performance ; cette suppression ne change rien pour le visiteur, elle retire le piège.

Vérification faite sélecteur par sélecteur : aucune cible de `main.js` n'existe dans
l'application (`.gallery-slider`, `.gallery-slider-nav`, `#range-price`, `#range-mileage`,
`#page-preloader`). jQuery ne servait plus qu'à ces scripts morts, et était chargé en
`beforeInteractive` — il bloquait le rendu pour rien. Les icônes sociales du footer sont en
SVG inline depuis longtemps, FontAwesome ne dessinait plus rien.

**Ne pas les recharger.** Si une fonctionnalité du thème est réintroduite, la réécrire en
React plutôt que de rebrancher jQuery.

## Le thème V1 : ce qui a été nettoyé, ce qui reste (2026-11-14)

### Fait
- `src/styles/accueil.css` **supprimé** : ses 18 sélecteurs étaient tous scopés sous
  `.section-hero`, `.section-videos` ou `.page-footer`, trois classes qu'aucun composant
  ne rend plus depuis la refonte. Son import est parti de `HomePageContent.tsx`.
- `src/app/globals.css` : **802 lignes retirées sur 2 415** (130 règles) — l'ancien accueil
  (`hero-slider`, `hero-particles`, `hero-scroll-cue`, `promo__*`, `videos-carousel__*`,
  `video-card__*`, `contact-branch*`, `contact-map*`, `slideshow-item*`, `block-icon`) et
  le panneau de recherche du menu (`navbar-search-form`, `navbar-overlay--search`), plus
  deux `@keyframes` que plus rien n'appelait. Critère appliqué : une règle ne part que si
  CHACUN de ses sélecteurs ne cite que des classes absentes de tout `src/**/*.tsx`.
- Les 1 613 lignes restantes servent encore le Header, les overlays, `/produits`
  (`product-item*`, `product-panel*`), `/about` et `/gallery`. Ne pas les traiter au grep.

### Le thème est entièrement décroché (2026-11-14)

Les quatre derniers fichiers ont été **supprimés** : `uikit.min.css` (264 Ko),
`main.css` (116 Ko), `uikit.min.js` (196 Ko), `uikit-icons.min.js` (63 Ko) —
**639 Ko qui partaient sur CHAQUE page**.

Ce qui a décidé de la faisabilité : une mesure sur les pages SERVIES, et non
sur le code source. Sur `/`, `/produits`, `/about`, `/gallery`, `/contact` et
`/compte/connexion`, ces deux feuilles CSS ne stylaient plus que **cinq
classes `uk-`** et **vingt-huit classes de `main.css`**, presque toutes
l'en-tête et le menu latéral. `uk-grid` et `uk-inline-clip` paraissaient
vivantes dans le source : elles ne sont rendues par aucune page.
`is-active` et `is-anim` sur `/produits` sont stylées par le CSS propre de
`ProductExplorer` ; les règles du thème pour ces classes visaient
`.slideshow-nav__dot`, `.product-item__whish` et `.sorting-btn`, qui
n'existent plus.

**`src/styles/entete.css` est désormais la feuille UNIQUE de l'en-tête et du
menu latéral.** L'en-tête était dessiné par trois feuilles à la fois, et le
thème — chargé par `<link>`, donc APRÈS tout ce que Next empaquette —
gagnait à spécificité égale. Les rendus de `globals.css` et de
`vitrine-acces.css` (supprimée, son contenu déplacé) y sont fondus, conflit
par conflit.

#### Le piège qui a failli passer : `main.css` portait le SOCLE du site

Ces feuilles ne servaient pas que leurs classes. `main.css` déclarait les
**neuf `@font-face`**, dont Oswald en six graisses — la police de TOUS les
titres — et la typographie de base `html, body { font: normal 400 16px/1.75
Oxygen; color: #777777 }` avec ses deux tailles fluides. `uikit.min.css`
portait la remise à zéro : `body { margin: 0 }`, les marges de `p`, `ul`,
`h1`…`h6`, `img { max-width: 100% }`, `iframe { border: 0 }`.

Les supprimer sans reprendre tout cela décalait chaque page de 8 px,
remplaçait Oswald par la police système et effaçait l'interligne — **sur une
page parfaitement valide, sans qu'aucun contrôle ne le dise**. Ce socle est
repris en tête de `globals.css`, à l'identique, avec `woff2` avant `woff`
(le thème listait l'inverse, le navigateur prenait donc le plus lourd des
deux). `verif:accueil` vérifie désormais la déclaration ET le fichier.

La balise `<style>` de `layout.tsx` qui forçait la police système a été
retirée : elle ne s'appliquait pas — `main.css` passait après — et supprimer
`main.css` l'aurait rendue active d'un coup.

#### Trois départs volontaires de l'original

1. `a:hover { color:#e63619; text-decoration:underline }` n'est pas repris.
   C'est le rouge qui repeignait tous les liens du site, relevé par Alexandre
   sur « Réserver » et « La fiche ». Les neuf blocs de contournement ajoutés
   le matin même dans `src/styles/*.css` sont retirés : la cause a disparu.
2. `em { color:#f0506e }` non repris — un rose de défaut d'UIkit. Les deux
   seuls `<em>` du site ont leur couleur.
3. Les liens du menu latéral redeviennent **blancs, gras, 14 px**, comme
   `globals.css` l'écrivait depuis la refonte : `.uk-nav-default > li > a`
   les imposait en gris `#999` sur 5 px, à spécificité égale mais en
   arrivant après. Et la carte téléphone ne devient plus rouge au survol.

#### Contrôle de non-régression appliqué

Pour chaque classe RENDUE par les six pages, vérifier qu'une règle existe
encore dans ce qu'on sert. Résultat : six classes sans règle, toutes sans
objet — cinq `lucide-*` posées par les icônes, qui n'en ont jamais eu, et
`page-home`, dont les seules règles visaient `.section-hero__bg`, supprimée.
**Reproduire ce contrôle avant de toucher à `globals.css`.**

#### Ce qui reste comme poids mort, mesuré

- `src/components/ProductCard.tsx` n'est utilisé par AUCUNE page — il n'est
  cité que dans un commentaire de `HomeBestSellersSection`. Les règles
  `product-item*` et `product-panel*` de `globals.css` ne sont donc rendues
  nulle part : `/produits` est servi par `ProductExplorer`, qui porte son
  propre CSS.
- `public/assets/fonts/Oxygen-*` reste nécessaire : le texte courant des
  pages d'avant la refonte s'appuie dessus.

### Ne pas juger les images au grep
Les variantes (`A10-400.webp`, `chezlamother-768.webp`…) sont désignées par le manifeste à
l'exécution, pas par leur nom dans le code. Un grep les déclare orphelines à tort : 43 des
76 fichiers de `public/assets/img` répondent à ce faux positif.

## Contexte Vercel

Le site a été coupé (`402 DEPLOYMENT_DISABLED`) en septembre 2026 après un dépassement du
quota Fast Data Transfer : 303 GB pour 100 GB autorisés. Cause identifiée — un scraper via
Londres (`lhr1`), 650K requêtes soit 76,8 % du trafic, contre 18,8 % pour Paris et 2,3 % pour
Le Cap qui constituent le public réel.

Traité par : **Bot Protection en mode challenge** (Firewall Vercel), la conversion WebP et la
suppression des scripts morts. Toute régression sur le poids des pages a un coût direct et
immédiat sur ce quota.
