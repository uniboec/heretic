-- Legacy completed bouts may lack frozen numbers until backfill runs.
UPDATE "BoutsPageSetting"
SET "scheduleLegacyGap" = true
WHERE id = 'default'
  AND EXISTS (
    SELECT 1
    FROM "BoutScheduleExecution"
    WHERE "actualEndAt" IS NOT NULL
      AND "frozenScheduleFormatted" IS NULL
  );

WITH numbered AS (
  SELECT
    "boutId",
    row_number() OVER (ORDER BY "actualEndAt", "boutId") AS pos
  FROM "BoutScheduleExecution"
  WHERE "actualEndAt" IS NOT NULL
    AND "frozenScheduleFormatted" IS NULL
)
UPDATE "BoutScheduleExecution" AS bse
SET
  "frozenScheduleFormatted" = '1-' || numbered.pos::text,
  "frozenScheduleMatNumber" = 1,
  "frozenSchedulePosition" = numbered.pos
FROM numbered
WHERE bse."boutId" = numbered."boutId";

ALTER TABLE "BoutScheduleExecution"
ADD CONSTRAINT "BoutScheduleExecution_completed_requires_frozen_number"
CHECK ("actualEndAt" IS NULL OR "frozenScheduleFormatted" IS NOT NULL);
