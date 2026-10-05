-- CreateEnum
CREATE TYPE "AutoMatAssignMode" AS ENUM ('BY_CATEGORY', 'BY_BOUT');

-- AlterTable
ALTER TABLE "BoutsPageSetting"
  ADD COLUMN "autoMatAssignMode" "AutoMatAssignMode" NOT NULL DEFAULT 'BY_BOUT',
  ADD COLUMN "autoMatByCategoryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing rows
UPDATE "BoutsPageSetting" SET "autoMatAssignMode" = 'BY_BOUT';

-- Singleton invariant (empty DB safe)
INSERT INTO "BoutsPageSetting" (
  id,
  "publicEnabled",
  "matCount",
  "autoMatAssignMode",
  "autoMatByCategoryEnabled",
  "updatedAt"
) VALUES (
  'default',
  false,
  1,
  'BY_BOUT',
  false,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;
