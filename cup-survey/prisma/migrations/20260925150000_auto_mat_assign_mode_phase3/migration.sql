-- Phase 3: DB default only — existing singleton row is not updated.
ALTER TABLE "BoutsPageSetting"
  ALTER COLUMN "autoMatAssignMode" SET DEFAULT 'BY_CATEGORY';
