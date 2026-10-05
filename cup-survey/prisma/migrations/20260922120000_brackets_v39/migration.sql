-- CreateEnum
CREATE TYPE "BracketGenerationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "OlympicBronzeMode" AS ENUM ('ONE', 'TWO');

-- CreateEnum
CREATE TYPE "BracketCategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "BracketCategoryStatusReason" AS ENUM ('NO_FORMAT_RULE', 'EXCEEDS_MAX_PARTICIPANTS', 'SYSTEM_UNAVAILABLE');

-- CreateEnum
CREATE TYPE "BracketMoveAction" AS ENUM ('MOVE', 'RESET');

-- CreateTable
CREATE TABLE "TournamentRegistrationState" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "revision" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "TournamentRegistrationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketPageSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "includePaid" BOOLEAN NOT NULL DEFAULT true,
    "includeUnpaid" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketPageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketFormatRule" (
    "id" TEXT NOT NULL,
    "minParticipants" INTEGER NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "systemId" TEXT NOT NULL,
    "defaultBronzeMode" "OlympicBronzeMode",
    "allowedSystemIds" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketFormatRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketGeneration" (
    "id" TEXT NOT NULL,
    "status" "BracketGenerationStatus" NOT NULL,
    "baseSeed" TEXT NOT NULL,
    "sourceRevision" BIGINT,
    "sourceFingerprint" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BracketGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketCategoryDraw" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "BracketCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" "BracketCategoryStatusReason",
    "autoSystemId" TEXT,
    "systemOverride" TEXT,
    "autoBronzeMode" "OlympicBronzeMode",
    "bronzeModeOverride" "OlympicBronzeMode",
    "systemVersion" INTEGER,
    "drawSeed" TEXT NOT NULL,
    "redrawRevision" INTEGER NOT NULL DEFAULT 0,
    "sourceFingerprint" TEXT,
    "seedingFingerprint" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketCategoryDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketDrawParticipant" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "seedPosition" INTEGER NOT NULL,
    "seedLocked" BOOLEAN NOT NULL DEFAULT false,
    "snapshotDisplayName" TEXT,
    "snapshotClubName" TEXT,
    "snapshotCity" TEXT,
    "snapshotPublicNumber" INTEGER,

    CONSTRAINT "BracketDrawParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketEntryPlacement" (
    "entryId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "isManualMove" BOOLEAN NOT NULL DEFAULT false,
    "movedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketEntryPlacement_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "BracketMoveAudit" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "action" "BracketMoveAction" NOT NULL,
    "fromCategoryKey" TEXT NOT NULL,
    "toCategoryKey" TEXT NOT NULL,
    "movedBy" TEXT,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BracketMoveAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BracketFormatRule_enabled_sortOrder_idx" ON "BracketFormatRule"("enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "BracketGeneration_status_publishedAt_idx" ON "BracketGeneration"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BracketCategoryDraw_generationId_categoryKey_key" ON "BracketCategoryDraw"("generationId", "categoryKey");

-- CreateIndex
CREATE UNIQUE INDEX "BracketDrawParticipant_drawId_entryId_key" ON "BracketDrawParticipant"("drawId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketDrawParticipant_drawId_seedPosition_key" ON "BracketDrawParticipant"("drawId", "seedPosition");

-- AddForeignKey
ALTER TABLE "BracketCategoryDraw" ADD CONSTRAINT "BracketCategoryDraw_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "BracketGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketDrawParticipant" ADD CONSTRAINT "BracketDrawParticipant_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "BracketCategoryDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: only one DRAFT generation
CREATE UNIQUE INDEX "bracket_generation_single_draft" ON "BracketGeneration" ("status") WHERE status = 'DRAFT';

-- Seed defaults
INSERT INTO "TournamentRegistrationState" ("id", "revision") VALUES ('default', 0);
INSERT INTO "BracketPageSetting" ("id", "publicEnabled", "includePaid", "includeUnpaid", "updatedAt")
VALUES ('default', false, true, false, CURRENT_TIMESTAMP);

INSERT INTO "BracketFormatRule" ("id", "minParticipants", "maxParticipants", "systemId", "defaultBronzeMode", "allowedSystemIds", "sortOrder", "enabled", "updatedAt")
VALUES
  (gen_random_uuid()::text, 2, 2, 'olympic', NULL, ARRAY['olympic'], 0, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 3, 3, 'round_robin', NULL, ARRAY['round_robin', 'three_way'], 1, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 4, 5, 'olympic', 'TWO', ARRAY['olympic', 'round_robin'], 2, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 6, 32, 'olympic', 'TWO', ARRAY['olympic'], 3, true, CURRENT_TIMESTAMP);
