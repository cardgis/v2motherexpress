-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COMMERCIAL';

-- CreateIndex
CREATE INDEX "ContractEvent_type_createdAt_idx" ON "ContractEvent"("type", "createdAt");
