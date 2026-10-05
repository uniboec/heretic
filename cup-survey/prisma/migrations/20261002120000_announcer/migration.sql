-- CreateEnum
CREATE TYPE "AnnouncerEventType" AS ENUM ('BOUT_CALL', 'BOUT_PREPARE', 'BOUT_RESULT', 'AWARD_CALL', 'AWARD_PREPARE');

-- CreateEnum
CREATE TYPE "AnnouncerEventStatus" AS ENUM ('QUEUED', 'GENERATING', 'READY', 'PLAYING', 'PLAYED', 'SKIPPED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnnouncerNameFormat" AS ENUM ('LAST_FIRST', 'LAST_FIRST_MIDDLE');

-- CreateEnum
CREATE TYPE "AnnouncerMode" AS ENUM ('AUTO', 'MANUAL', 'PAUSED');

-- CreateTable
CREATE TABLE "AnnouncerSetting" (
    "tournamentScopeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "AnnouncerMode" NOT NULL DEFAULT 'AUTO',
    "primaryProvider" TEXT NOT NULL DEFAULT 'yandex',
    "primaryVoiceId" TEXT,
    "fallbackProvider1" TEXT,
    "fallbackVoiceId1" TEXT,
    "fallbackProvider2" TEXT,
    "fallbackVoiceId2" TEXT,
    "speechRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "announcementGapMs" INTEGER NOT NULL DEFAULT 3000,
    "cueToSpeechGapMs" INTEGER NOT NULL DEFAULT 700,
    "nextPlaybackAllowedAt" TIMESTAMP(3),
    "boutCueSoundId" TEXT NOT NULL DEFAULT 'bout-two-tone',
    "awardCueSoundId" TEXT NOT NULL DEFAULT 'award-three-tone',
    "cueVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncerSetting_pkey" PRIMARY KEY ("tournamentScopeId")
);

-- CreateTable
CREATE TABLE "AnnouncerRule" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL,
    "eventType" "AnnouncerEventType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL,
    "nameFormat" "AnnouncerNameFormat" NOT NULL DEFAULT 'LAST_FIRST',
    "includeMat" BOOLEAN NOT NULL DEFAULT true,
    "includeCategory" BOOLEAN NOT NULL DEFAULT true,
    "includeCorner" BOOLEAN NOT NULL DEFAULT false,
    "includeClub" BOOLEAN NOT NULL DEFAULT false,
    "includeCity" BOOLEAN NOT NULL DEFAULT false,
    "includeMethod" BOOLEAN NOT NULL DEFAULT false,
    "includePlacement" BOOLEAN NOT NULL DEFAULT false,
    "includeAge" BOOLEAN NOT NULL DEFAULT true,
    "includeWeight" BOOLEAN NOT NULL DEFAULT true,
    "includeCueSound" BOOLEAN NOT NULL DEFAULT false,
    "ttlSeconds" INTEGER NOT NULL,

    CONSTRAINT "AnnouncerRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncerEvent" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL,
    "type" "AnnouncerEventType" NOT NULL,
    "priority" INTEGER NOT NULL,
    "sourceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "textSnapshot" TEXT,
    "audioCacheKey" TEXT,
    "audioDurationMs" INTEGER,
    "status" "AnnouncerEventStatus" NOT NULL DEFAULT 'QUEUED',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "generationToken" TEXT,
    "generationStartedAt" TIMESTAMP(3),
    "generationLeaseUntil" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "leaseUntil" TIMESTAMP(3),

    CONSTRAINT "AnnouncerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncerPositionState" (
    "tournamentScopeId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "currentPositionId" TEXT,
    "positionEpoch" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncerPositionState_pkey" PRIMARY KEY ("tournamentScopeId","scopeKey")
);

-- CreateTable
CREATE TABLE "AnnouncerAudioCache" (
    "cacheKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "speechRate" DOUBLE PRECISION NOT NULL,
    "textHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncerAudioCache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateTable
CREATE TABLE "AnnouncerPronunciation" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "spokenText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncerPronunciation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncerRule_tournamentScopeId_eventType_key" ON "AnnouncerRule"("tournamentScopeId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncerEvent_tournamentScopeId_dedupeKey_key" ON "AnnouncerEvent"("tournamentScopeId", "dedupeKey");

-- CreateIndex
CREATE INDEX "AnnouncerEvent_tournamentScopeId_status_priority_createdAt_idx" ON "AnnouncerEvent"("tournamentScopeId", "status", "priority" DESC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AnnouncerEvent_tournamentScopeId_status_generationLeaseUntil_idx" ON "AnnouncerEvent"("tournamentScopeId", "status", "generationLeaseUntil");

-- CreateIndex
CREATE INDEX "AnnouncerEvent_tournamentScopeId_status_leaseUntil_idx" ON "AnnouncerEvent"("tournamentScopeId", "status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncerPronunciation_tournamentScopeId_sourceText_key" ON "AnnouncerPronunciation"("tournamentScopeId", "sourceText");

-- Partial unique: at most one PLAYING per tournament scope
CREATE UNIQUE INDEX "AnnouncerEvent_one_playing_per_scope"
  ON "AnnouncerEvent" ("tournamentScopeId")
  WHERE status = 'PLAYING';
