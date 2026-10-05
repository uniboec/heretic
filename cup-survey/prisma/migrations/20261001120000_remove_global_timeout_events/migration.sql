-- Remove legacy global bout timeout events (replaced by per-corner equipment correction).
DELETE FROM "BoutEvent"
WHERE "eventType" IN ('TIMEOUT_START', 'TIMEOUT_END');
