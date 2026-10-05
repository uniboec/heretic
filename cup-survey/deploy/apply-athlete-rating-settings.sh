#!/usr/bin/env bash
# Upsert athlete rating points/coefficients (cup-2026 fair-rating profile).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

SCOPE_ID="${TOURNAMENT_SCOPE_ID:-cup-2026}"
PG_CONTAINER="${CUP_POSTGRES_CONTAINER:-cup-survey-postgres-1}"

AGE_JSON='{"4-5":80,"6-7":85,"8-9":90,"10-11":94,"12-13":97,"14-15":100,"16-17":101,"18+":101}'

docker exec -i "${PG_CONTAINER}" psql -U cup_survey -d cup_survey -v ON_ERROR_STOP=1 <<SQL
INSERT INTO "AthleteRatingSetting" (
  "tournamentScopeId",
  "publicEnabled",
  "publicTopLimit",
  "firstPlacePoints",
  "secondPlacePoints",
  "thirdPlacePoints",
  "placeWithoutWinPercent",
  "pointsVictoryPoints",
  "clearAdvantageVictoryPoints",
  "submissionVictoryPoints",
  "chokeVictoryPoints",
  "injuryVictoryPoints",
  "dqVictoryPoints",
  "ageCoefficients",
  "updatedAt"
)
VALUES (
  '${SCOPE_ID}',
  true,
  10,
  40,
  14,
  7,
  3,
  30,
  34,
  40,
  40,
  14,
  6,
  '${AGE_JSON}'::jsonb,
  NOW()
)
ON CONFLICT ("tournamentScopeId") DO UPDATE SET
  "firstPlacePoints" = EXCLUDED."firstPlacePoints",
  "secondPlacePoints" = EXCLUDED."secondPlacePoints",
  "thirdPlacePoints" = EXCLUDED."thirdPlacePoints",
  "placeWithoutWinPercent" = EXCLUDED."placeWithoutWinPercent",
  "pointsVictoryPoints" = EXCLUDED."pointsVictoryPoints",
  "clearAdvantageVictoryPoints" = EXCLUDED."clearAdvantageVictoryPoints",
  "submissionVictoryPoints" = EXCLUDED."submissionVictoryPoints",
  "chokeVictoryPoints" = EXCLUDED."chokeVictoryPoints",
  "injuryVictoryPoints" = EXCLUDED."injuryVictoryPoints",
  "dqVictoryPoints" = EXCLUDED."dqVictoryPoints",
  "ageCoefficients" = EXCLUDED."ageCoefficients",
  "updatedAt" = NOW();
SQL

echo "apply-athlete-rating-settings: OK (${SCOPE_ID})"
