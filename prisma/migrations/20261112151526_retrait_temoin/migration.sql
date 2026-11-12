-- Retrait du témoin signataire (2026-11-12).
--
-- Décision d'Alexandre : la fonctionnalité est abandonnée. Aucun témoin n'a
-- jamais été renseigné ni signé, et aucun contrat n'a porté le statut
-- A_SIGNER_TEMOIN : la suppression des valeurs d'énumération ne peut donc
-- échouer sur une ligne existante.

-- AlterEnum
BEGIN;
CREATE TYPE "RoleSignataire_new" AS ENUM ('CLIENT', 'GERANT');
ALTER TABLE "Signature" ALTER COLUMN "role" TYPE "RoleSignataire_new" USING ("role"::text::"RoleSignataire_new");
ALTER TYPE "RoleSignataire" RENAME TO "RoleSignataire_old";
ALTER TYPE "RoleSignataire_new" RENAME TO "RoleSignataire";
DROP TYPE "public"."RoleSignataire_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StatutContrat_new" AS ENUM ('BROUILLON', 'A_SIGNER_CLIENT', 'A_SIGNER_GERANT', 'SIGNE', 'EN_ATTENTE_RETRAIT', 'RETIRE', 'CADUC', 'ANNULE');
ALTER TABLE "public"."Contract" ALTER COLUMN "statut" DROP DEFAULT;
ALTER TABLE "Contract" ALTER COLUMN "statut" TYPE "StatutContrat_new" USING ("statut"::text::"StatutContrat_new");
ALTER TYPE "StatutContrat" RENAME TO "StatutContrat_old";
ALTER TYPE "StatutContrat_new" RENAME TO "StatutContrat";
DROP TYPE "public"."StatutContrat_old";
ALTER TABLE "Contract" ALTER COLUMN "statut" SET DEFAULT 'BROUILLON';
COMMIT;

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "temoinNomContrat",
DROP COLUMN "temoinTelephoneContrat";

