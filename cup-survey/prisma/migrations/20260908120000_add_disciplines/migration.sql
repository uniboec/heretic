-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN "disciplines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
