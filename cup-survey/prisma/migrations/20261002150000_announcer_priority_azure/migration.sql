-- BOUT_RESULT must play before BOUT_CALL after bout confirmation.
UPDATE "AnnouncerRule"
SET priority = 110
WHERE "eventType" = 'BOUT_RESULT' AND priority < 110;

UPDATE "AnnouncerRule"
SET "includePlacement" = false,
    "includeCategory" = true
WHERE "eventType" = 'AWARD_PREPARE';

-- Azure as global default TTS provider (per-type rules keep bout/award voices).
UPDATE "AnnouncerSetting"
SET "primaryProvider" = 'azure',
    "primaryVoiceId" = COALESCE("primaryVoiceId", 'ru-RU-DmitryNeural'),
    "fallbackProvider1" = CASE
      WHEN "fallbackProvider1" IS NULL OR "fallbackProvider1" = 'azure' THEN 'yandex'
      ELSE "fallbackProvider1"
    END
WHERE "primaryProvider" = 'yandex';
