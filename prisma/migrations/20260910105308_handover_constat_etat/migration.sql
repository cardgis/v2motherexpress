-- CreateEnum
CREATE TYPE "EtatElement" AS ENUM ('NEUF', 'OCCASION', 'DEGRADATIONS');

-- CreateEnum
CREATE TYPE "EtatAccessoires" AS ENUM ('COMPLETS', 'MANQUANTS');

-- AlterTable
ALTER TABLE "Handover" ADD COLUMN     "accessoires" "EtatAccessoires",
ADD COLUMN     "accessoiresPrecision" TEXT,
ADD COLUMN     "batterieChargeur" "EtatElement",
ADD COLUMN     "carrosserie" "EtatElement",
ADD COLUMN     "freinsPneus" "EtatElement",
ADD COLUMN     "heureRemise" TEXT;
