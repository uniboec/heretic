-- P-1: BracketPublicationState + draw policy fields + auto-sync events

ALTER TABLE "BracketCategoryDraw"
  ADD COLUMN IF NOT EXISTS "drawPolicyId" TEXT,
  ADD COLUMN IF NOT EXISTS "drawPolicyVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "drawInputFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedStructureJson" JSONB;

ALTER TABLE "BracketPageSetting"
  ADD COLUMN IF NOT EXISTS "migrationPendingVisibleKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "BracketPublicationState" (
  "id" TEXT NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT false,
  "publishedDrawId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BracketPublicationState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BracketPublicationState_categoryKey_key"
  ON "BracketPublicationState"("categoryKey");
CREATE UNIQUE INDEX IF NOT EXISTS "BracketPublicationState_publishedDrawId_key"
  ON "BracketPublicationState"("publishedDrawId");

DO $$ BEGIN
  ALTER TABLE "BracketPublicationState"
    ADD CONSTRAINT "BracketPublicationState_publishedDrawId_fkey"
    FOREIGN KEY ("publishedDrawId") REFERENCES "BracketCategoryDraw"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BracketAutoSyncEvent" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "draftGenerationId" TEXT NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "revision" BIGINT,
  "success" BOOLEAN NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BracketAutoSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BracketAutoSyncEvent_draftGenerationId_categoryKey_createdAt_idx"
  ON "BracketAutoSyncEvent"("draftGenerationId", "categoryKey", "createdAt");
CREATE INDEX IF NOT EXISTS "BracketAutoSyncEvent_categoryKey_createdAt_idx"
  ON "BracketAutoSyncEvent"("categoryKey", "createdAt");
CREATE INDEX IF NOT EXISTS "BracketAutoSyncEvent_operationId_idx"
  ON "BracketAutoSyncEvent"("operationId");
