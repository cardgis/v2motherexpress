-- Boutique.representantNom : nom du gérant qui signe pour le Bailleur.
-- Colonne obligatoire ajoutée sur une table déjà peuplée : on procède en
-- trois temps (ajout nullable, remplissage, passage en NOT NULL) plutôt que
-- de poser un DEFAULT qui resterait ensuite à traîner dans le schéma.

-- 1. Ajout en nullable
ALTER TABLE "Boutique" ADD COLUMN "representantNom" TEXT;

-- 2. Remplissage des boutiques existantes avec les représentants réels,
--    relevés sur les contrats signés fournis par le client.
UPDATE "Boutique" SET "representantNom" = 'MENDY Lazare Evariste'    WHERE "code" = 'THS';
UPDATE "Boutique" SET "representantNom" = 'NASSALAN Frédéric Olivier' WHERE "code" = 'MBR';

-- Filet pour toute boutique créée hors seed : la génération de contrat
-- échouerait sur une valeur vide, ce qui est préférable à un acte anonyme.
UPDATE "Boutique" SET "representantNom" = 'À RENSEIGNER' WHERE "representantNom" IS NULL;

-- 3. Passage en obligatoire
ALTER TABLE "Boutique" ALTER COLUMN "representantNom" SET NOT NULL;

-- Vehicule.cmc : Certificat de Mise en Circulation, imprimé sur le contrat
-- de vente échelonnée. Nullable — il n'est pas toujours connu à la réservation.
ALTER TABLE "Vehicule" ADD COLUMN "cmc" TEXT;
