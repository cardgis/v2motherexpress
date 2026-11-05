-- CreateEnum
CREATE TYPE "EtatVehiculeVente" AS ENUM ('NEUF', 'OCCASION');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "etatVenteContrat" "EtatVehiculeVente" NOT NULL DEFAULT 'NEUF';
