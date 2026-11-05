# Architecture de la V2 — sécurité, identifiants, hébergement

Ce document explique **ce qui a été construit, pourquoi, et comment le
vérifier**. Il complète `docs/tester-en-local.md` (lancer et tester) et
`docs/modeles-contrats.md` (texte des actes).

---

## 1. Vue d'ensemble

```
Navigateur ─► proxy.ts (anti-CSRF) ─► Routes API ─► src/lib (métier) ─┬─► PostgreSQL (Prisma)
                                                                       ├─► Stockage chiffré ─► local | S3 | Azure | Vercel
                                                                       └─► Envoi des codes ─► SMS (Twilio) | E-mail (SMTP)
```

Trois principes tiennent l'ensemble :

1. **Le code métier ne connaît aucun fournisseur.** Stockage, SMS et e-mail
   passent par une interface ; le fournisseur se choisit par variable
   d'environnement. Changer d'hébergeur ne réécrit rien.
2. **Rien ne vient du navigateur sans être revalidé côté serveur** : montants,
   type des fichiers, identifiants, champs du catalogue.
3. **Tout l'état partagé vit en base** (sessions révocables, quotas de codes,
   compteurs de références). On peut donc lancer plusieurs instances du
   serveur derrière un répartiteur de charge sans Redis ni session collante.

---

## 2. Connexion par téléphone OU par e-mail

### Ce qui a changé

| Avant | Maintenant |
|---|---|
| Numéro sénégalais uniquement | Tout mobile valide, sénégalais ou étranger |
| Téléphone obligatoire | Téléphone **ou** e-mail |
| Code par SMS (simulé) | SMS (Twilio) ou e-mail (SMTP) selon l'identifiant |

### Fichiers

- **`src/lib/identifiant.ts`** (serveur) — reconnaît la saisie : un `@` →
  e-mail, sinon téléphone. Normalise :
  - téléphone → format international E.164 (`+221771234567`,
    `+33612345678`) avec `libphonenumber-js`. Les écritures sénégalaises
    habituelles restent acceptées (`77 123 45 67`, `0771234567`,
    `00221…`, `221…`). Les **fixes sont refusés** : ils ne reçoivent pas de
    SMS ;
  - e-mail → minuscules, espaces retirés. `Emma@Exemple.COM` et
    `emma@exemple.com` ouvrent le **même** compte.
- **`src/lib/phone.ts`** (client et serveur) — affichage et masquage :
  `+33 •••••• 56 78`, `em•••••@exemple.com`. Aucun identifiant complet ne
  transite dans une réponse d'API ni dans les journaux.
- **`src/components/compte/ConnexionForm.tsx`** — deux onglets, *Téléphone* /
  *E-mail*, avec le clavier adapté à chacun sur mobile.

### Base de données

- `User.telephone` devient facultatif ; une **contrainte CHECK** en base
  interdit un compte sans téléphone ni e-mail.
- `Customer.telephoneContact` : un client connecté par e-mail déclare dans son
  dossier le numéro qui sera imprimé sur le contrat. Ce numéro **n'est jamais
  vérifié ni utilisé pour se connecter** : sinon quelqu'un pourrait déclarer
  le numéro d'un tiers et capter ses accès.
- `Signature.email` : la preuve de signature enregistre l'adresse qui a reçu
  le code, et le PDF scellé porte le canal réel : « code à usage unique
  (EMAIL) » en production. En développement il indique « (CONSOLE) » : une
  preuve ne prétend jamais qu'un message est parti quand aucun ne l'a été.

---

## 3. Codes à usage unique (OTP) — `src/lib/otp.ts`

Le code est ce qui relie une signature à une personne. Il est traité comme un
mot de passe.

| Protection | Détail |
|---|---|
| Jamais en clair | Seul un HMAC-SHA256 est stocké, avec une clé dérivée de `AUTH_SECRET`. Une copie de la base ne permet pas de retrouver les codes. |
| 5 essais par code | L'essai est **réservé en base avant** la comparaison. Test réel : 40 essais simultanés → au plus 5 comparés. |
| Usage unique | Consommation atomique : soumis deux fois en même temps, il ne sert qu'une fois. |
| Lié au contrat | Un code de signature ne vaut que pour SON contrat. |
| Un seul code vivant | Une nouvelle demande annule les précédentes. |

### Limitation de débit, contre la fraude au SMS

Ouvrir la connexion aux numéros étrangers expose au **SMS pumping** : des
robots demandent des codes vers des numéros surtaxés, et c'est l'entreprise
qui paie les SMS. Quatre verrous cumulés :

- **par destinataire** : 3 codes / 15 min, 10 / 24 h ;
- **par adresse IP** : 10 codes / 15 min, 40 / 24 h ;
- **plafond global** de SMS par heure (`OTP_PLAFOND_SMS_HEURE`), qui coupe
  la facture net en cas d'attaque distribuée ;
- **pays autorisés par SMS** (`SMS_PAYS_AUTORISES`) ; les autres visiteurs
  passent par l'e-mail, qui ne coûte rien.

Le contrôle des quotas et la création du code se font sous un verrou
PostgreSQL propre au destinataire : deux demandes simultanées ne passent pas
toutes les deux sous le seuil.

### Adresse IP fiable — `src/lib/requete.ts`

Le premier élément de `X-Forwarded-For` est écrit par le client lui-même : s'y
fier permettrait à un robot de changer d'adresse à chaque requête. L'adresse
est lue **depuis la droite**, en sautant `PROXY_SAUTS_DE_CONFIANCE` proxys.
Testé : une fausse adresse ajoutée en tête est ignorée.

### Envoi — `src/lib/envoi/`

- `SMS_DRIVER` : `console` (développement), `infobip` (choix retenu le
  2026-10-02), `twilio` (conservé comme solution de repli), `orange`
  (emplacement réservé). Tous appellent l'API REST directement, sans SDK.
- **Infobip porte les deux canaux** : son SMS par `SMS_DRIVER="infobip"`, son
  e-mail par son relais SMTP — donc par le pilote `smtp` existant, sans une
  ligne de code propre. C'est ce que l'abstraction promettait.
- Piège Infobip : un **HTTP 200 ne vaut pas acceptation**. Le sort de chaque
  message est dans le corps de la réponse (`status.groupId` : 1 PENDING = parti,
  2 UNDELIVERABLE, 5 REJECTED). Le pilote lève une erreur sur 2 et 5 — s'arrêter
  au code HTTP ferait croire qu'un code OTP est parti alors qu'il a été refusé.
- `EMAIL_DRIVER` : `console`, `smtp` (Brevo, Mailjet, Amazon SES, Azure
  Communication Services, OVH, Scaleway…), connexion TLS obligatoire.
- Messages **bilingues français / anglais** ; SMS sous 160 caractères sans
  accent, pour tenir en un seul segment facturé.
- Le driver `console` renvoie le code à l'écran pour développer : il est
  **refusé en production**.

> Twilio et SMTP sont codés selon leur documentation mais **n'ont pas pu être
> testés sans compte**. À valider avec les vrais identifiants avant la mise en
> ligne.

---

## 4. Sessions — `src/lib/auth.ts`

- Jeton signé HMAC-SHA256, clé **dérivée** de `AUTH_SECRET` par HKDF
  (`src/lib/secrets.ts`) : sessions et codes n'utilisent jamais la même clé.
- `AUTH_SECRET` d'au moins 32 caractères **exigé en production**.
- **Révocation** : `User.versionSession` est inscrit dans le jeton. La
  déconnexion l'incrémente, ce qui invalide tous les jetons émis sur tous
  les appareils, y compris un cookie volé. Testé : un cookie rejoué après
  déconnexion est rejeté.
- Durées : client 30 jours, gérant 7 jours, administrateur 1 jour (ils voient
  des pièces d'identité).
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production.
- Rôle, boutique et état actif **relus en base à chaque requête** : un gérant
  révoqué perd l'accès immédiatement.

---

## 5. Stockage des pièces d'identité — `src/lib/storage/`

### Chiffrement applicatif — `chiffrement.ts`

Tous les fournisseurs chiffrent déjà leurs disques. Cela protège d'un disque
volé dans le datacenter, pas d'une clé d'accès qui fuite, d'un conteneur
rendu public par erreur ou d'une sauvegarde mal rangée. Ici, **le fournisseur
ne stocke que du bruit.**

- **AES-256-GCM**, IV aléatoire par fichier.
- Le **chemin** du fichier est authentifié : un blob recopié à la place d'un
  autre (la pièce d'un client sous le dossier d'un autre) est refusé.
- Le type MIME est chiffré avec le contenu.
- **Rotation des clés** : `STORAGE_CLES_CHIFFREMENT="neuve:…,ancienne:…"`. La
  première chiffre, toutes déchiffrent.
- **Clé obligatoire en production.** Perdre les clés, c'est perdre les
  documents : les garder dans le coffre de secrets ET hors ligne.

### Fournisseurs — `drivers/`

| `STORAGE_DRIVER` | Pour | Testé |
|---|---|---|
| `local` | développement (`.storage/`) | ✓ 11/11 |
| `s3` | OVHcloud, Scaleway, AWS, Cloudflare R2, MinIO | ✓ 11/11 sur MinIO |
| `azure` | Azure Blob Storage | ✓ 11/11 sur Azurite |
| `vercel` | hébergement actuel | code conservé |

`npm run verif:stockage` vérifie sur le vrai fournisseur : aller-retour exact,
aucun octet en clair chez le fournisseur, bit modifié détecté, blob déplacé
refusé, chemin `../` refusé, suppression effective.

### Règles conservées

- Aucune URL de stockage n'est jamais exposée : toute lecture passe par une
  route qui vérifie les droits.
- Empreinte SHA-256 du contenu en clair stockée en base.
- Écriture atomique sur disque (fichier temporaire puis renommage).

### Fichiers reçus — `src/lib/fichiers.ts`

Le type annoncé par le navigateur est ignoré : **le format est lu dans les
premiers octets**. Une page HTML envoyée comme « image/jpeg » est refusée
(testé), elle ne pourra jamais s'exécuter sur notre domaine. Les tracés de
signature sont plafonnés à 1 Mo **avant** décodage et doivent être de vrais PNG.

Les pièces sont **figées dès que le dossier part en vérification**, et plus
seulement une fois validé : le client ne peut plus remplacer une pièce pendant
que le gérant l'examine.

---

## 6. Modèle de moto saisi par le gérant

Comme la date de prise d'effet et le numéro de série :

- champ **« Marque / Modèle »** dans la fiche du dossier, pré-rempli avec le
  modèle réservé (`REVOO / A10`), avec les modèles du catalogue en suggestion ;
- stocké dans `Reservation.modeleContrat`, repris par le snapshot, imprimé à
  l'article 2 du contrat et sur le constat de remise ;
- vide ou identique au catalogue → l'acte suit le catalogue ;
- **ne change ni le tarif ni la moto attribuée** : c'est une valeur
  d'impression ;
- figé dès que le contrat part à la contre-signature.

### Modes de paiement cochés par le gérant

Même mécanique pour l'article « Modalités de paiement » des deux actes :

- quatre cases dans la fiche du dossier (Espèces, Wave, Orange Money,
  Virement bancaire), au moins une exigée par l'écran avant la génération ;
- stockées dans `Reservation.modesPaiementContrat` (liste d'enum
  `ModePaiement`, ordre canonique fixé par `src/lib/modes-paiement.ts`),
  reprises par le snapshot (`modesPaiement`), cochées sur l'acte ;
- **le texte des actes ne change pas** : les libellés restent ceux des
  contrats d'origine, seules les croix sont tracées. `VERSION_MODELES`
  n'est donc pas incrémentée ;
- une valeur hors liste est refusée par l'API (400), jamais imprimée ;
- un snapshot figé avant cet ajout n'a pas le champ : ses cases restent
  vierges, comme lors de sa signature.

La route `/api/contrats` valide désormais chaque champ (longueurs bornées,
date au format `AAAA-MM-JJ`, modes de paiement dans la liste fermée).

**Défaut corrigé au passage** : l'écran envoyait la redevance sous le nom
`redevance` alors que l'API attendait `redevanceJournaliere`. Une redevance
modifiée par le gérant était donc **silencieusement ignorée**.

---

## 7. Autres protections

| Protection | Où |
|---|---|
| Anti-CSRF : une requête qui modifie doit venir de notre origine | `src/proxy.ts` |
| Anti-clickjacking, `nosniff`, HSTS, `Permissions-Policy` | `next.config.ts` |
| Lien de signature jamais transmis à un site tiers (`Referrer-Policy: no-referrer`) | `next.config.ts` |
| Attribution d'une moto atomique : deux gérants ne peuvent pas prendre la même | `src/lib/gerant/dossiers.ts` |
| Routes d'écriture en double supprimées (`/api/produits` en lecture seule) | `src/app/api/produits/route.ts` |
| Scripts limités à `.env.local`, jamais la base de production | `scripts/env-local.ts` |
| Références de dossier : un compteur en retard se réaligne seul au lieu de bloquer les réservations | `src/lib/reference.ts` |
| Erreurs Prisma reconnues par leur code (`P2002`…), jamais par `instanceof` | `src/lib/erreurs-prisma.ts` |

### Défauts trouvés par les tests et corrigés

- **Réservations bloquées en erreur 500.** Le script `verif:reference` remettait
  les vrais compteurs de références à zéro ; les réservations suivantes
  recevaient un numéro déjà attribué. Le même blocage serait survenu en
  production après une restauration de sauvegarde. Désormais l'application
  réaligne le compteur sur la plus haute référence existante et réessaie
  (`creerAvecReference`), et le script travaille sur des boutiques temporaires
  qu'il supprime. Vérifié avec une vraie collision PostgreSQL et, côté
  serveur, un compteur volontairement mis en retard : réservation acceptée,
  aucune erreur 500.
- **`instanceof` inopérant dans le serveur Next.js.** Le bundler charge le
  client Prisma en deux exemplaires : `erreur instanceof
  Prisma.PrismaClientKnownRequestError` renvoyait `false` sans bruit, et la
  collision ci-dessus n'était pas reconnue. Les erreurs sont maintenant
  identifiées par leur code documenté.
- **Redevance ignorée** : voir la section 6.

---

## 8. Interface des espaces client et gérant

### Le problème de départ

L'en-tête du site vitrine est transparent et positionné en absolu par-dessus
la page. Sur les pages client, gérant et signature, il masquait les titres
(mesuré dans un vrai navigateur : 12 pages sur 22 touchées, mobile et
ordinateur). Ces pages n'avaient par ailleurs aucune navigation propre.

### Le cadre

| Route | Cadre | Contenu |
|---|---|---|
| `/compte/connexion`, `/signer/…` | `CadreSimple` | logo, « Retour au site », aucune navigation |
| `/compte/…` | `CadreEspace` client | Mon espace · Réserver · Mon dossier |
| `/gerant/…` | `CadreEspace` gérant | Tableau de bord · Dossiers (pastille) · Flotte |

- **En-tête collant** (`sticky`) : il reste dans le flux de la page et ne peut
  donc jamais recouvrir un titre.
- **Mobile** : barre de navigation basse, à portée de pouce ; le contenu
  réserve sa hauteur en marge basse. Sur ordinateur, la navigation est dans
  l'en-tête.
- **Menu du compte** : nom, identifiant, lien vers le site, appel boutique,
  déconnexion. Fermeture par Échap, clic à côté ou changement de page.
- **Fil d'Ariane** sur les pages de détail ; sur mobile il se réduit à
  « ‹ page parente ».
- **Écran de chargement** (squelette) dans le cadre, qui ne disparaît jamais
  pendant une navigation.
- **Aiguillage par profil** : un gérant qui ouvre l'espace client est renvoyé
  au back-office ; le tableau de bord client affiche une carte « Prochaine
  étape » (signer, corriger le dossier, retirer le scooter…) ; celui du gérant
  liste les contrats à contresigner et les retraits à faire — ce dernier
  écran n'était jusque-là accessible que par le QR code du client.

### Code couleur

Un seul code, appliqué aux champs, boutons, badges et alertes
(`src/styles/espace.css`, `src/lib/statuts.ts`) :

| Couleur | Sens | Exemples |
|---|---|---|
| Doré | action principale, page active | « Continuer », onglet actif |
| Vert | succès, validation définitive | « Valider le dossier », « Signer », pièce fournie |
| Bleu | en attente d'un tiers | « Chez le client », « En vérification » |
| Ambre | action requise | pièce à fournir, contrat à contresigner |
| Rouge | erreur, action irréversible | champ invalide, « Déclarer non conforme » |
| Gris | neutre, verrouillé | identité vérifiée, acte signé |

Chaque couleur est doublée d'une icône ou d'un texte. Un même statut a la
même couleur partout, avec un libellé adapté au lecteur (« À signer » pour le
client, « Chez le client » pour le gérant).

**Formulaires** : champ obligatoire laissé vide → bordure et message rouges au
clic sur « Continuer », focus sur le premier champ fautif ; erreur renvoyée
par le serveur → affichée sous le champ concerné, en revenant à son étape ;
valeur contrôlée (mention manuscrite) → vert ; valeur figée → gris avec
cadenas. Les choix exclusifs sont de vrais boutons radio (clavier : flèches).

### Vérification

- `audit.mjs` (navigateur Edge piloté) : titre masqué, bas de page recouvert,
  débordement horizontal, erreurs console — 13 pages × mobile et ordinateur.
- `parcours.mjs` : navigation sans rechargement, en-tête conservé, onglet
  actif, menu au clavier, champs en erreur, sélection au clavier, droits.

## 8 bis. Administration et rôles d'équipe

### Profils

| Profil | Où | Peut |
|---|---|---|
| Client | `/compte` | réserver, déposer ses pièces, signer |
| Commercial | `/gerant` (sa boutique) | **consulter** dossiers, pièces, contrats, flotte |
| Gérant | `/gerant` (sa boutique) | valider, établir et signer les contrats, remettre les motos |
| Administrateur | `/admin` + `/gerant` (tout) | chiffres, boutiques, équipes, catalogue, et tout le back-office |

- **Un seul administrateur**, désigné en ligne de commande
  (`npm run admin:designer`) sous verrou en base : désigner un compte retire
  le rôle à tout autre et révoque ses sessions. Aucun écran ne permet de créer
  un second admin. Session d'une journée.
- **Aucun mot de passe** : l'admin nomme un gérant ou un commercial par son
  mobile ou son e-mail ; la personne se connecte par code. Un identifiant déjà
  utilisé par un client qui a réservé est refusé. Retirer quelqu'un le rend
  client et ferme ses sessions sur-le-champ.
- **Lecture seule du commercial garantie côté serveur** : toutes les routes
  qui modifient passent par `exigerGerantApi()`, qui le refuse (403) ; les
  boutons masqués à l'écran ne sont qu'un confort.
- L'ancien accès au catalogue par e-mail et mot de passe (`admin-auth.ts`,
  secret et cookie distincts) est **supprimé**. Le script qui l'alimentait
  contenait un mot de passe en clair : il est retiré aussi.

### Boutiques — `src/lib/admin/boutiques.ts`

Créer une boutique crée ensemble, dans une transaction, le point de vente du
catalogue (stocks) et la boutique (code, adresse, représentant signataire).
Le **code** préfixe les références de contrat et n'est plus modifiable.
Fermer une boutique la retire du choix des clients et des stocks affichés,
sans toucher aux contrats en cours.

### Chiffres — `src/lib/admin/statistiques.ts`

- Vente et location longue durée : **contrat scellé** dans la période, daté
  de son scellement ; un contrat caduc ou annulé n'est pas compté.
- Location courte durée : **réservation** journalière reçue sur le site (pas
  encore d'acte pour cette formule).
- En cours : état du jour, quelle que soit la période.
- Montants **contractuels**, pas des encaissements (échéancier au lot 7).
- Regroupements faits en base, en SQL paramétré ; un index
  `ContractEvent(type, createdAt)` sert la date de scellement.
- Graphique en SVG dessiné côté serveur, sans bibliothèque ; valeurs reprises
  dans un tableau dépliable.

### Feuille de suivi et export — `src/lib/admin/suivi.ts`

Une ligne par réservation ; elle entre dans la période si la réservation OU la
signature y tombe. Export CSV pour Excel (séparateur `;`, marque UTF-8),
protégé contre l'injection de formule, jamais mis en cache, journalisé. Nom
et contact du client seulement : aucun numéro de pièce d'identité n'en sort.

## 8 ter. Suivi des versements — `src/lib/versements.ts`

`Reservation.montantTotal` dit ce que le client **doit** ; rien ne disait ce
qu'il a **versé**. D'où deux tables, et jamais un cumul posé sur la
réservation : un solde se recalcule, un historique ne se reconstitue pas.

| Table | Contenu |
|---|---|
| `Echeance` | Ce qui est dû, figé au scellement du contrat |
| `Encaissement` | Une ligne par versement reçu, jamais un cumul |

### Ce que chaque formule doit, selon son acte

- **Vente échelonnée** : cinq échéances figées au scellement — 60 % puis
  4 × 10 % à 30, 60, 90 et 120 jours (article 3). Le résidu d'arrondi tombe sur
  la dernière : la somme égale toujours le prix.
- **Location-accession** : **aucune échéance**. L'acte prévoit une redevance
  journalière due six jours sur sept (article 4), pas des mensualités. Le dû se
  calcule à la date du jour avec `joursFacturesEntre()`, plafonné au total du
  contrat, et le retard s'exprime aussi en **jours de redevance**.
- **Location journalière** : une échéance unique, réglée au retrait.

### Mise en service

`SUIVI_VERSEMENTS_DEPUIS` (AAAA-MM-JJ) borne le suivi. Chaque réservation porte
`suiviDepuis`, posé au scellement : le plus tard entre le scellement et cette
date. Sans cette borne, un contrat signé des mois avant la mise en ligne
afficherait un retard qu'il n'a pas, faute d'avoir enregistré ses versements
passés. Une ligne ainsi tronquée est signalée (`suiviPartiel`).

### Qui fait quoi

| | Commercial | Gérant | Admin |
|---|---|---|---|
| Consulter | sa boutique | sa boutique | toutes |
| Saisir un versement | non | **oui** | oui |
| Annuler | non | non | **oui**, avec motif |

Le gérant saisit depuis son tableau de bord — recherche par référence, nom ou
téléphone, puis montant, mode et date. Une erreur ne s'efface pas : elle
s'annule, motivée, et la ligne reste visible. L'annulation passe par
`exigerAdminApi()`, la saisie par `exigerGerantApi()`.

Le montant n'est pas plafonné au solde : un client peut payer d'avance, et un
trop-perçu doit se voir plutôt que d'être refusé en silence.

`npm run verif:versements` — 32 contrôles sur les fonctions pures : échéancier,
dû à date par formule, versement annulé, trop-perçu, borne de mise en service,
contrat non scellé.

### L'écran de l'administrateur — `/admin/versements`

Un dossier par ligne, le plus en retard d'abord : montant du contrat, dû à ce
jour, encaissé, reste au terme, retard en francs et en jours. Le détail
dépliable liste chaque versement avec son mode, son reçu et qui l'a saisi ; un
versement annulé y reste, barré, avec son motif.

Filtres : période (qui ne vaut que pour le total encaissé — un solde est un état
du jour), boutique, et tous / en retard / à jour / soldés. Export CSV protégé
contre l'injection de formule, journalisé, comme la feuille de suivi.

La feuille de suivi montre les CONTRATS, celle-ci montre l'ARGENT : valeur
contractuelle d'un côté, encaissements réels de l'autre. Les confondre fausserait
les deux.

## 9. Robustesse et montée en charge

- **Sans état en mémoire** : sessions, quotas, compteurs en base. Ajouter des
  instances suffit.
- **Pool de connexions borné** (`DATABASE_POOL_MAX`, 10 par défaut).
- **Sonde de santé** `/api/sante` : l'orchestrateur retire une instance malade.
- **Image Docker** (`Dockerfile`) : utilisateur non-root, sonde intégrée,
  migrations dans une image séparée (l'application n'a pas le droit de
  modifier le schéma).
- **SDK chargés à la demande** : seul le fournisseur configuré est chargé.
- **Contrôles automatisés** : `npm run typecheck`, `npm run lint`,
  `verif:actes`, `verif:tarif`, `verif:reference`, `verif:stockage`.

---

## 10. Choisir l'hébergeur

Le code tourne à l'identique partout. Les critères qui comptent vraiment :

**Localisation des données.** La loi sénégalaise n° 2008-12 encadre le
transfert de données personnelles hors du Sénégal. Un hébergement dans
l'Union européenne est la voie habituelle. **À faire valider auprès de la
CDP** (Commission de Protection des Données Personnelles), à qui le traitement
de pièces d'identité doit de toute façon être déclaré. Paris est la région
européenne la plus proche de Dakar.

**Tout dans la même région** : application, base et stockage à Paris.

| | Azure | OVHcloud | Scaleway |
|---|---|---|---|
| Région proche | France Central (Paris) | Paris, Gravelines | Paris |
| Application | Container Apps | Managed Kubernetes / instances | Serverless Containers |
| Base | PostgreSQL Flexible Server | Managed PostgreSQL | Managed PostgreSQL |
| Stockage | `STORAGE_DRIVER=azure` | `STORAGE_DRIVER=s3` | `STORAGE_DRIVER=s3` |
| Secrets | Key Vault | Secret Manager | Secret Manager |
| E-mail | Communication Services (SMTP) | SMTP | Transactional Email (SMTP) |
| Société | américaine | française | française |
| Pour qui | écosystème Microsoft, catalogue très large | souveraineté, coût | simplicité, souveraineté |

Pour la taille actuelle du projet, **Scaleway ou OVHcloud** sont les plus
simples à exploiter et restent sous juridiction européenne. **Azure** se
justifie si l'entreprise utilise déjà Microsoft 365 ou veut Key Vault et les
identités managées.

---

## 11. Reste à faire avant la production

1. Comptes Twilio et SMTP réels, puis test des envois.
2. Générer les secrets de production : `AUTH_SECRET`, trousseau
   `STORAGE_CLES_CHIFFREMENT`, et les sauvegarder hors ligne.
3. Déclaration du traitement à la CDP.
4. Lot 7 : échéancier, relances WhatsApp, cron d'expiration des réservations
   et de purge des codes (`purgerCodesExpires`).
5. Lier téléphone et e-mail sur un même compte (aujourd'hui, un client qui se
   connecte une fois par e-mail puis par téléphone obtient deux comptes).
