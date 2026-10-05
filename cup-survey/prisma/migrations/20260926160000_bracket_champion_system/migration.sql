-- Champion system format rule for single-participant categories
INSERT INTO "BracketFormatRule" ("id", "minParticipants", "maxParticipants", "systemId", "defaultBronzeMode", "allowedSystemIds", "sortOrder", "enabled", "updatedAt")
VALUES (gen_random_uuid()::text, 1, 1, 'champion', NULL, ARRAY['champion'], -1, true, CURRENT_TIMESTAMP);
