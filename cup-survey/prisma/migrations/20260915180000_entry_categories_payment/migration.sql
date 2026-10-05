-- CreateEnum
CREATE TYPE "EntryPaymentStatus" AS ENUM ('UNPAID', 'PAYMENT_REVIEW', 'PAID');

-- AlterTable
ALTER TABLE "AthleteEntry" DROP CONSTRAINT IF EXISTS "AthleteEntry_athleteId_discipline_key";

ALTER TABLE "AthleteEntry" ADD COLUMN "experienceLevel" TEXT NOT NULL DEFAULT 'novice';
ALTER TABLE "AthleteEntry" ADD COLUMN "paymentStatus" "EntryPaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "AthleteEntry" ADD COLUMN "paymentStage" TEXT;
ALTER TABLE "AthleteEntry" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Backfill experience level from athlete rank
UPDATE "AthleteEntry" AS ae
SET "experienceLevel" = CASE
  WHEN a."rank" IS NULL OR a."rank" IN ('none', 'child_3', 'youth_3', 'adult_3') THEN 'novice'
  ELSE 'experienced'
END
FROM "Athlete" AS a
WHERE ae."athleteId" = a."id";

-- Backfill payment status from registration status
UPDATE "AthleteEntry" AS ae
SET "paymentStatus" = CASE
  WHEN tr."status" = 'PAID' THEN 'PAID'::"EntryPaymentStatus"
  WHEN tr."status" = 'PAYMENT_REVIEW' THEN 'PAYMENT_REVIEW'::"EntryPaymentStatus"
  ELSE 'UNPAID'::"EntryPaymentStatus"
END
FROM "Athlete" AS a
JOIN "TeamRegistration" AS tr ON a."registrationId" = tr."id"
WHERE ae."athleteId" = a."id";

-- AlterTable PaymentProof
ALTER TABLE "PaymentProof" ADD COLUMN "amount" INTEGER;
ALTER TABLE "PaymentProof" ADD COLUMN "registrationStage" TEXT;

-- CreateTable
CREATE TABLE "PaymentProofEntry" (
    "id" TEXT NOT NULL,
    "paymentProofId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "PaymentProofEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProofEntry_paymentProofId_entryId_key" ON "PaymentProofEntry"("paymentProofId", "entryId");
CREATE UNIQUE INDEX "PaymentProofEntry_entryId_key" ON "PaymentProofEntry"("entryId");
CREATE INDEX "PaymentProofEntry_paymentProofId_idx" ON "PaymentProofEntry"("paymentProofId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteEntry_athleteId_discipline_ageDivisionId_weightCategoryId_experienceLevel_key"
ON "AthleteEntry"("athleteId", "discipline", "ageDivisionId", "weightCategoryId", "experienceLevel");

-- AddForeignKey
ALTER TABLE "PaymentProofEntry" ADD CONSTRAINT "PaymentProofEntry_paymentProofId_fkey" FOREIGN KEY ("paymentProofId") REFERENCES "PaymentProof"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProofEntry" ADD CONSTRAINT "PaymentProofEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AthleteEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
