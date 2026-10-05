-- CreateTable
CREATE TABLE "BoutsPageSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "matCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoutsPageSetting_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "BracketCategoryDraw" ADD COLUMN "matIndex" INTEGER;

-- CHECK constraints
ALTER TABLE "BoutsPageSetting"
ADD CONSTRAINT "BoutsPageSetting_matCount_check"
CHECK ("matCount" >= 1 AND "matCount" <= 3);

ALTER TABLE "BracketCategoryDraw"
ADD CONSTRAINT "BracketCategoryDraw_matIndex_check"
CHECK ("matIndex" IS NULL OR ("matIndex" >= 1 AND "matIndex" <= 3));

-- Seed default row
INSERT INTO "BoutsPageSetting" ("id", "publicEnabled", "matCount", "updatedAt")
VALUES ('default', false, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
