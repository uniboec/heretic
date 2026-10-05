-- CreateEnum
CREATE TYPE "AwardQueueGroup" AS ENUM ('NORMAL', 'DEFERRED');

-- CreateEnum
CREATE TYPE "AwardCeremonyStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AwardPlacementStatus" AS ENUM ('PENDING', 'AWARDED', 'NOT_AWARDED');

-- CreateTable
CREATE TABLE "AwardsPageSetting" (
    "tournamentScopeId" TEXT NOT NULL,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ceremonyStartTime" TEXT NOT NULL DEFAULT '11:00',
    "ceremonyDurationMinutes" INTEGER NOT NULL DEFAULT 3,
    "ceremonyBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "queueRevision" INTEGER NOT NULL DEFAULT 0,
    "ceremonySequenceCounter" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardsPageSetting_pkey" PRIMARY KEY ("tournamentScopeId")
);

-- CreateTable
CREATE TABLE "AwardCeremonyQueue" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "status" "AwardCeremonyStatus" NOT NULL DEFAULT 'PENDING',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "queueGroup" "AwardQueueGroup" NOT NULL DEFAULT 'NORMAL',
    "queueOrder" INTEGER NOT NULL,
    "ceremonySequence" INTEGER,
    "completedAtCategory" TIMESTAMP(3) NOT NULL,
    "ceremonyCompletedAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "scheduledStartAtSnapshot" TIMESTAMP(3),
    "durationMinutesSnapshot" INTEGER,
    "breakMinutesSnapshot" INTEGER,
    "adminComment" TEXT,
    "publicComment" TEXT,
    "conflictReason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardCeremonyQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardCeremonyPlacement" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "placementIndex" INTEGER NOT NULL,
    "status" "AwardPlacementStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "adminComment" TEXT,
    "publicComment" TEXT,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "clubName" TEXT NOT NULL,

    CONSTRAINT "AwardCeremonyPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardCeremonyOperation" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardCeremonyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AwardCeremonyQueue_tournamentScopeId_categoryKey_key" ON "AwardCeremonyQueue"("tournamentScopeId", "categoryKey");

-- CreateIndex
CREATE INDEX "AwardCeremonyQueue_tournamentScopeId_ceremonySequence_idx" ON "AwardCeremonyQueue"("tournamentScopeId", "ceremonySequence");

-- CreateIndex
CREATE INDEX "AwardCeremonyQueue_tournamentScopeId_status_queueGroup_queueOrder_idx" ON "AwardCeremonyQueue"("tournamentScopeId", "status", "queueGroup", "queueOrder");

-- CreateIndex
CREATE INDEX "AwardCeremonyQueue_tournamentScopeId_needsReview_idx" ON "AwardCeremonyQueue"("tournamentScopeId", "needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "AwardCeremonyPlacement_queueId_entryId_key" ON "AwardCeremonyPlacement"("queueId", "entryId");

-- CreateIndex
CREATE INDEX "AwardCeremonyPlacement_queueId_placement_placementIndex_idx" ON "AwardCeremonyPlacement"("queueId", "placement", "placementIndex");

-- CreateIndex
CREATE UNIQUE INDEX "AwardCeremonyOperation_tournamentScopeId_operationId_key" ON "AwardCeremonyOperation"("tournamentScopeId", "operationId");

-- CreateIndex
CREATE INDEX "AwardCeremonyOperation_tournamentScopeId_createdAt_idx" ON "AwardCeremonyOperation"("tournamentScopeId", "createdAt");

-- Partial unique index: one IN_PROGRESS per scope
CREATE UNIQUE INDEX "AwardCeremonyQueue_one_in_progress_per_scope"
  ON "AwardCeremonyQueue" ("tournamentScopeId")
  WHERE "status" = 'IN_PROGRESS';

-- AddForeignKey
ALTER TABLE "AwardCeremonyPlacement" ADD CONSTRAINT "AwardCeremonyPlacement_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "AwardCeremonyQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default settings row
INSERT INTO "AwardsPageSetting" ("tournamentScopeId", "publicEnabled", "ceremonyStartTime", "ceremonyDurationMinutes", "ceremonyBreakMinutes", "queueRevision", "ceremonySequenceCounter", "updatedAt")
VALUES ('cup-2026', false, '11:00', 3, 0, 0, 0, CURRENT_TIMESTAMP);
