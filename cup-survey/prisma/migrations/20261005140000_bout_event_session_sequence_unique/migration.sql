CREATE UNIQUE INDEX IF NOT EXISTS "BoutEvent_boutSessionId_sequence_key"
  ON "BoutEvent"("boutSessionId", "sequence")
  WHERE "boutSessionId" IS NOT NULL;
