CREATE TABLE IF NOT EXISTS "BoutBracketUnlockOutbox" (
  "id" TEXT NOT NULL,
  "boutId" TEXT NOT NULL,
  "boutSessionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BoutBracketUnlockOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoutBracketUnlockOutbox_boutSessionId_key"
  ON "BoutBracketUnlockOutbox"("boutSessionId");

CREATE INDEX IF NOT EXISTS "BoutBracketUnlockOutbox_boutId_idx"
  ON "BoutBracketUnlockOutbox"("boutId");
