/*
  Warnings:

  - Added the required column `annee` to the `Produit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `batterie` to the `Produit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `moteurType` to the `Produit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "annee" INTEGER NOT NULL,
ADD COLUMN     "batterie" TEXT NOT NULL,
ADD COLUMN     "moteurType" TEXT NOT NULL;
