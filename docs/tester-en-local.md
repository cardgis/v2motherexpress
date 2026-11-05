# Tester la V2 en local

La base locale est **isolée de la production**. Tant que `.env.local` existe,
aucune commande ne peut viser la base Neon du site en ligne. Les scripts de
vérification vont plus loin : ils ne lisent **que** `.env.local` et refusent
de démarrer sans lui.

Architecture et choix de sécurité : `docs/architecture-v2.md`.

## Démarrer

```bash
npm run db:up     # base PostgreSQL (Docker Desktop doit tourner)
npm run dev       # http://localhost:3000
```

Pour tout remettre à zéro avec des données d'exemple :

```bash
npm run db:reset  # efface, remigre et re-seed
```

## Se connecter

Il n'y a pas de mot de passe. On se connecte avec un **numéro de mobile** ou
une **adresse e-mail**, et en développement **le code à 6 chiffres s'affiche
directement à l'écran** (et dans le terminal). Aucun SMS ni e-mail n'est envoyé.

| Rôle | Identifiant | Où ça mène |
|---|---|---|
| Cliente **déjà validée** | `77 000 00 00` | `/compte` — dossier complet |
| **Nouveau client sénégalais** | tout mobile inutilisé, ex. `78 111 22 33` | `/compte` — dossier vierge |
| **Visiteur étranger (téléphone)** | ex. `+33 6 12 34 56 78` | `/compte` — dossier vierge |
| **Visiteur étranger (e-mail)** | toute adresse, ex. `emma@exemple.com` | `/compte` — le dossier demande en plus un téléphone de contact |
| Gérant Thiès | `77 232 02 35` | `/gerant` |
| Gérant Mbour | `70 367 75 75` | `/gerant` |
| **Administrateur** | `77 000 00 09` | `/admin` — chiffres, boutiques, catalogue |

Écritures acceptées pour un numéro sénégalais : `77 123 45 67`, `0771234567`,
`00221771234567`, `+221 77 123 45 67`. Un numéro fixe (`33 8…`) est refusé : il
ne reçoit pas de SMS.

Quotas actifs même en local : 3 codes par identifiant toutes les 15 minutes,
10 par jour, et 10 par adresse IP. En cas de blocage, attendre, changer
d'identifiant, ou effacer les codes de ce compte dans la base **locale** :

```bash
docker exec lme-postgres-dev psql -U lme -d lme_dev -c "DELETE FROM \"OtpCode\" WHERE destinataire='+221772320235';"
```

Pour repartir de zéro sur un compte :

```bash
docker exec lme-postgres-dev psql -U lme -d lme_dev -c "DELETE FROM \"User\" WHERE telephone='+221781112233' OR email='emma@exemple.com';"
```

## Le parcours complet

1. **`/compte/connexion`** — connectez-vous en client (téléphone ou e-mail).
2. **`/compte/reserver`** — choisissez un modèle, une formule, une boutique.
3. **`/compte/dossier`** — remplissez le profil, déposez les pièces, soumettez.
4. Déconnectez-vous, reconnectez-vous en **gérant de Thiès** (`77 232 02 35`).
5. **`/gerant/dossiers`** — examinez la pièce, attribuez une moto, validez.
6. Sur la fiche : renseignez **Marque / Modèle**, date, numéro de série,
   immatriculation, puis **Générer le contrat**. Le contrat reste un brouillon
   que vous seul voyez : relisez-le, corrigez et régénérez si besoin.
7. **Transmettre au client** : copiez le lien de signature.
8. Ouvrez ce lien (même en navigation privée) : lisez, demandez le code,
   signez au doigt. Le code part vers le téléphone du compte, ou son e-mail.
9. Revenez en gérant sur la fiche : **Contresigner**. Le contrat est scellé.
10. Reconnectez-vous en client : le contrat signé est dans **Mes documents**.

## Administrateur et commercial

Le compte administrateur est **unique**. En local, `77 000 00 09` l'est déjà.
Pour en désigner un autre (l'ancien redevient client) :

```bash
npm run admin:designer -- "77 000 00 09" "Admin LME (test)"
```

1. Connectez-vous avec `77 000 00 09` : **Chiffres** s'ouvre. Changez la
   période ou la boutique, ouvrez la **Feuille de suivi**, exportez-la pour
   Excel ou imprimez-la.
2. **Boutiques → Nouvelle boutique** : elle apparaît aussitôt dans le choix
   des clients sur `/compte/reserver`.
3. Sur la fiche d'une boutique, **Ajouter une personne** avec un mobile
   inutilisé (ex. `78 222 33 44`), rôle **Commercial**.
4. Reconnectez-vous avec ce numéro : le back-office s'ouvre en consultation
   seule — pièces et contrats lisibles, aucun bouton d'action.

## Vérifications automatiques

```bash
npm run typecheck        # TypeScript sur tout le projet
npm run lint             # ESLint
npm run verif:actes      # le texte juridique est bien dans les PDF produits
npm run verif:tarif      # grille tarifaire et règle des 6 jours sur 7
npm run verif:reference  # 60 références générées en simultané, aucun doublon
npm run verif:stockage   # chiffrement, intégrité et cloisonnement du stockage
```

Les scripts s'exécutent avec `tsx`.

### Tester le stockage sur S3 et Azure

Le code des pièces d'identité tourne à l'identique sur tous les fournisseurs.
Pour le vérifier sur de vrais serveurs, sans compte cloud :

```bash
docker compose --profile s3 --profile azure up -d   # MinIO (S3) + Azurite (Azure)
STORAGE_DRIVER=s3    npm run verif:stockage
STORAGE_DRIVER=azure npm run verif:stockage
```

Pour faire tourner toute l'application sur l'un d'eux, passer
`STORAGE_DRIVER="s3"` (ou `"azure"`) dans `.env.local`. Les identifiants de
MinIO et d'Azurite y sont déjà renseignés.

## Points d'attention

- Les pièces d'identité et les contrats sont écrits **chiffrés** dans
  `.storage/`. Les ouvrir directement ne montre que du bruit : c'est normal.
  Ce dossier n'est jamais versionné.
- Les blobs créés avant l'introduction du chiffrement restent lisibles en
  développement, jamais en production.
- Pour arrêter proprement le serveur sous Windows, `Ctrl+C` suffit dans le
  terminal. S'il tourne en arrière-plan, tuez **tous** les processus node, en
  deux passes, sinon les workers Turbopack restent en vie et saturent la mémoire :

  ```powershell
  Get-Process node | Stop-Process -Force ; Start-Sleep 3
  Get-Process node | Stop-Process -Force
  ```
