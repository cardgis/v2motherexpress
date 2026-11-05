-- CreateEnum
CREATE TYPE "EtatRestitution" AS ENUM ('BON_ETAT', 'USURE_NORMALE', 'DEGRADATIONS');

-- CreateEnum
CREATE TYPE "MotifRestitution" AS ENUM ('FIN_NORMALE', 'RUPTURE_ANTICIPEE', 'DEFAUT_DE_PAIEMENT', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutRestitution" AS ENUM ('EN_COURS', 'COMPLETE');

-- CreateTable
CREATE TABLE "Restitution" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "gerantUserId" TEXT NOT NULL,
    "gerantNom" TEXT NOT NULL,
    "motif" "MotifRestitution" NOT NULL DEFAULT 'FIN_NORMALE',
    "motifPrecision" TEXT,
    "dateRestitution" TIMESTAMP(3),
    "heureRestitution" TEXT,
    "compteurKm" INTEGER,
    "niveauBatterie" INTEGER,
    "carrosserie" "EtatRestitution",
    "freinsPneus" "EtatRestitution",
    "batterieChargeur" "EtatRestitution",
    "accessoires" "EtatAccessoires",
    "accessoiresPrecision" TEXT,
    "dommagesConstates" BOOLEAN NOT NULL DEFAULT false,
    "dommagesPrecision" TEXT,
    "redevancesImpayees" INTEGER,
    "coutReparations" INTEGER,
    "differentielRupture" INTEGER,
    "differentielJours" INTEGER,
    "observations" TEXT,
    "pvPdfPath" TEXT,
    "pvHashSigned" TEXT,
    "signatureClientPath" TEXT,
    "signatureGerantPath" TEXT,
    "statut" "StatutRestitution" NOT NULL DEFAULT 'EN_COURS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestitutionPhoto" (
    "id" TEXT NOT NULL,
    "restitutionId" TEXT NOT NULL,
    "angle" "AngleHandover" NOT NULL,
    "blobPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "prisAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestitutionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restitution_reservationId_key" ON "Restitution"("reservationId");

-- CreateIndex
CREATE INDEX "Restitution_statut_idx" ON "Restitution"("statut");

-- CreateIndex
CREATE INDEX "RestitutionPhoto_restitutionId_idx" ON "RestitutionPhoto"("restitutionId");

-- AddForeignKey
ALTER TABLE "Restitution" ADD CONSTRAINT "Restitution_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestitutionPhoto" ADD CONSTRAINT "RestitutionPhoto_restitutionId_fkey" FOREIGN KEY ("restitutionId") REFERENCES "Restitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
