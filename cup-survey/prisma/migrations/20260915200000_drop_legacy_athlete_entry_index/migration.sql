-- Legacy unique index blocked multiple categories per discipline (age/weight).
-- It was created as INDEX, not CONSTRAINT, so the prior migration did not remove it.
DROP INDEX IF EXISTS "AthleteEntry_athleteId_discipline_key";
