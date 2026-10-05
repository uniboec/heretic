-- AlterTable
ALTER TABLE "BoutResult" ADD COLUMN "boutElapsedMs" INTEGER,
ADD COLUMN "stoppageTrigger" TEXT,
ADD COLUMN "stoppageEventId" TEXT;

-- CreateIndex
CREATE INDEX "BoutResult_tournamentScopeId_isCurrent_resultStatus_boutElapsedMs_idx" ON "BoutResult"("tournamentScopeId", "isCurrent", "resultStatus", "boutElapsedMs");
