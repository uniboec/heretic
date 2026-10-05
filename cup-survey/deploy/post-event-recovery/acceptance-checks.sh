#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://cup26.mma66.ru}"
PHASE="${ACCEPTANCE_PHASE:-A}"

echo "acceptance-checks: phase=$PHASE"

if [[ "$PHASE" == "A" || "$PHASE" == "D" ]]; then
  results="$(curl -fsS "$BASE_URL/api/tournament/results")"
  python3 - <<'PY' "$results"
import json, sys
data = json.loads(sys.argv[1])
stats = data.get("stats") or {}
medalists = stats.get("medalists")
categories = stats.get("categoriesWithResults")
print(f"results medalists={medalists} categoriesWithResults={categories}")
assert medalists == 76, medalists
assert categories == 32, categories
PY

  brackets="$(curl -fsS "$BASE_URL/api/tournament/brackets")"
  python3 - <<'PY' "$brackets"
import json, sys
data = json.loads(sys.argv[1])
categories = data.get("categories") or []
active = sum(1 for c in categories if (c.get("result") or {}).get("status") != "complete")
completed = sum(1 for c in categories if (c.get("result") or {}).get("status") == "complete")
three_way_incomplete = [
  c["categoryKey"]
  for c in categories
  if c.get("systemId") == "three_way" and (c.get("result") or {}).get("status") != "complete"
]
print(f"brackets active={active} completed={completed} three_way_incomplete={len(three_way_incomplete)}")
assert active == 0, active
assert completed == 32, completed
assert len(three_way_incomplete) == 0, three_way_incomplete
PY
fi

if [[ "$PHASE" == "B" || "$PHASE" == "D" ]]; then
  if [[ -x "$(dirname "$0")/acceptance-b-probe.sh" ]]; then
    "$(dirname "$0")/acceptance-b-probe.sh"
  else
    echo "WARN: acceptance-b-probe.sh missing — run scripts/acceptance-b-probe-once.ts on prod"
  fi
fi

if [[ "$PHASE" == "C" || "$PHASE" == "D" ]]; then
  rankings="$(curl -fsS "$BASE_URL/api/tournament/team-rankings")"
  python3 - <<'PY' "$rankings"
import json, sys
data = json.loads(sys.argv[1])
print("rankingStatus=", data.get("rankingStatus"))
assert data.get("rankingStatus") == "complete"
rows = data.get("rows") or []
thirds = sum(int(r.get("thirdPlaces") or 0) for r in rows)
print("sum(thirdPlaces)=", thirds)
assert thirds == 16, thirds
PY
fi

echo "acceptance-checks: OK"
