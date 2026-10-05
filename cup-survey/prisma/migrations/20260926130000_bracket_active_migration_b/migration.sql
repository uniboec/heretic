-- Migration B: finalize ACTIVE singleton (run only after cutover assert COUNT=1).
-- Pre-check (ops): SELECT COUNT(*) FROM "BracketGeneration"
--   WHERE status = 'ACTIVE' AND "singletonKey" = 'live'; -- must be 1
-- Pre-check (ops): no rows with status IN ('DRAFT','PUBLISHED').

DROP INDEX IF EXISTS "bracket_generation_single_draft";

CREATE TYPE "BracketGenerationStatus_new" AS ENUM ('ACTIVE');

ALTER TABLE "BracketGeneration"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "BracketGeneration"
  ALTER COLUMN "status" TYPE "BracketGenerationStatus_new"
  USING ('ACTIVE'::"BracketGenerationStatus_new");

DROP TYPE "BracketGenerationStatus";

ALTER TYPE "BracketGenerationStatus_new" RENAME TO "BracketGenerationStatus";

ALTER TABLE "BracketGeneration"
  ALTER COLUMN "singletonKey" SET NOT NULL,
  ALTER COLUMN "singletonKey" SET DEFAULT 'live';
