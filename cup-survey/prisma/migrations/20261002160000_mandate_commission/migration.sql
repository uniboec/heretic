-- CreateEnum
CREATE TYPE "MandateCheckStatus" AS ENUM ('UNCHECKED', 'VERIFIED', 'ISSUE');

-- CreateEnum
CREATE TYPE "IdentityDocumentType" AS ENUM ('PASSPORT', 'INTERNATIONAL_PASSPORT', 'BIRTH_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "WeightCheckMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "AthleteMandateCheck" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "identityStatus" "MandateCheckStatus" NOT NULL DEFAULT 'UNCHECKED',
    "identityDocumentType" "IdentityDocumentType",
    "medicalStatus" "MandateCheckStatus" NOT NULL DEFAULT 'UNCHECKED',
    "insuranceStatus" "MandateCheckStatus" NOT NULL DEFAULT 'UNCHECKED',
    "weightCheckMode" "WeightCheckMode",
    "actualWeightKg" DECIMAL(6,2),
    "manualWeightVerified" BOOLEAN NOT NULL DEFAULT false,
    "manualWeightCategoryFingerprint" TEXT,
    "comment" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteMandateCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteMandateCheck_tournamentScopeId_idx" ON "AthleteMandateCheck"("tournamentScopeId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteMandateCheck_tournamentScopeId_athleteId_key" ON "AthleteMandateCheck"("tournamentScopeId", "athleteId");

-- AddForeignKey
ALTER TABLE "AthleteMandateCheck" ADD CONSTRAINT "AthleteMandateCheck_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
