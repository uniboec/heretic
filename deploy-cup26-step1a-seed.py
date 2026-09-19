#!/usr/bin/env python3
"""STEP 1A: One-time current image tag seed + three-way verify."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import paramiko

STAGING = "159.194.210.165"
OUT = Path(__file__).parent / "deploy-cup26-step1a-seed-result.json"

REMOTE = r"""
set -euo pipefail

APP_DIR=/opt/cup-survey
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
MANIFEST=/opt/cup-survey-shared/static-deploy-manifest.json

cd "$APP_DIR"

DISK_BEFORE_AVAIL="$(df -B1 / | awk 'NR==2 {print $4}')"
echo "DISK_BEFORE_AVAIL_B=${DISK_BEFORE_AVAIL}"

echo '=== 0 PRECHECK ==='
RUNNING_CID_BEFORE="$(docker compose -f "$COMPOSE_FILE" ps -q app | head -1)"
[[ -n "$RUNNING_CID_BEFORE" ]] || { echo "ABORT: running app missing"; exit 1; }
RUNNING_IMAGE_ID="$(docker inspect "$RUNNING_CID_BEFORE" --format '{{.Image}}')"
echo "RUNNING_CID_BEFORE=${RUNNING_CID_BEFORE}"
echo "RUNNING_IMAGE_ID=${RUNNING_IMAGE_ID}"

MANIFEST_CURRENT_IMAGE_ID="$(python3 - <<'PY'
import sys
sys.path.insert(0, "/opt/cup-survey/deploy")
from static_manifest import get_current_deploy, load_manifest
c = get_current_deploy(load_manifest("/opt/cup-survey-shared/static-deploy-manifest.json"))
print(c["image_id"])
PY
)"
echo "MANIFEST_CURRENT_IMAGE_ID=${MANIFEST_CURRENT_IMAGE_ID}"

if [[ "$MANIFEST_CURRENT_IMAGE_ID" != "$RUNNING_IMAGE_ID" ]]; then
  echo "ABORT: manifest image_id != running image_id"
  exit 1
fi

echo '=== 1 EXISTING :current TAG ==='
SEED_ACTION=create
if docker image inspect cup-survey-app:current >/dev/null 2>&1; then
  CURRENT_TAG_ID="$(docker image inspect cup-survey-app:current --format '{{.Id}}')"
  echo "EXISTING_CURRENT_TAG_ID=${CURRENT_TAG_ID}"
  if [[ "$CURRENT_TAG_ID" != "$RUNNING_IMAGE_ID" ]]; then
    echo "ABORT: existing :current tag points to different image"
    exit 2
  fi
  echo "SEED_ACTION=already_exists_noop_expected"
  SEED_ACTION=already_exists
else
  echo "CURRENT_TAG_STATE=absent"
fi

echo '=== 2 RUN SEED ==='
./deploy/seed-current-image-tag.sh
echo "SEED_EXIT=0"

echo '=== 3 THREE-WAY VERIFY ==='
MANIFEST_CURRENT_IMAGE_ID_AFTER="$(python3 - <<'PY'
import sys
sys.path.insert(0, "/opt/cup-survey/deploy")
from static_manifest import get_current_deploy, load_manifest
c = get_current_deploy(load_manifest("/opt/cup-survey-shared/static-deploy-manifest.json"))
print(c["image_id"])
PY
)"
CURRENT_TAG_IMAGE_ID="$(docker image inspect cup-survey-app:current --format '{{.Id}}')"
RUNNING_IMAGE_ID_AFTER="$(docker inspect "$RUNNING_CID_BEFORE" --format '{{.Image}}')"

echo "MANIFEST_CURRENT_IMAGE_ID_AFTER=${MANIFEST_CURRENT_IMAGE_ID_AFTER}"
echo "CURRENT_TAG_IMAGE_ID=${CURRENT_TAG_IMAGE_ID}"
echo "RUNNING_IMAGE_ID_AFTER=${RUNNING_IMAGE_ID_AFTER}"

if [[ "$MANIFEST_CURRENT_IMAGE_ID_AFTER" == "$CURRENT_TAG_IMAGE_ID" && \
      "$CURRENT_TAG_IMAGE_ID" == "$RUNNING_IMAGE_ID_AFTER" ]]; then
  echo "THREE_WAY_EQUAL=YES"
else
  echo "THREE_WAY_EQUAL=NO"
  exit 3
fi

echo '=== 4 CONTAINER UNCHANGED ==='
RUNNING_CID_AFTER="$(docker compose -f "$COMPOSE_FILE" ps -q app | head -1)"
echo "RUNNING_CID_AFTER=${RUNNING_CID_AFTER}"
[[ "$RUNNING_CID_AFTER" == "$RUNNING_CID_BEFORE" ]] && echo "CID_UNCHANGED=YES" || { echo "CID_UNCHANGED=NO"; exit 4; }
CONTAINER_CONFIG_IMAGE="$(docker inspect "$RUNNING_CID_AFTER" --format '{{.Config.Image}}')"
echo "CONTAINER_CONFIG_IMAGE=${CONTAINER_CONFIG_IMAGE}"

echo '=== 5 TAGS ==='
docker image ls cup-survey-app --no-trunc

echo '=== 6 PRODUCTION HEALTH ==='
curl -fsS --max-time 20 http://127.0.0.1:3001/ >/dev/null
echo "LOCAL_HTTP_OK=YES"
curl -fsSI --max-time 20 https://cup26.mma66.ru/ | head -10
echo "PUBLIC_HTTP_OK=YES"
docker compose -f "$COMPOSE_FILE" ps
docker inspect cup-survey-postgres-1 --format 'postgres_status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true

echo '=== 7 DISK ==='
DISK_AFTER_AVAIL="$(df -B1 / | awk 'NR==2 {print $4}')"
df -h /
echo "DISK_AFTER_AVAIL_B=${DISK_AFTER_AVAIL}"
echo "SEED_ACTION_FINAL=${SEED_ACTION}"
"""


def read_pwd() -> str:
    data: dict[str, str] = {}
    for line in Path(r"c:\project fightcrm.ru\scripts\deploy.local.env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    return data["STAGING_DEPLOY_SSH_PASSWORD"]


def parse_kv(output: str) -> dict[str, str]:
    kv: dict[str, str] = {}
    for line in output.splitlines():
        if "=" in line and not line.startswith("==="):
            k, v = line.split("=", 1)
            kv[k.strip()] = v.strip()
    return kv


def main() -> int:
    pwd = read_pwd()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(STAGING, username="root", password=pwd, timeout=60, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=180)
    out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    client.close()

    kv = parse_kv(out)
    seed_pass = (
        exit_code == 0
        and kv.get("SEED_EXIT") == "0"
        and kv.get("THREE_WAY_EQUAL") == "YES"
        and kv.get("CID_UNCHANGED") == "YES"
        and kv.get("LOCAL_HTTP_OK") == "YES"
    )

    result = {
        "exit_code": exit_code,
        "seed_pass": seed_pass,
        "kv": kv,
        "raw_output": out,
    }
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(out)
    print("\n=== STEP 1A SUMMARY ===")
    print(json.dumps({k: v for k, v in result.items() if k != "raw_output"}, indent=2))
    print("GATE:", "READY FOR STEP 2 NGINX SWITCH" if seed_pass else "STOPPED")
    return 0 if seed_pass else 1


if __name__ == "__main__":
    sys.exit(main())
