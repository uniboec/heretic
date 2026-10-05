-- Default format: 3 participants → three_way; olympic bronze → ONE
UPDATE "BracketFormatRule"
SET "systemId" = 'three_way',
    "allowedSystemIds" = ARRAY['three_way', 'round_robin']
WHERE "minParticipants" = 3
  AND "maxParticipants" = 3;

UPDATE "BracketFormatRule"
SET "defaultBronzeMode" = 'ONE'
WHERE "systemId" = 'olympic'
  AND "defaultBronzeMode" = 'TWO';

UPDATE "BracketCategoryDraw"
SET "autoSystemId" = 'three_way',
    "systemVersion" = NULL
WHERE "systemOverride" IS NULL
  AND "autoSystemId" = 'round_robin'
  AND (
    SELECT COUNT(*)::int
    FROM "BracketDrawParticipant" p
    WHERE p."drawId" = "BracketCategoryDraw"."id"
  ) = 3;

UPDATE "BracketCategoryDraw"
SET "autoBronzeMode" = 'ONE',
    "systemVersion" = NULL
WHERE "bronzeModeOverride" IS NULL
  AND "autoBronzeMode" = 'TWO'
  AND COALESCE("systemOverride", "autoSystemId") = 'olympic';
