-- AlterEnum
ALTER TYPE "RoleSignataire" ADD VALUE 'TEMOIN';

-- AlterEnum
ALTER TYPE "StatutContrat" ADD VALUE 'A_SIGNER_TEMOIN';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "temoinNomContrat" TEXT,
ADD COLUMN     "temoinTelephoneContrat" TEXT;
