-- Expand BoutScheduleExecution for mat control live state
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026';
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "officialStartedAt" TIMESTAMP(3);
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "officialEndedAt" TIMESTAMP(3);
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "mainEndedAt" TIMESTAMP(3);
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "extraEndedAt" TIMESTAMP(3);
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "activityCorrectionMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "periodCorrectionMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "attemptNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "boutPhase" TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "clockState" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "clockStartedAt" TIMESTAMP(3);
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "clockElapsedBeforeStartMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "currentPeriod" TEXT NOT NULL DEFAULT 'main';
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "nextEventSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "liveRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BoutScheduleExecution" ADD COLUMN IF NOT EXISTS "liveSnapshot" JSONB;

CREATE TABLE IF NOT EXISTS "BoutResult" (
    "id" TEXT NOT NULL,
    "boutId" TEXT NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026',
    "winnerEntryId" TEXT,
    "loserEntryId" TEXT,
    "victoryMethod" TEXT NOT NULL,
    "decisionReason" TEXT NOT NULL,
    "decisionDetails" JSONB,
    "decidedInPeriod" TEXT NOT NULL,
    "mainRedScore" INTEGER NOT NULL,
    "mainBlueScore" INTEGER NOT NULL,
    "extraRedScore" INTEGER,
    "extraBlueScore" INTEGER,
    "cornersSwapped" BOOLEAN NOT NULL DEFAULT false,
    "officialEndedAt" TIMESTAMP(3) NOT NULL,
    "resultConfirmedAt" TIMESTAMP(3) NOT NULL,
    "confirmedBy" TEXT,
    "resultStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "invalidatedAt" TIMESTAMP(3),
    "invalidatedBy" TEXT,
    "invalidationReason" TEXT,
    "invalidatedByCorrectionCaseId" TEXT,
    "supersededByResultId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoutResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoutResult_boutId_resultVersion_key" ON "BoutResult"("boutId", "resultVersion");
CREATE INDEX IF NOT EXISTS "BoutResult_boutId_isCurrent_idx" ON "BoutResult"("boutId", "isCurrent");
CREATE UNIQUE INDEX IF NOT EXISTS "BoutResult_one_current_per_bout" ON "BoutResult"("boutId") WHERE "isCurrent" = true;

CREATE TABLE IF NOT EXISTS "BoutResultRevision" (
    "id" TEXT NOT NULL,
    "boutResultId" TEXT NOT NULL,
    "resultCorrectionCaseId" TEXT,
    "previousJson" JSONB NOT NULL,
    "newJson" JSONB NOT NULL,
    "reason" TEXT,
    "editedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoutResultRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BoutResultRevision_boutResultId_idx" ON "BoutResultRevision"("boutResultId");

ALTER TABLE "BoutResultRevision" DROP CONSTRAINT IF EXISTS "BoutResultRevision_boutResultId_fkey";
ALTER TABLE "BoutResultRevision" ADD CONSTRAINT "BoutResultRevision_boutResultId_fkey" FOREIGN KEY ("boutResultId") REFERENCES "BoutResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ResultCorrectionCase" (
    "id" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026',
    "sourceBoutId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "correctionMode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "previousSourceResultJson" JSONB NOT NULL,
    "newSourceResultJson" JSONB NOT NULL,
    "invalidatedBoutIds" JSONB NOT NULL,
    "affectedBoutIds" JSONB NOT NULL,
    "dependencySnapshot" JSONB,
    "errorDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultCorrectionCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResultCorrectionCase_sourceBoutId_operationId_key" ON "ResultCorrectionCase"("sourceBoutId", "operationId");
CREATE INDEX IF NOT EXISTS "ResultCorrectionCase_tournamentScopeId_createdAt_idx" ON "ResultCorrectionCase"("tournamentScopeId", "createdAt");

CREATE TABLE IF NOT EXISTS "BoutEvent" (
    "id" TEXT NOT NULL,
    "boutId" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026',
    "clientEventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "entryId" TEXT,
    "cornerAtEvent" TEXT,
    "points" INTEGER,
    "episodeId" TEXT,
    "boutElapsedMs" INTEGER,
    "period" TEXT NOT NULL DEFAULT 'main',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoutEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoutEvent_boutId_clientEventId_key" ON "BoutEvent"("boutId", "clientEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "BoutEvent_boutId_sequence_key" ON "BoutEvent"("boutId", "sequence");
CREATE INDEX IF NOT EXISTS "BoutEvent_boutId_createdAt_idx" ON "BoutEvent"("boutId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoutEvent_boutId_entryId_idx" ON "BoutEvent"("boutId", "entryId");

CREATE TABLE IF NOT EXISTS "MatControlSession" (
    "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026',
    "matIndex" INTEGER NOT NULL,
    "activeBoutId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "holderToken" TEXT,
    "holderSince" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatControlSession_pkey" PRIMARY KEY ("tournamentScopeId","matIndex")
);

CREATE TABLE IF NOT EXISTS "BoutControlCommand" (
    "id" TEXT NOT NULL,
    "boutId" TEXT NOT NULL,
    "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026',
    "operationId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdEventIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoutControlCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoutControlCommand_boutId_operationId_key" ON "BoutControlCommand"("boutId", "operationId");
CREATE INDEX IF NOT EXISTS "BoutControlCommand_boutId_createdAt_idx" ON "BoutControlCommand"("boutId", "createdAt");

CREATE TABLE IF NOT EXISTS "AthleteRestState" (
    "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026',
    "entryId" TEXT NOT NULL,
    "restUntil" TIMESTAMP(3) NOT NULL,
    "restOverrideUntil" TIMESTAMP(3),
    "sourceBoutId" TEXT,
    "sourceAttemptNumber" INTEGER,
    "invalidatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteRestState_pkey" PRIMARY KEY ("tournamentScopeId","entryId")
);
