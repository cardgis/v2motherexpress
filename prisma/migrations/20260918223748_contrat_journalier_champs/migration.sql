-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "etatGeneralDepart" TEXT,
ADD COLUMN     "forfaitKmSupp" INTEGER,
ADD COLUMN     "heureDepart" TEXT,
ADD COLUMN     "heureRetour" TEXT,
ADD COLUMN     "limiteKm" INTEGER,
ADD COLUMN     "zoneUtilisation" TEXT;
