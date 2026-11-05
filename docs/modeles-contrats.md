# Modèles contractuels — inventaire des champs

Relevé effectué le 2026-09-10 à partir des 17 documents fournis par le client
(contrats signés réels + modèles vierges). Ce fichier est la référence pour la
génération automatique : toute clé de snapshot doit s'y retrouver.

## Constantes de l'entreprise

Identiques sur tous les documents :

| Donnée | Valeur |
|---|---|
| Raison sociale | LA MOTHER EXPRESS |
| NINEA | 008246888 |
| Siège | PARCELLES ASSAINIES UNITÉ 10 VILLA N°244 |

**Le représentant varie selon la boutique** — c'est le gérant qui signe :
- NASSALAN Frédéric Olivier (Mbour)
- MENDY Lazare Evariste (Thiès / Dakar)

Le nom complet du représentant doit donc être porté par `Boutique`, pas codé en dur.

## Les huit documents

| Document | Variantes | Lot |
|---|---|---|
| Contrat de location journalière | une seule — **fourni le 2026-09-19** | 4 |
| Contrat de location-accession | 24 mois (5 000 F/j) · 14 mois A10 (3 000 F/j) · 12 mois A10 engagement (2 500 F/j) | 4 |
| Contrat de vente échelonnée | une seule | 4 |
| Constat d'état — remise | générique · A10 14 mois · A10 12 mois | 6 |
| Constat d'état — restitution | générique · A10 14 mois · A10 12 mois | 7 |
| Attestation de versement | une seule | 7 |
| Lettre de résiliation | générique · A10 12 mois engagement | 7 |

## Contrat de location-accession

```
bailleurRepresentant      MENDY Lazare Evariste
clientNomComplet          NIANG Mame Cheikh Ibrahima      (format NOM Prénom)
clientNumeroPiece         1 07 20020806 000349
clientAdresse             Médine extension
clientTelephone           +221 78 412 14 40
vehiculeMarqueModele      REVOO / B12
vehiculeNumeroSerie       HB3BH2104T9103507               ← Vehicule.numeroChassis
vehiculeImmatriculation   R 3507  |  Néant                ← « Néant » si non attribuée
vehiculeValeurReference   860 000 FCFA                    ← Tarification.prixVenteFcfa
dureeMois                 12 | 14 | 24
dateDebut  dateFin        04/07/2026   04/07/2028
redevanceJournaliere      5000 FCFA par jour
lieuSignature             Mbour
dateSignature             04/07/2026
```

Variante **avec engagement** (A10, 12 mois) — deux champs de plus, à l'article 5 :

```
tarifSansEngagement       3 000 FCFA
differentielJournalier    500 FCFA
```

Cette variante exige aussi, sous la signature du locataire, la mention manuscrite :
> « Lu et approuvé, je reconnais avoir pris connaissance de l'article 5 »

C'est une contrainte pour le lot 5 : la signature seule ne suffit pas sur ce modèle.

## Contrat de location journalière

Dix-sept articles. C'est l'acte qui demande le PLUS de saisie au gérant : dix
valeurs qui ne se déduisent ni du catalogue ni du dossier, mais se conviennent
au comptoir.

```
bailleurAdresseBoutique   ← Boutique.adresse, et NON le siège de l'entreprise
bailleurRepresentant
clientNomComplet, clientNumeroPiece, clientAdresse, clientTelephone
vehiculeMarqueModele, vehiculeNumeroSerie, vehiculeImmatriculation

departLe                  12/09/2026 à 08h30     ← Reservation.heureDepart
retourLe                  15/09/2026 à 18h00     ← Reservation.heureRetour
dureeLocation             3 jours                ← Reservation.nbJours
tarifLocation             27 000 FCFA            ← Reservation.montantTotal
montantCaution            50 000 FCFA            ← Reservation.montantCaution
limiteKm                  300 km                 ← Reservation.limiteKm
forfaitKmSupplementaires  1 000 FCFA par km      ← Reservation.forfaitKmSupp
zoneUtilisation           Région de Thiès        ← Reservation.zoneUtilisation
etatGeneral               Bon état, rayure…      ← Reservation.etatGeneralDepart
modesPaiement             cases cochées
```

Un champ laissé vide imprime « Néant », comme les pointillés non remplis du
contrat papier. La caution, absente des deux autres actes, existe donc bien
ici : la note « aucun contrat ne mentionne de caution » ne vaut que pour
l'accession et la vente.

**Seule adaptation de forme :** l'article 4 énonce « Mode de paiement : …… » en
champ libre sur le papier ; il est imprimé en cases à cocher, comme sur les deux
autres actes, puisque le gérant coche déjà ces modes. Le fond est identique.

## Contrat de vente échelonnée

```
bailleurRepresentant, clientNomComplet, clientNumeroPiece,
clientAdresse, clientTelephone

Par véhicule (le contrat DIOP Omar en porte DEUX) :
  vehiculeMarqueModele    B12
  vehiculeNumeroSerie     HB3BH2105S9120069
  vehiculeCMC             2026 14V 12239    ← absent du schéma V2
  vehiculeEtat            Neuf | d'occasion
  vehiculeDateRemise      25/06/2026

prixTotal                 1 720 000 FCFA
modePaiement              Espèces | Wave | Orange Money | Virement
lieuSignature, dateSignature
```

Échéancier de l'article 3, **conforme à ce qui est implémenté** :
60 % à la signature, puis 10 % à 30, 60, 90 et 120 jours.

### État du véhicule et prix saisis par le gérant — 2026-09-27

Demandé par Alexandre. Deux valeurs que l'acte portait mal :

1. **L'état du véhicule.** Le modèle papier le prévoit depuis l'origine
   (`vehiculeEtat  Neuf | d'occasion`, ci-dessus), mais l'acte généré imprimait
   « Neuf » **en dur** à l'article 2 et ne cochait **aucune** des deux cases de
   l'article 9 — le document posait la question sans jamais y répondre. Le
   gérant choisit désormais (`Reservation.etatVenteContrat`, énumération
   `EtatVehiculeVente`), et les deux libellés de l'article 9 restent imprimés :
   seule la case retenue porte la croix. **« Neuf » par défaut**, les motos
   vendues étant neuves — les contrats déjà établis s'impriment donc à
   l'identique.
2. **Le prix de vente.** Corrigeable quand le tarif a baissé ou changé depuis
   la réservation. Il vit dans `Reservation.montantTotal`, et non dans un champ
   d'impression à part : l'acte et l'échéancier doivent lire la MÊME valeur,
   sans quoi l'article 3 annoncerait un prix que les échéances contrediraient.
   L'échéancier étant figé au scellement (`creerEcheancier`), une correction
   faite à la génération — donc avant signature — s'y répercute d'elle-même.
   Un acte déjà engagé ne se régénère pas : `STATUTS_FIGES` l'interdit.

Le TEXTE de l'acte est inchangé dans les deux cas — seules une valeur et une
croix changent — donc **`VERSION_MODELES` reste à 1**, comme pour les modes de
paiement. Contrôlé par `npm run verif:actes`, section « Vente : état du
véhicule et prix » : 11 contrôles, dont le fait que l'absence de valeur
reproduit exactement l'ancien « Neuf ».

## Attestation de versement — générée depuis le 2026-09-27

Texte reproduit du modèle `Attestation_Versement_Diop_Omar.pdf`, avec trois
écarts assumés, tous contrôlés par `npm run verif:actes` :

1. **Pas de civilité.** Le modèle porte « M. DIOP Omar » ; nous ne stockons
   aucune civilité, et la déduire d'un prénom se tromperait tôt ou tard. Les
   formes « soussigné(e) » et « représentant(e) » du papier sont conservées.
2. **Cases cumulatives.** Le modèle ne coche que le versement concerné ;
   l'attestation du 2ᵉ versement coche désormais le 1ᵉʳ **et** le 2ᵉ. Le client
   voit où il en est de son échéancier.
3. **Signatures reprises du contrat**, avec mention de provenance en bas de
   page : *« Signatures reprises du contrat LME-2026-MBR-0004, signé le … »*.
   Un reçu ne fait jamais passer un tracé recopié pour un tracé fait sur place.

Le document se tire depuis le tableau de bord du gérant, juste après la saisie
du versement (`POST /api/gerant/versements/{id}/attestation`), et se relit par
`GET /api/actes/attestation/{id}` — ouverte aussi au client, dont c'est la preuve
de paiement.
Aucun champ n'y est ressaisi : montant, date et mode viennent de l'encaissement
enregistré — un reçu qui dirait autre chose que le registre serait un faux.
Version du texte : `VERSION_ATTESTATION`, journalisée sur l'événement
`ATTESTATION` du contrat.

Pour une location-accession, qui n'a pas d'échéancier, la ligne « Versement
concerné » n'est pas imprimée et le cadre devient « du contrat de
location-accession de moto électrique ».

### Champs du modèle d'origine

```
bailleurRepresentant, clientNomComplet, clientNumeroPiece
montantVerse              1 032 000 FCFA
datePaiement              25/06/2026
modePaiement              Espèces (case cochée)
versementConcerne         1er (60 %) | 2e | 3e | 4e | 5e (10 %)
montantRestantDu          688 000 FCFA
lieuSignature, dateSignature
```

Contrôle arithmétique sur l'exemple : 2 × 860 000 = 1 720 000 ;
60 % = 1 032 000 ; reste 688 000. Cohérent.

## Constat d'état (remise et restitution)

```
typeContrat               Location journalière | Location-accession {12|14|24} mois
vehiculeMarqueModele, vehiculeNumeroSerie
clientNomComplet, clientNumeroPiece, clientTelephone
date, heure, kilometrage
photos                    QUATRE emplacements (le schéma V2 en prévoit six)
carrosserie               remise : Neuf | D'occasion | Dégradations
                          restitution : Bon état | Usure normale | Dégradations
freinsPneus               idem
batterieChargeur          idem
accessoires               Complets | Manquants        (casque, clés, documents)
remarques
```

Propres à la **restitution** :
```
dommagesConstates         Aucun | Oui (à préciser)
coutReparations           ................ FCFA
```

### Signataires nommés sur le constat de remise — 2026-09-18

Les modèles papier portent deux cadres « Signature du Bailleur » et « Signature
du Locataire », sans nom : rien n'y rattache un tracé à une personne, et deux
signatures apposées dans le désordre sur le téléphone du gérant passeraient
inaperçues. Le constat généré nomme donc chaque signataire sous son cadre, et
reporte sur le document le contrôle de la pièce d'identité, jusque-là consigné
en base seulement :

```
Pour le Bailleur - MENDY Lazare Evariste      Le Locataire - SARR Abdoulaye
[   cadre de signature   ]                    [   cadre de signature   ]

Constat signé sur place le 17/08/2026 à 14h30. Identité du Locataire vérifiée
par MENDY Lazare Evariste sur présentation de l'original de la pièce
n° 1 07 20011011 000060, le 17/08/2026 14:22:07.
```

Trois champs nouveaux dans `DonneesConstat` : `bailleurSignataire` (le gérant
qui remet la moto, pas le représentant de la boutique), `pieceVerifieePar` et
`pieceVerifieeLe`, repris du `Handover`. Sans contrôle enregistré, la seconde
phrase n'est pas imprimée : la mention n'affirme jamais une vérification qui
n'a pas eu lieu. Le tout est contrôlé par `npm run verif:actes`.

**Texte validé par La Mother Express le 2026-09-19.**

### Signatures reprises du contrat — 2026-09-27

Le constat n'est plus signé en boutique : il **reprend les deux tracés du
contrat**, et le gérant se contente de le générer. Décision de LME, prise en
connaissance de ce qu'elle coûte — un document que le client n'a pas eu sous
les yeux prouve moins bien son accord sur l'état du véhicule.

Ce qui porte désormais la preuve : les **photos**, prises sur place et
horodatées, et la **vérification de l'original de la pièce**, nominative et
datée. Le document porte la mention *« Signatures reprises du contrat
LME-2026-THS-0003, signé le 17/08/2026 »* : un tracé recopié ne se fait jamais
passer pour un tracé apposé devant la moto.

Aucun fichier n'est dupliqué : `Handover.signatureGerantPath` et
`signatureClientPath` pointent vers les tracés du contrat, qui sont l'original.

Le constat se relit par `GET /api/actes/constat/{reservationId}` — client,
équipe de la boutique, administrateur. Le gérant le retrouve sur la fiche du
dossier, pas seulement sur l'écran de retrait : c'est là qu'on le cherche des
mois plus tard, quand un litige survient.

Le constat porte désormais son propre numéro de rédaction, `VERSION_CONSTAT`
(`src/lib/contrats/pv-remise.ts`), enregistré sur l'événement `RETIRE` du
contrat — comme `VERSION_MODELES` l'est sur les actes. Toute modification
ultérieure du texte doit être validée puis incrémenter ce numéro, faute de quoi
on ne saurait plus quelle rédaction un client a signée.

## Constat de restitution — généré depuis le 2026-09-27

Pendant du constat de remise, pour la fin d'un contrat : retour d'une location
journalière, ou rupture anticipée d'une location-accession.
`src/lib/contrats/pv-restitution.ts`, version du texte
`VERSION_CONSTAT_RESTITUTION`.

**Une accession menée à son terme ne produit pas ce document** : elle transfère
la propriété, la moto ne revient pas. Le constat de restitution ne concerne que
l'arrêt anticipé. Une vente échelonnée n'en a jamais.

Trois écarts assumés avec le constat de remise :

1. **Les états proposés changent.** À la remise, la question est « neuf ou
   d'occasion ? » ; au retour, « usure normale ou dégradation ? ». Ce sont les
   libellés du modèle papier, portés par l'énumération `EtatRestitution`
   (`BON_ETAT | USURE_NORMALE | DEGRADATIONS`) et non `EtatElement`.
2. **Les signatures sont recueillies sur place**, contrairement à la remise.
   À la remise, le client reconnaît un véhicule en bon état, l'enjeu est faible.
   Au retour, on lui oppose des dégâts et des sommes : son accord doit être
   donné devant la moto. Décision de LME du 2026-09-27.
3. **Un motif de fin est coché** : fin normale, rupture anticipée, résiliation
   pour défaut de paiement, autre.

### Les sommes portées au constat

Le document **ne crée aucune obligation** : il récapitule ce que l'acte prévoit
déjà, et le dit explicitement. Les réparations sont dues « dans les conditions
prévues au contrat », dont les articles sur l'entretien et les dégradations
restent seuls applicables — journalière articles 5 et 12 (caution, retard de
restitution), accession articles « Entretien du véhicule » et « Accident, vol ou
destruction ».

Une seule somme se calcule, parce que l'acte en donne lui-même la formule : le
**différentiel de rupture** de la formule avec engagement (A10, article 5), soit
500 F par jour facturé depuis le début du contrat jusqu'à la restitution
effective. Le nombre de jours retenus est conservé en base
(`Restitution.differentielJours`), sans quoi le calcul serait invérifiable des
mois plus tard.

Aucune ligne ne s'imprime sans valeur : un constat affichant « 0 FCFA » partout
laisserait croire qu'on a arrêté un compte, alors qu'on n'en a relevé aucun.

### Champs propres à la restitution

```
motif                     Fin normale | Rupture anticipée | Défaut de paiement | Autre
dateRestitution, heureRestitution, compteurKm
compteurKmRemise          repris du constat de remise, pour la distance parcourue
dommagesConstates         Aucun | Oui (à préciser)
redevancesImpayees        ................ FCFA
differentielRupture       ................ FCFA  (avec engagement uniquement)
coutReparations           ................ FCFA
totalDu                   imprimé seulement si plusieurs lignes
```

### Ce que la clôture change dans le suivi — 2026-09-28

Le dossier passe en **`ARRETEE`** (« Contrat arrêté »), et non `TERMINEE`, qui
dit d'un contrat qu'il s'est bien fini. Le compteur d'une accession se **gèle**
à la date de restitution : les mois restants ne sont plus dus, l'article 5 ne
réclamant que la période effectivement utilisée.

Le différentiel et les frais de remise en état deviennent des **échéances**
exigibles à cette date. Toute la mécanique existante s'applique alors sans rien
réinventer : l'admin voit le reste à recouvrer, le gérant encaisse par Wave ou
en espèces, le reçu se tire, le retard s'affiche, et les versements déjà perçus
se déduisent. Les redevances impayées n'y sont PAS ajoutées — le compteur gelé
les porte déjà, les compter ici les doublerait.

## Lettre de résiliation pour défaut de paiement

```
clientNomComplet, clientNumeroPiece, clientAdresse, clientTelephone
lieu, date
dateContrat, vehiculeMarqueModele, vehiculeNumeroSerie
montantImpaye, joursRetard, periodeDu, periodeAu
dateResiliation
dateLimiteRestitution, adresseRestitution
```

Variante **A10 12 mois engagement** — le calcul du différentiel y est imprimé :
```
joursFactures × 500 FCFA = totalDifferentiel
```

## Écarts relevés avec le schéma V2

1. **Vente à plusieurs véhicules** — le contrat DIOP Omar porte deux motos pour
   1 720 000 F. `Reservation` n'en prévoit qu'une.
2. **CMC** (Certificat de Mise en Circulation) — ~~absent de `Vehicule`~~ :
   `Vehicule.cmc`, imprimé à l'article 2 du contrat de vente. Il se saisit
   UNIQUEMENT depuis l'écran de flotte — il ne figure PAS dans les champs que
   le gérant remplit sur l'acte, contrairement au numéro de série et à
   l'immatriculation. Sans fiche véhicule, ou avec un CMC laissé vide, la vente
   imprime « Néant » alors que son article 5 promet ce document au client.
   C'est ce qui rend `/gerant/flotte` indispensable — décision de garder cet
   écran, 2026-09-29.
3. **Représentant de la boutique** — `Boutique` n'a pas de champ pour le nom
   complet du gérant signataire.
4. **Mode de paiement** — ~~absent du schéma~~ : `Reservation.modesPaiementContrat`,
   coché par le gérant et imprimé sur la location-accession et la vente
   (2026-09-13), et sur l'attestation de versement depuis le 2026-09-27.
5. **Constat de restitution** — ~~`Handover` ne couvre que la remise~~ : modèle
   `Restitution` distinct, avec `dommagesConstates` et `coutReparations`
   (2026-09-27). Voir plus haut. `Handover` reste réservé à la remise : il
   porte la vérification de la pièce d'identité, qui n'a pas de sens au retour.
6. **État du véhicule à la vente** — ~~imprimé en dur, cases jamais cochées~~ :
   `Reservation.etatVenteContrat` (2026-09-27).
7. **Photos** — les modèles prévoient 4 emplacements, le schéma 6 angles.

## Ce que les contrats N'exigent PAS

Utile à savoir : le dossier KYC collecte plus que ce qui s'imprime. Les
contrats ne demandent que nom, numéro de pièce, adresse et téléphone.
Date et lieu de naissance, nationalité et profession
servent au dossier commercial, pas à l'acte.

### Contact d'urgence — SUPPRIMÉ le 2026-09-28

Demandé par Alexandre. Les colonnes `urgenceNom`, `urgenceLien` et
`urgenceTelephone` sont retirées de `Customer`, et avec elles les champs du
formulaire client, le bloc « Personne à prévenir » de la fiche du gérant, et
les deux exigences de complétude (`CHAMPS_REQUIS`). **Un dossier complet
demande donc deux champs de moins.**

Exception assumée au schéma additif : c'est une minimisation de données. Elle
est sans risque pour les actes — aucun ne l'imprimait, et `Contract.donnees`
est un instantané figé qui ne relit jamais `Customer`.

Aucun contrat ne mentionne de caution — `montantCaution = 0` est correct.

Aucun contrat n'imprime de montant total pour l'accession : seules la
redevance journalière et la durée y figurent. Le total affiché au client est
donc **indicatif** et doit être présenté comme tel.

## Décisions d'Alexandre — 2026-09-29

- **Mise en page des actes : VALIDÉE.** Les neuf documents de
  `npm run apercu:contrats` ont été relus. Cela vaut validation des textes du
  **constat de restitution** (`VERSION_CONSTAT_RESTITUTION = 1`) et de
  l'**attestation de versement** (`VERSION_ATTESTATION = 1`).
- **Annulation d'un dossier : la boutique seulement.** Gérant et admin, avec un
  motif conservé, jusqu'au scellement. Le client qui se désiste appelle ou
  passe : pas de bouton dans son espace.
- **Pièce non conforme au comptoir : le KYC passe en `REJETE`.** Le doute porte
  sur la personne, pas sur un contrat — même si le client a un autre contrat en
  cours. Sa prochaine réservation repasse donc par la vérification du gérant.
- **Texte de consentement : MAINTENU tel quel.** Il annonce une suppression des
  pièces « à la clôture du dossier » qui n'a pas lieu, les pièces étant
  conservées comme preuve. Écart connu et ASSUMÉ par Alexandre — ce n'est pas un
  défaut à corriger. `CustomerDocument.purgeAt` reste donc inutilisé.
