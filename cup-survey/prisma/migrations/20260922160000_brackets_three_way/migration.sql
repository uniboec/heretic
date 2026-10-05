-- Allow three-way system for categories with exactly 3 participants
UPDATE "BracketFormatRule"
SET "allowedSystemIds" = ARRAY['round_robin', 'three_way']
WHERE "minParticipants" = 3 AND "maxParticipants" = 3;
