-- CreateEnum
CREATE TYPE "Categorie" AS ENUM ('ELECTRIQUE');

-- CreateEnum
CREATE TYPE "CreneauLocation" AS ENUM ('MATIN', 'APRES_MIDI', 'JOURNEE', 'H24');

-- CreateEnum
CREATE TYPE "FormuleLocation" AS ENUM ('CLASSIQUE', 'RACHAT_PROGRESSIF');

-- CreateEnum
CREATE TYPE "FormuleVente" AS ENUM ('COMPTANT', 'MORATOIRE');

-- CreateEnum
CREATE TYPE "StatutVente" AS ENUM ('EN_COURS', 'SOLDE', 'DEFAUT');

-- CreateEnum
CREATE TYPE "StatutLocation" AS ENUM ('ACTIF', 'TERMINE', 'ANNULE');

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "categorie" "Categorie" NOT NULL,
    "vitesseMaxKmh" INTEGER NOT NULL,
    "autonomieKm" INTEGER NOT NULL,
    "stockTotal" INTEGER NOT NULL DEFAULT 0,
    "stockDisponible" INTEGER NOT NULL DEFAULT 0,
    "estDisponible" BOOLEAN NOT NULL DEFAULT true,
    "aLaVente" BOOLEAN NOT NULL DEFAULT true,
    "aLaLocation" BOOLEAN NOT NULL DEFAULT true,
    "estActif" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarification" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "prixVenteFcfa" INTEGER NOT NULL,
    "moratoireActif" BOOLEAN NOT NULL DEFAULT false,
    "moratoireAcompte" INTEGER,
    "moratoireSolde" INTEGER,
    "moratoireDureeEnMois" INTEGER NOT NULL DEFAULT 4,
    "kmInclus" INTEGER NOT NULL,
    "tarifKmSupplementaire" INTEGER NOT NULL DEFAULT 1000,
    "tarifMatinFcfa" INTEGER NOT NULL,
    "tarifApresMidiFcfa" INTEGER NOT NULL,
    "tarifJourneeFcfa" INTEGER NOT NULL,
    "tarif24hFcfa" INTEGER NOT NULL,
    "rachatMontantJournalier" INTEGER NOT NULL DEFAULT 5000,
    "rachatNombreJours" INTEGER NOT NULL DEFAULT 730,
    "rachatMontantTotal" INTEGER NOT NULL DEFAULT 3650000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accessoire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prixAchatFcfa" INTEGER NOT NULL,
    "tarifLocationDemi" INTEGER NOT NULL,
    "tarifLocationJournee" INTEGER NOT NULL,
    "tarifLocation24h" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "estDisponible" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,

    CONSTRAINT "Accessoire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "nomClient" TEXT NOT NULL,
    "telephoneClient" TEXT NOT NULL,
    "creneau" "CreneauLocation" NOT NULL,
    "formule" "FormuleLocation" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "kmDepart" INTEGER,
    "kmRetour" INTEGER,
    "kmSupplementaires" INTEGER NOT NULL DEFAULT 0,
    "coutKmSupp" INTEGER NOT NULL DEFAULT 0,
    "tarifBase" INTEGER NOT NULL,
    "montantPaye" INTEGER NOT NULL DEFAULT 0,
    "joursPayes" INTEGER NOT NULL DEFAULT 0,
    "statut" "StatutLocation" NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vente" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "nomClient" TEXT NOT NULL,
    "telephoneClient" TEXT NOT NULL,
    "formule" "FormuleVente" NOT NULL,
    "prixTotal" INTEGER NOT NULL,
    "montantPaye" INTEGER NOT NULL,
    "montantRestant" INTEGER NOT NULL DEFAULT 0,
    "echeanceMoratoire" TIMESTAMP(3),
    "statut" "StatutVente" NOT NULL DEFAULT 'EN_COURS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produit_slug_key" ON "Produit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tarification_produitId_key" ON "Tarification"("produitId");

-- AddForeignKey
ALTER TABLE "Tarification" ADD CONSTRAINT "Tarification_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
