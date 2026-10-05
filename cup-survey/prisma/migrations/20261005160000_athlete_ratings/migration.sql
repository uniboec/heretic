-- AlterTable
ALTER TABLE "BoutResult" ADD COLUMN "fightOfficiallyStarted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AthleteRatingSetting" (
    "tournamentScopeId" TEXT NOT NULL,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicTopLimit" INTEGER NOT NULL DEFAULT 10,
    "firstPlacePoints" INTEGER NOT NULL DEFAULT 60,
    "secondPlacePoints" INTEGER NOT NULL DEFAULT 35,
    "thirdPlacePoints" INTEGER NOT NULL DEFAULT 15,
    "placeWithoutWinPercent" INTEGER NOT NULL DEFAULT 20,
    "pointsVictoryPoints" INTEGER NOT NULL DEFAULT 32,
    "clearAdvantageVictoryPoints" INTEGER NOT NULL DEFAULT 36,
    "submissionVictoryPoints" INTEGER NOT NULL DEFAULT 40,
    "chokeVictoryPoints" INTEGER NOT NULL DEFAULT 40,
    "injuryVictoryPoints" INTEGER NOT NULL DEFAULT 20,
    "dqVictoryPoints" INTEGER NOT NULL DEFAULT 10,
    "ageCoefficients" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteRatingSetting_pkey" PRIMARY KEY ("tournamentScopeId")
);
