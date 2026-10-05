-- Add name parts
ALTER TABLE "Athlete" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Athlete" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Athlete" ADD COLUMN "middleName" TEXT;

-- Backfill from fullName (Фамилия Имя Отчество)
UPDATE "Athlete"
SET
  "lastName" = split_part(trim("fullName"), ' ', 1),
  "firstName" = CASE
    WHEN strpos(trim("fullName"), ' ') = 0 THEN split_part(trim("fullName"), ' ', 1)
    ELSE split_part(trim("fullName"), ' ', 2)
  END,
  "middleName" = CASE
    WHEN array_length(string_to_array(trim("fullName"), ' '), 1) > 2 THEN trim(
      substring(
        trim("fullName")
        FROM length(split_part(trim("fullName"), ' ', 1))
          + length(split_part(trim("fullName"), ' ', 2))
          + 3
      )
    )
    ELSE NULL
  END
WHERE "lastName" IS NULL;

ALTER TABLE "Athlete" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "Athlete" ALTER COLUMN "firstName" SET NOT NULL;

ALTER TABLE "Athlete" DROP COLUMN "fullName";
