-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'GERANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "CanalOtp" AS ENUM ('SMS', 'WHATSAPP', 'CONSOLE');

-- CreateEnum
CREATE TYPE "ButOtp" AS ENUM ('CONNEXION', 'SIGNATURE');

-- CreateEnum
CREATE TYPE "TypePiece" AS ENUM ('CNI', 'PASSEPORT', 'CARTE_SEJOUR', 'CARTE_CONSULAIRE');

-- CreateEnum
CREATE TYPE "StatutKyc" AS ENUM ('INCOMPLET', 'A_VERIFIER', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('PIECE_RECTO', 'PIECE_VERSO', 'PERMIS_RECTO', 'PERMIS_VERSO', 'JUSTIFICATIF_DOMICILE', 'SELFIE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutVehicule" AS ENUM ('DISPONIBLE', 'RESERVE', 'EN_LOCATION', 'MAINTENANCE', 'VENDU', 'HORS_SERVICE');

-- CreateEnum
CREATE TYPE "Formule" AS ENUM ('LOCATION_JOURNALIERE', 'LOCATION_ACCESSION', 'VENTE_ECHELONNEE');

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('BROUILLON', 'EN_ATTENTE_DOSSIER', 'EN_ATTENTE_VALIDATION', 'EN_ATTENTE_SIGNATURE', 'EN_ATTENTE_RETRAIT', 'ACTIVE', 'TERMINEE', 'ANNULEE', 'CADUQUE');

-- CreateEnum
CREATE TYPE "StatutContrat" AS ENUM ('BROUILLON', 'A_SIGNER_CLIENT', 'A_SIGNER_GERANT', 'SIGNE', 'EN_ATTENTE_RETRAIT', 'RETIRE', 'CADUC', 'ANNULE');

-- CreateEnum
CREATE TYPE "RoleSignataire" AS ENUM ('CLIENT', 'GERANT');

-- CreateEnum
CREATE TYPE "StatutHandover" AS ENUM ('EN_ATTENTE', 'PIECE_REFUSEE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "AngleHandover" AS ENUM ('AVANT', 'ARRIERE', 'GAUCHE', 'DROITE', 'COMPTEUR', 'CHASSIS');

-- AlterTable
ALTER TABLE "Produit" ALTER COLUMN "annee" SET DEFAULT 2024;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT NOT NULL,
    "telVerifie" BOOLEAN NOT NULL DEFAULT false,
    "nomAffichage" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "boutiqueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boutique" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompteurReference" (
    "id" TEXT NOT NULL,
    "boutiqueId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "dernier" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompteurReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "canal" "CanalOtp" NOT NULL DEFAULT 'CONSOLE',
    "but" "ButOtp" NOT NULL DEFAULT 'CONNEXION',
    "contractId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "consommeAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,
    "lieuNaissance" TEXT NOT NULL,
    "nationalite" TEXT NOT NULL DEFAULT 'Sénégalaise',
    "typePiece" "TypePiece" NOT NULL,
    "numeroPiece" TEXT NOT NULL,
    "pieceDateExpiration" TIMESTAMP(3),
    "numeroPermis" TEXT,
    "permisDateObtention" TIMESTAMP(3),
    "adresse" TEXT NOT NULL,
    "quartier" TEXT,
    "ville" TEXT NOT NULL,
    "profession" TEXT,
    "urgenceNom" TEXT,
    "urgenceLien" TEXT,
    "urgenceTelephone" TEXT,
    "statutKyc" "StatutKyc" NOT NULL DEFAULT 'INCOMPLET',
    "kycVerifiePar" TEXT,
    "kycVerifieAt" TIMESTAMP(3),
    "kycMotifRejet" TEXT,
    "consentementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "blobPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeApres" TIMESTAMP(3),
    "purgeAt" TIMESTAMP(3),

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "boutiqueId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "numeroChassis" TEXT NOT NULL,
    "immatriculation" TEXT,
    "couleur" TEXT,
    "statut" "StatutVehicule" NOT NULL DEFAULT 'DISPONIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "boutiqueId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "vehiculeId" TEXT,
    "formule" "Formule" NOT NULL,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "nbJours" INTEGER,
    "montantTotal" INTEGER NOT NULL,
    "montantAcompte" INTEGER NOT NULL DEFAULT 0,
    "montantCaution" INTEGER NOT NULL DEFAULT 0,
    "redevanceJournaliere" INTEGER,
    "engagementMois" INTEGER,
    "differentielSiRupture" INTEGER,
    "statut" "StatutReservation" NOT NULL DEFAULT 'BROUILLON',
    "expireLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "champs" JSONB NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "donnees" JSONB NOT NULL,
    "pdfDraftPath" TEXT,
    "hashDraft" TEXT,
    "pdfSignedPath" TEXT,
    "hashSigned" TEXT,
    "statut" "StatutContrat" NOT NULL DEFAULT 'BROUILLON',
    "signTokenHash" TEXT,
    "signTokenExp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "role" "RoleSignataire" NOT NULL,
    "signataireUserId" TEXT NOT NULL,
    "signataireNom" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "imageSha256" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "otpVerifie" BOOLEAN NOT NULL DEFAULT false,
    "otpCanal" "CanalOtp",
    "telephone" TEXT,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractEvent" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "acteurUserId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "gerantUserId" TEXT NOT NULL,
    "gerantNom" TEXT NOT NULL,
    "pieceVerifiee" BOOLEAN NOT NULL DEFAULT false,
    "pieceConforme" BOOLEAN,
    "pieceMotifRefus" TEXT,
    "pieceVerifieeAt" TIMESTAMP(3),
    "compteurKm" INTEGER,
    "niveauBatterie" INTEGER,
    "casqueRemis" BOOLEAN NOT NULL DEFAULT false,
    "chargeurRemis" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "pvPdfPath" TEXT,
    "pvHashSigned" TEXT,
    "signatureClientPath" TEXT,
    "signatureGerantPath" TEXT,
    "statut" "StatutHandover" NOT NULL DEFAULT 'EN_ATTENTE',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverPhoto" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "angle" "AngleHandover" NOT NULL,
    "blobPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "prisAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telephone_key" ON "User"("telephone");

-- CreateIndex
CREATE INDEX "User_boutiqueId_idx" ON "User"("boutiqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Boutique_storeId_key" ON "Boutique"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Boutique_code_key" ON "Boutique"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CompteurReference_boutiqueId_annee_key" ON "CompteurReference"("boutiqueId", "annee");

-- CreateIndex
CREATE INDEX "OtpCode_telephone_but_createdAt_idx" ON "OtpCode"("telephone", "but", "createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_numeroPiece_idx" ON "Customer"("numeroPiece");

-- CreateIndex
CREATE INDEX "Customer_statutKyc_idx" ON "Customer"("statutKyc");

-- CreateIndex
CREATE INDEX "CustomerDocument_customerId_type_idx" ON "CustomerDocument"("customerId", "type");

-- CreateIndex
CREATE INDEX "CustomerDocument_purgeApres_idx" ON "CustomerDocument"("purgeApres");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicule_numeroChassis_key" ON "Vehicule"("numeroChassis");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicule_immatriculation_key" ON "Vehicule"("immatriculation");

-- CreateIndex
CREATE INDEX "Vehicule_boutiqueId_statut_idx" ON "Vehicule"("boutiqueId", "statut");

-- CreateIndex
CREATE INDEX "Vehicule_produitId_idx" ON "Vehicule"("produitId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_reference_key" ON "Reservation"("reference");

-- CreateIndex
CREATE INDEX "Reservation_boutiqueId_statut_idx" ON "Reservation"("boutiqueId", "statut");

-- CreateIndex
CREATE INDEX "Reservation_customerId_idx" ON "Reservation"("customerId");

-- CreateIndex
CREATE INDEX "Reservation_expireLe_idx" ON "Reservation"("expireLe");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_code_version_key" ON "ContractTemplate"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_reference_key" ON "Contract"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_reservationId_key" ON "Contract"("reservationId");

-- CreateIndex
CREATE INDEX "Contract_statut_idx" ON "Contract"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_contractId_role_key" ON "Signature"("contractId", "role");

-- CreateIndex
CREATE INDEX "ContractEvent_contractId_createdAt_idx" ON "ContractEvent"("contractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_reservationId_key" ON "Handover"("reservationId");

-- CreateIndex
CREATE INDEX "Handover_statut_idx" ON "Handover"("statut");

-- CreateIndex
CREATE INDEX "HandoverPhoto_handoverId_idx" ON "HandoverPhoto"("handoverId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boutique" ADD CONSTRAINT "Boutique_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteurReference" ADD CONSTRAINT "CompteurReference_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEvent" ADD CONSTRAINT "ContractEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverPhoto" ADD CONSTRAINT "HandoverPhoto_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
