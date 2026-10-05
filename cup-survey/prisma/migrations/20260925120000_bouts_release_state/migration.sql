-- Bouts release state on BracketPublicationState (v2.6)

ALTER TABLE "BracketPublicationState"
ADD COLUMN "boutsReleased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "boutMatAssignments" JSONB,
ADD COLUMN "matCountAtRelease" INTEGER;

-- Legacy: columns default to false/null; run scripts/backfill-bouts-release-state.ts after Phase-1 deploy.
