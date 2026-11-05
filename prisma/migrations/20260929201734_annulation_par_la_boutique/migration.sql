-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "annuleLe" TIMESTAMP(3),
ADD COLUMN     "annuleMotif" TEXT,
ADD COLUMN     "annuleParUserId" TEXT;
