-- Remove legacy global medical timeout events (replaced by per-athlete doctor visits).
DELETE FROM "BoutEvent"
WHERE "eventType" IN ('MEDICAL_START', 'MEDICAL_END');
