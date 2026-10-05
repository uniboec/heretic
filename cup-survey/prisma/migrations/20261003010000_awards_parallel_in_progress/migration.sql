-- Allow multiple award categories to be IN_PROGRESS at the same time.
DROP INDEX IF EXISTS "AwardCeremonyQueue_one_in_progress_per_scope";
