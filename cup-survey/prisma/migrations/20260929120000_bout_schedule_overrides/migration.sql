-- AlterTable
ALTER TABLE "BoutsPageSetting" ADD COLUMN "pinAllFinalsToEnd" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BracketPublicationState" ADD COLUMN "scheduleOverrides" JSONB;
