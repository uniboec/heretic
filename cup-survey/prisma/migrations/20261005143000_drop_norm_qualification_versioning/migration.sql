-- Drop versioned calc snapshots; keep one result set per tournament scope.

ALTER TABLE "RankQualificationSetting" ADD COLUMN "calculatedAt" TIMESTAMP(3);

ALTER TABLE "RankQualificationResult" ADD COLUMN "tournamentScopeId" TEXT;
ALTER TABLE "RankQualificationBracketDetail" ADD COLUMN "tournamentScopeId" TEXT;

UPDATE "RankQualificationResult" r
SET "tournamentScopeId" = c."tournamentScopeId"
FROM "RankQualificationCalc" c
WHERE r."calcId" = c."id";

UPDATE "RankQualificationBracketDetail" bd
SET "tournamentScopeId" = c."tournamentScopeId"
FROM "RankQualificationCalc" c
WHERE bd."calcId" = c."id";

UPDATE "RankQualificationSetting" s
SET "calculatedAt" = c."calculatedAt"
FROM "RankQualificationCalc" c
WHERE s."latestCalcId" = c."id";

WITH latest_calc AS (
  SELECT DISTINCT ON ("tournamentScopeId") id
  FROM "RankQualificationCalc"
  ORDER BY "tournamentScopeId", "version" DESC
)
DELETE FROM "RankQualificationResult" r
WHERE r."calcId" NOT IN (SELECT id FROM latest_calc);

WITH latest_calc AS (
  SELECT DISTINCT ON ("tournamentScopeId") id
  FROM "RankQualificationCalc"
  ORDER BY "tournamentScopeId", "version" DESC
)
DELETE FROM "RankQualificationBracketDetail" bd
WHERE bd."calcId" NOT IN (SELECT id FROM latest_calc);

ALTER TABLE "RankQualificationSetting" DROP CONSTRAINT IF EXISTS "RankQualificationSetting_latestCalcId_fkey";
ALTER TABLE "RankQualificationResult" DROP CONSTRAINT IF EXISTS "RankQualificationResult_calcId_fkey";
ALTER TABLE "RankQualificationResult" DROP CONSTRAINT IF EXISTS "RankQualificationResult_sourceBracketDetailId_fkey";
ALTER TABLE "RankQualificationBracketDetail" DROP CONSTRAINT IF EXISTS "RankQualificationBracketDetail_calcId_fkey";

DROP INDEX IF EXISTS "RankQualificationResult_calcId_athleteId_discipline_key";
DROP INDEX IF EXISTS "RankQualificationBracketDetail_calcId_athleteId_discipline_ca_key";
DROP INDEX IF EXISTS "RankQualificationResult_calcId_idx";
DROP INDEX IF EXISTS "RankQualificationBracketDetail_calcId_idx";
DROP INDEX IF EXISTS "RankQualificationSetting_latestCalcId_key";

ALTER TABLE "RankQualificationResult" DROP COLUMN "calcId";
ALTER TABLE "RankQualificationResult" DROP COLUMN "evskRuleSnapshot";
ALTER TABLE "RankQualificationBracketDetail" DROP COLUMN "calcId";
ALTER TABLE "RankQualificationBracketDetail" DROP COLUMN "evskRuleSnapshot";
ALTER TABLE "RankQualificationSetting" DROP COLUMN "latestCalcId";

ALTER TABLE "RankQualificationResult" ALTER COLUMN "tournamentScopeId" SET NOT NULL;
ALTER TABLE "RankQualificationBracketDetail" ALTER COLUMN "tournamentScopeId" SET NOT NULL;

CREATE UNIQUE INDEX "RankQualificationResult_tournamentScopeId_athleteId_discipline_key"
  ON "RankQualificationResult"("tournamentScopeId", "athleteId", "discipline");
CREATE INDEX "RankQualificationResult_tournamentScopeId_idx"
  ON "RankQualificationResult"("tournamentScopeId");

CREATE UNIQUE INDEX "RankQualificationBracketDetail_tournamentScopeId_athleteId_disc_key"
  ON "RankQualificationBracketDetail"("tournamentScopeId", "athleteId", "discipline", "categoryKey");
CREATE INDEX "RankQualificationBracketDetail_tournamentScopeId_idx"
  ON "RankQualificationBracketDetail"("tournamentScopeId");

ALTER TABLE "RankQualificationResult"
  ADD CONSTRAINT "RankQualificationResult_sourceBracketDetailId_fkey"
  FOREIGN KEY ("sourceBracketDetailId") REFERENCES "RankQualificationBracketDetail"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE "RankQualificationCalc";
