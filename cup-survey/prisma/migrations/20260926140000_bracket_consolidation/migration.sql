-- AlterEnum
ALTER TYPE "BracketMoveAction" ADD VALUE 'CONSOLIDATION';

-- AlterTable
ALTER TABLE "BracketPageSetting" ADD COLUMN "consolidationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BracketPageSetting" ADD COLUMN "consolidationPolicy" JSONB;
