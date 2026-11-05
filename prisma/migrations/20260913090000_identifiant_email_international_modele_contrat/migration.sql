-- Connexion par e-mail OU téléphone international, sessions révocables,
-- limitation de débit des OTP, et modèle de moto saisi par le gérant.
--
-- Migration écrite à la main pour RENOMMER la colonne OtpCode.telephone au
-- lieu de la supprimer puis la recréer (ce que Prisma aurait généré).

-- ── Canal e-mail pour les codes ────────────────────────────────────────────
ALTER TYPE "CanalOtp" ADD VALUE 'EMAIL';

-- ── Compte : téléphone OU e-mail, jamais aucun des deux ────────────────────
ALTER TABLE "User" ALTER COLUMN "telephone" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "versionSession" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD CONSTRAINT "User_telephone_ou_email"
  CHECK ("telephone" IS NOT NULL OR "email" IS NOT NULL);

-- ── Codes : destinataire générique et index de limitation de débit ─────────
ALTER TABLE "OtpCode" RENAME COLUMN "telephone" TO "destinataire";
DROP INDEX "OtpCode_telephone_but_createdAt_idx";
CREATE INDEX "OtpCode_destinataire_but_createdAt_idx" ON "OtpCode"("destinataire", "but", "createdAt");
CREATE INDEX "OtpCode_ip_createdAt_idx" ON "OtpCode"("ip", "createdAt");
CREATE INDEX "OtpCode_canal_createdAt_idx" ON "OtpCode"("canal", "createdAt");

-- ── Téléphone de contact d'un client connecté par e-mail ───────────────────
ALTER TABLE "Customer" ADD COLUMN "telephoneContact" TEXT;

-- ── Modèle porté au contrat, saisi par le gérant ───────────────────────────
ALTER TABLE "Reservation" ADD COLUMN "modeleContrat" TEXT;

-- ── Preuve de signature : code reçu par e-mail ─────────────────────────────
ALTER TABLE "Signature" ADD COLUMN "email" TEXT;
