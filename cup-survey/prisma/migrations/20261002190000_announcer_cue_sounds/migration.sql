-- Per-event cue override + replace legacy built-in cue ids
ALTER TABLE "AnnouncerRule" ADD COLUMN "cueSoundId" TEXT;

UPDATE "AnnouncerSetting"
SET "boutCueSoundId" = 'universfield-032'
WHERE "boutCueSoundId" IN ('bout-two-tone', 'sporty', 'short-single');

UPDATE "AnnouncerSetting"
SET "awardCueSoundId" = 'chime-01'
WHERE "awardCueSoundId" IN ('award-three-tone', 'soft-chime');

ALTER TABLE "AnnouncerSetting" ALTER COLUMN "boutCueSoundId" SET DEFAULT 'universfield-032';
ALTER TABLE "AnnouncerSetting" ALTER COLUMN "awardCueSoundId" SET DEFAULT 'chime-01';
