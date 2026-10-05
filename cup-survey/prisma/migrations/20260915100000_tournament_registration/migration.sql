-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('SUBMITTED', 'AWAITING_PAYMENT', 'PAYMENT_REVIEW', 'PAID', 'PAYMENT_REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "TeamRegistration" (
    "id" TEXT NOT NULL,
    "publicNumber" SERIAL NOT NULL,
    "editToken" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "coachName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactExtra" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "registrationStage" TEXT NOT NULL,
    "pricePerDiscipline" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "priceHeldUntil" TIMESTAMP(3),
    "consentPersonalData" BOOLEAN NOT NULL,
    "consentPublication" BOOLEAN NOT NULL,
    "adminComment" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "TeamRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "rank" TEXT,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteEntry" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "AthleteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "adminComment" TEXT,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamRegistration_publicNumber_key" ON "TeamRegistration"("publicNumber");
CREATE UNIQUE INDEX "TeamRegistration_editToken_key" ON "TeamRegistration"("editToken");
CREATE INDEX "TeamRegistration_status_idx" ON "TeamRegistration"("status");
CREATE INDEX "TeamRegistration_createdAt_idx" ON "TeamRegistration"("createdAt");
CREATE INDEX "TeamRegistration_clubName_idx" ON "TeamRegistration"("clubName");

-- CreateIndex
CREATE INDEX "Athlete_registrationId_idx" ON "Athlete"("registrationId");

-- CreateIndex
CREATE INDEX "AthleteEntry_discipline_idx" ON "AthleteEntry"("discipline");
CREATE UNIQUE INDEX "AthleteEntry_athleteId_discipline_key" ON "AthleteEntry"("athleteId", "discipline");

-- CreateIndex
CREATE INDEX "PaymentProof_registrationId_idx" ON "PaymentProof"("registrationId");

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TeamRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteEntry" ADD CONSTRAINT "AthleteEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TeamRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
