-- CreateEnum
CREATE TYPE "SoloParticipantPointsMode" AS ENUM ('STANDARD', 'EXCLUDE', 'CUSTOM');

-- CreateTable
CREATE TABLE "TeamRankingSetting" (
    "tournamentScopeId" TEXT NOT NULL,
    "firstPlacePoints" INTEGER NOT NULL DEFAULT 5,
    "secondPlacePoints" INTEGER NOT NULL DEFAULT 3,
    "thirdPlacePoints" INTEGER NOT NULL DEFAULT 2,
    "soloParticipantPointsMode" "SoloParticipantPointsMode" NOT NULL DEFAULT 'STANDARD',
    "soloParticipantFirstPlacePoints" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRankingSetting_pkey" PRIMARY KEY ("tournamentScopeId")
);

ALTER TABLE "TeamRankingSetting"
ADD CONSTRAINT "TeamRankingSetting_points_check"
CHECK ("firstPlacePoints" >= 0 AND "secondPlacePoints" >= 0 AND "thirdPlacePoints" >= 0);

ALTER TABLE "TeamRankingSetting"
ADD CONSTRAINT "TeamRankingSetting_custom_check"
CHECK (
  ("soloParticipantPointsMode" != 'CUSTOM') OR
  ("soloParticipantFirstPlacePoints" IS NOT NULL AND "soloParticipantFirstPlacePoints" >= 0)
);

INSERT INTO "TeamRankingSetting" (
    "tournamentScopeId",
    "firstPlacePoints",
    "secondPlacePoints",
    "thirdPlacePoints",
    "soloParticipantPointsMode",
    "updatedAt"
)
VALUES ('cup-2026', 5, 3, 2, 'STANDARD', CURRENT_TIMESTAMP)
ON CONFLICT ("tournamentScopeId") DO NOTHING;
