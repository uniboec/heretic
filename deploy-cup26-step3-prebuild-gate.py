#!/usr/bin/env python3
"""STEP 3 Pre-Build Gate — read-only production checks + disk analysis."""
from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

import paramiko

STAGING = "159.194.210.165"
OUT = Path(__file__).parent / "deploy-cup26-step3-prebuild-gate-result.json"
LOCAL_CUP = Path(__file__).parent / "cup-survey"

PARITY_FILES = [
    "deploy/static_manifest.py",
    "deploy/write-merge-metadata.py",
    "deploy/merge-static-assets.sh",
    "deploy/release-app.sh",
    "deploy/prevalidate-production-state.sh",
    "deploy/verify-public-static.sh",
    "docker-compose.prod.yml",
]

REMOTE = r"""
set -euo pipefail

APP_DIR=/opt/cup-survey
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
MANIFEST=/opt/cup-survey-shared/static-deploy-manifest.json
ASSETS_ENV=/tmp/cup-survey-phase1-assets.env

echo "=== 0 STEP2 STATE ==="
systemctl is-active nginx
echo "NGINX_ACTIVE=$(systemctl is-active nginx)"

source "$ASSETS_ENV"
CSS_H="$(curl -fsSI --max-time 20 "https://cup26.mma66.ru${CURRENT_CSS}" | head -1)"
JS_H="$(curl -fsSI --max-time 20 "https://cup26.mma66.ru${CURRENT_JS}" | head -1)"
MISS_H="$(curl -sSI --max-time 20 "https://cup26.mma66.ru/_next/static/chunks/definitely-missing-phase1-test.css" || true)"
echo "CSS_PUBLIC=${CSS_H}"
echo "JS_PUBLIC=${JS_H}"
echo "MISSING_PUBLIC=${MISS_H}"
echo "$CSS_H" | grep -qi "200" && echo "CSS_200=YES" || echo "CSS_200=NO"
echo "$JS_H" | grep -qi "200" && echo "JS_200=YES" || echo "JS_200=NO"
echo "$MISS_H" | grep -qi "404" && echo "MISS_404=YES" || echo "MISS_404=NO"
echo "$MISS_H" | grep -qi "immutable" && echo "MISS_IMMUTABLE=YES" || echo "MISS_IMMUTABLE=NO"
echo "$MISS_H" | grep -qi "max-age=31536000" && echo "MISS_YEAR=YES" || echo "MISS_YEAR=NO"

RUNNING_CID="$(docker compose -f "$COMPOSE_FILE" ps -q app | head -1)"
RUNNING_IMAGE="$(docker inspect "$RUNNING_CID" --format '{{.Image}}')"
CURRENT_TAG="$(docker image inspect cup-survey-app:current --format '{{.Id}}')"
MANIFEST_ID="$(python3 - <<'PY'
import sys
sys.path.insert(0, "/opt/cup-survey/deploy")
from static_manifest import get_current_deploy, load_manifest
print(get_current_deploy(load_manifest("/opt/cup-survey-shared/static-deploy-manifest.json"))["image_id"])
PY
)"
echo "RUNNING_CID=${RUNNING_CID}"
echo "RUNNING_IMAGE=${RUNNING_IMAGE}"
echo "CURRENT_TAG=${CURRENT_TAG}"
echo "MANIFEST_ID=${MANIFEST_ID}"
if [[ "$MANIFEST_ID" == "$CURRENT_TAG" && "$CURRENT_TAG" == "$RUNNING_IMAGE" ]]; then
  echo "THREE_WAY=PASS"
else
  echo "THREE_WAY=FAIL"
fi

docker compose -f "$COMPOSE_FILE" ps
docker inspect cup-survey-postgres-1 --format 'POSTGRES={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true

echo "=== LIVE NGINX STATIC BLOCK ==="
python3 - <<'PY'
import re
text = open("/etc/nginx/sites-available/cup26.mma66.ru", encoding="utf-8").read()
m = re.search(r"location\s+/_next/static/\s*\{.*?\n\s*\}", text, re.DOTALL)
print(m.group(0) if m else "MISSING_STATIC_BLOCK")
PY

echo "=== 5 VPS SHA256 PARITY ==="
for f in deploy/static_manifest.py deploy/write-merge-metadata.py deploy/merge-static-assets.sh deploy/release-app.sh deploy/prevalidate-production-state.sh deploy/verify-public-static.sh docker-compose.prod.yml; do
  if [[ -f "${APP_DIR}/${f}" ]]; then
    sha256sum "${APP_DIR}/${f}" | awk -v f="$f" '{print "VPS_SHA|" f "|" $1}'
  else
    echo "VPS_SHA|${f}|MISSING"
  fi
done

echo "=== 6 PREVALIDATION ==="
cd "$APP_DIR"
./deploy/prevalidate-production-state.sh

echo "=== 7 DISK SNAPSHOT A ==="
date -u +%Y-%m-%dT%H:%M:%SZ
df -B1 /
df -h /
df -i /
DISK_A_AVAIL="$(df -B1 / | awk 'NR==2 {print $4}')"
DISK_A_TOTAL="$(df -B1 / | awk 'NR==2 {print $2}')"
DISK_A_USED="$(df -B1 / | awk 'NR==2 {print $3}')"
echo "DISK_A_AVAIL_B=${DISK_A_AVAIL}"
echo "DISK_A_TOTAL_B=${DISK_A_TOTAL}"
echo "DISK_A_USED_B=${DISK_A_USED}"

docker system df
echo "--- docker system df -v ---"
docker system df -v 2>/dev/null | head -120
echo "--- builder du ---"
docker builder du 2>/dev/null || true

du -sh /var/lib/docker 2>/dev/null || true
du -sh /root/www 2>/dev/null || true
du -sh /root/.npm 2>/dev/null || true
du -sh /tmp 2>/dev/null || true

echo "=== 8 CONCURRENT DOCKER ==="
pgrep -af 'docker (build|buildx|pull|load|save|import|export)|p0-docker-export' || echo "NO_PGREP_MATCH"
ps auxww | grep -E '[d]ocker (build|buildx|pull|load|save|import|export)' || echo "NO_PS_MATCH"
docker ps --size
if [[ -d /tmp/p0-docker-export ]]; then
  du -sh /tmp/p0-docker-export
  lsof +D /tmp/p0-docker-export 2>/dev/null | head -20 || true
else
  echo "P0_EXPORT_DIR=absent"
fi

echo "=== 9 WAIT 3 MINUTES ==="
sleep 180

echo "=== 9 DISK SNAPSHOT B ==="
date -u +%Y-%m-%dT%H:%M:%SZ
DISK_B_AVAIL="$(df -B1 / | awk 'NR==2 {print $4}')"
echo "DISK_B_AVAIL_B=${DISK_B_AVAIL}"
DELTA=$((DISK_A_AVAIL - DISK_B_AVAIL))
echo "DISK_3MIN_DELTA_B=${DELTA}"
docker system df

echo "=== 10 BUILD INPUT ==="
du -sh "$APP_DIR"
test -f "$APP_DIR/.dockerignore" && echo "--- .dockerignore ---" && head -40 "$APP_DIR/.dockerignore" || echo "NO_DOCKERIGNORE"
docker image inspect cup-survey-app:current --format 'CURRENT_IMAGE_SIZE={{.Size}} ID={{.Id}}'
docker history cup-survey-app:current --no-trunc | head -20

echo "=== 12 SAFE CANDIDATES INVENTORY ==="
echo "--- stopped containers ---"
docker ps -a --filter status=exited --format '{{.ID}} {{.Names}} {{.Size}}' | head -30
echo "--- dangling images ---"
docker images -f dangling=true --format '{{.ID}} {{.Size}}' | head -20
echo "--- unused images (not cup-survey, not postgres) ---"
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}' | grep -vE 'cup-survey|postgres' | head -30
echo "--- build cache detail ---"
docker builder du --verbose 2>/dev/null | head -40 || docker builder du 2>/dev/null | head -20
echo "GATE_SCRIPT_DONE=YES"
"""


def read_pwd() -> str:
    data: dict[str, str] = {}
    for line in Path(r"c:\project fightcrm.ru\scripts\deploy.local.env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    return data["STAGING_DEPLOY_SSH_PASSWORD"]


def local_sha(rel: str) -> str:
    p = LOCAL_CUP / rel.replace("deploy/", "deploy/").lstrip("/")
    if not p.exists():
        p = LOCAL_CUP / rel
    if not p.exists():
        return "MISSING"
    return hashlib.sha256(p.read_bytes()).hexdigest()


def parse_kv(output: str) -> dict[str, str]:
    kv: dict[str, str] = {}
    for line in output.splitlines():
        if line.startswith("VPS_SHA|"):
            parts = line.split("|", 2)
            if len(parts) == 3:
                kv[f"VPS_SHA_{parts[1].replace('/', '_')}"] = parts[2]
        elif "=" in line and not line.startswith("===") and not line.startswith("---"):
            k, v = line.split("=", 1)
            if k.strip() and " " not in k.strip() and not k.startswith(" "):
                kv[k.strip()] = v.strip()
    return kv


def main() -> int:
    pwd = read_pwd()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(STAGING, username="root", password=pwd, timeout=60, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=600)
    out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    client.close()

    kv = parse_kv(out)
    parity: list[dict[str, str]] = []
    for rel in PARITY_FILES:
        key = rel.replace("/", "_")
        parity.append({
            "file": rel,
            "local_sha": local_sha(rel),
            "vps_sha": kv.get(f"VPS_SHA_{key}", "unknown"),
            "match": "YES" if local_sha(rel) == kv.get(f"VPS_SHA_{key}") else "NO",
        })

    result = {
        "exit_code": exit_code,
        "kv": kv,
        "parity": parity,
        "raw_output": out,
    }
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(out[-12000:])
    print("\n=== PARITY ===")
    for row in parity:
        print(f"{row['file']}: local={row['local_sha'][:12]} vps={row['vps_sha'][:12]} match={row['match']}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
