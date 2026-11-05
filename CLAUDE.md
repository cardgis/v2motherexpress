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
**NE PLUS CHARGER CE SCRIPT.** La balise `<Script>` a été retirée de `layout.tsx`.
Le fichier `public/assets/js/interaction-handler.js` existe encore mais n'est pas chargé.
Toute gestion d'Escape ou de clic est désormais faite dans les composants React (Header, ProductCard).

## Prisma
- Schéma dans `prisma/schema.prisma`
- Client généré dans `src/generated/prisma/`
- Import : `import { prisma } from "@/lib/prisma"`

## Administration et rôles (V2)
- Compte administrateur UNIQUE (`User.role = ADMIN`), désigné par
  `npm run admin:designer -- "<mobile ou e-mail>" "Prénom NOM"` : tout autre
  admin redevient client, sessions révoquées. Connexion par code comme les
  autres comptes. L'ancien accès par mot de passe (`admin-auth.ts`,
  `/admin/login`) est supprimé ; la table `AdminUser` reste pour l'historique.
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
supplémentaire, donc une seule facture, un seul tableau de bord, un seul
incident possible. Le pilote `drivers/vercel.ts` existait déjà et
`@vercel/blob` était déjà installé : il n'y avait rien à écrire.

**Vercel Blob n'offre que des URL publiques, non devinables.** Trois couches
rendent cela acceptable pour des pièces d'identité :

1. le contenu est **chiffré par l'application avant d'arriver au pilote** —
   `index.ts` lui passe `chiffrer(...)`, et la clé ne quitte jamais nos
   variables d'environnement ;
2. le type MIME est générisé en `application/octet-stream` : rien ne dit même
   qu'il s'agit d'un PDF ou d'une photo ;
3. le chemin est préfixé d'une empreinte salée, donc une URL connue ne permet
   pas de deviner ses voisines.

**Ce qu'on perd, et qu'il faut assumer :** un conteneur réellement privé (s3,
azure) ne livrerait RIEN à une URL devinée ; ici il livrerait du chiffré. La
défense est d'une couche plus mince — acceptable, pas équivalent. Si la CDP
sénégalaise exigeait un accès restreint, `STORAGE_DRIVER="s3"` suffit, sans
toucher au code métier.

**`STORAGE_PATH_SALT` devient donc porteur, et il échouait en silence.** Le
pilote retombait sur le chemin brut quand le sel manquait : sur des URL
publiques, prévisible veut dire **énumérable**, et on aurait pu aspirer tous
les blobs chiffrés sans deviner une seule adresse. Le pilote lève désormais une
erreur en production, et `verif:prod` en fait un bloquant. En développement le
repli reste commode et sans enjeu.

`BLOB_READ_WRITE_TOKEN` est injecté automatiquement par Vercel : il ne se
renseigne que pour travailler hors de la plateforme.
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
