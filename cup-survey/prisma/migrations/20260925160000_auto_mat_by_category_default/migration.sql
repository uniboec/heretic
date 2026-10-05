-- BY_CATEGORY + marker enabled are the product defaults for new and existing installs.
ALTER TABLE "BoutsPageSetting"
  ALTER COLUMN "autoMatByCategoryEnabled" SET DEFAULT true;

UPDATE "BoutsPageSetting"
SET
  "autoMatAssignMode" = 'BY_CATEGORY',
  "autoMatByCategoryEnabled" = true
WHERE id = 'default';
