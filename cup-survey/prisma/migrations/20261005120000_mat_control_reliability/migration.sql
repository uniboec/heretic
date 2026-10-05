-- Mat-control reliability foundation (P0.5/P1/P2)

ALTER TABLE "BoutEvent"
  ADD COLUMN IF NOT EXISTS "eventStatus" TEXT NOT NULL DEFAULT 'COMMITTED',
  ADD COLUMN IF NOT EXISTS "eventHash" TEXT,
  ADD COLUMN IF NOT EXISTS "boutSessionId" TEXT;

CREATE INDEX IF NOT EXISTS "BoutEvent_boutSessionId_sequence_idx"
  ON "BoutEvent"("boutSessionId", "sequence");

CREATE INDEX IF NOT EXISTS "BoutEvent_boutSessionId_eventStatus_idx"
  ON "BoutEvent"("boutSessionId", "eventStatus");

CREATE TABLE IF NOT EXISTS "BoutSessionOwnership" (
  "id" TEXT NOT NULL,
  "boutId" TEXT NOT NULL,
  "boutSessionId" TEXT NOT NULL,
  "clientSessionId" TEXT NOT NULL,
  "ownershipEpoch" INTEGER NOT NULL DEFAULT 1,
  "sessionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "leasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "staleAt" TIMESTAMP(3),
  "clockStartedAt" TIMESTAMP(3),
  "leasedByUserId" TEXT,
  "expectedSequenceNo" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BoutSessionOwnership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoutSessionOwnership_boutSessionId_key"
  ON "BoutSessionOwnership"("boutSessionId");

CREATE INDEX IF NOT EXISTS "BoutSessionOwnership_boutId_releasedAt_idx"
  ON "BoutSessionOwnership"("boutId", "releasedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "bout_one_active_session"
  ON "BoutSessionOwnership"("boutId")
  WHERE "releasedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "BoutSessionAcquireRequest" (
  "id" TEXT NOT NULL,
  "boutId" TEXT NOT NULL,
  "acquireRequestId" TEXT NOT NULL,
  "boutSessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BoutSessionAcquireRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoutSessionAcquireRequest_boutId_acquireRequestId_key"
  ON "BoutSessionAcquireRequest"("boutId", "acquireRequestId");

CREATE INDEX IF NOT EXISTS "BoutSessionAcquireRequest_boutSessionId_idx"
  ON "BoutSessionAcquireRequest"("boutSessionId");

CREATE TABLE IF NOT EXISTS "BoutSessionCommitAck" (
  "boutSessionId" TEXT NOT NULL,
  "packageHash" TEXT NOT NULL,
  "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BoutSessionCommitAck_pkey" PRIMARY KEY ("boutSessionId")
);

CREATE TABLE IF NOT EXISTS "BoutOwnershipTakeoverLog" (
  "id" TEXT NOT NULL,
  "boutSessionId" TEXT NOT NULL,
  "oldClientSessionId" TEXT NOT NULL,
  "newClientSessionId" TEXT NOT NULL,
  "oldEpoch" INTEGER NOT NULL,
  "newEpoch" INTEGER NOT NULL,
  "adminId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "suffixDisposition" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BoutOwnershipTakeoverLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BoutOwnershipTakeoverLog_boutSessionId_createdAt_idx"
  ON "BoutOwnershipTakeoverLog"("boutSessionId", "createdAt");

CREATE TABLE IF NOT EXISTS "MatControlAuditEntry" (
  "id" TEXT NOT NULL,
  "tournamentScopeId" TEXT NOT NULL DEFAULT 'cup-2026',
  "boutId" TEXT NOT NULL,
  "issueCode" TEXT NOT NULL,
  "issueMessage" TEXT NOT NULL,
  "victoryMethod" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "metadata" JSONB,

  CONSTRAINT "MatControlAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatControlAuditEntry_tournamentScopeId_detectedAt_idx"
  ON "MatControlAuditEntry"("tournamentScopeId", "detectedAt");

CREATE INDEX IF NOT EXISTS "MatControlAuditEntry_boutId_issueCode_idx"
  ON "MatControlAuditEntry"("boutId", "issueCode");
