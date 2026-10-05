-- Migration A: expand schema for ACTIVE singleton cutover (DRAFT/PUBLISHED remain)

-- BracketGenerationStatus: add ACTIVE
ALTER TYPE "BracketGenerationStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';

-- BracketGeneration: singletonKey
ALTER TABLE "BracketGeneration" ADD COLUMN IF NOT EXISTS "singletonKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "BracketGeneration_singletonKey_key" ON "BracketGeneration"("singletonKey");

-- BracketBackup
CREATE TABLE IF NOT EXISTS "BracketBackup" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "schemaVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BracketBackup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BracketBackup_createdAt_idx" ON "BracketBackup"("createdAt");

-- BracketCutoverCheckpoint
CREATE TABLE IF NOT EXISTS "BracketCutoverCheckpoint" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "phase" TEXT NOT NULL,
    "payload" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BracketCutoverCheckpoint_pkey" PRIMARY KEY ("id")
);

-- BracketAutoSyncEvent: draftGenerationId -> generationId
ALTER TABLE "BracketAutoSyncEvent" ADD COLUMN IF NOT EXISTS "generationId" TEXT;

UPDATE "BracketAutoSyncEvent"
SET "generationId" = "draftGenerationId"
WHERE "generationId" IS NULL AND "draftGenerationId" IS NOT NULL;

ALTER TABLE "BracketAutoSyncEvent" DROP COLUMN IF EXISTS "draftGenerationId";

ALTER TABLE "BracketAutoSyncEvent"
  ADD CONSTRAINT "BracketAutoSyncEvent_generationId_fkey"
  FOREIGN KEY ("generationId") REFERENCES "BracketGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "BracketAutoSyncEvent_generationId_categoryKey_createdAt_idx"
  ON "BracketAutoSyncEvent"("generationId", "categoryKey", "createdAt");
