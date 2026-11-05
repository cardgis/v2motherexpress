-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "suiviDepuis" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Echeance" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantDu" INTEGER NOT NULL,
    "echeanceLe" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Echeance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encaissement" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "echeanceId" TEXT,
    "montant" INTEGER NOT NULL,
    "recuLe" TIMESTAMP(3) NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "reference" TEXT,
    "saisiParUserId" TEXT NOT NULL,
    "saisiParNom" TEXT NOT NULL,
    "annuleLe" TIMESTAMP(3),
    "annuleParUserId" TEXT,
    "annuleMotif" TEXT,
    "recuRef" TEXT,
    "recuPdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Encaissement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Echeance_echeanceLe_idx" ON "Echeance"("echeanceLe");

-- CreateIndex
CREATE UNIQUE INDEX "Echeance_reservationId_numero_key" ON "Echeance"("reservationId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Encaissement_recuRef_key" ON "Encaissement"("recuRef");

-- CreateIndex
CREATE INDEX "Encaissement_reservationId_recuLe_idx" ON "Encaissement"("reservationId", "recuLe");

-- CreateIndex
CREATE INDEX "Encaissement_recuLe_idx" ON "Encaissement"("recuLe");

-- AddForeignKey
ALTER TABLE "Echeance" ADD CONSTRAINT "Echeance_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encaissement" ADD CONSTRAINT "Encaissement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encaissement" ADD CONSTRAINT "Encaissement_echeanceId_fkey" FOREIGN KEY ("echeanceId") REFERENCES "Echeance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
