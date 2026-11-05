-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'WAVE', 'ORANGE_MONEY', 'VIREMENT');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "modesPaiementContrat" "ModePaiement"[] DEFAULT ARRAY[]::"ModePaiement"[];
