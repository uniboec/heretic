-- AlterTable
ALTER TABLE "BracketCategoryDraw" ADD COLUMN "competitionStage" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "BoutsPageSetting" ADD COLUMN "competitionStageSettings" JSONB;
