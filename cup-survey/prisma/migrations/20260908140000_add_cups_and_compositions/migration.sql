-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN "acceptableCups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "SurveyResponse" ADD COLUMN "acceptablePrizeCompositions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
