-- AlterTable
ALTER TABLE "BoutsPageSetting"
ADD COLUMN "boutsStartTime" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN "matStartTimeOverrides" JSONB;

UPDATE "BoutsPageSetting"
SET "boutsStartTime" = '10:00'
WHERE "boutsStartTime" IS NULL;
