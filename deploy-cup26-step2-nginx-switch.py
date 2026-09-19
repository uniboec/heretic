#!/usr/bin/env python3
"""STEP 2: Nginx static switch to persistent shared directory."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import paramiko

STAGING = "159.194.210.165"
OUT = Path(__file__).parent / "deploy-cup26-step2-nginx-switch-result.json"

REMOTE = r"""
set -euo pipefail

APP_DIR=/opt/cup-survey
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
MANIFEST=/opt/cup-survey-shared/static-deploy-manifest.json
CURRENT_SITE=/etc/nginx/sites-available/cup26.mma66.ru
CANDIDATE="${APP_DIR}/deploy/nginx-cup26.mma66.ru.conf"
ASSETS_ENV=/tmp/cup-survey-phase1-assets.env
STEP2_FAIL=0
ROLLBACK_DONE=0
BACKUP=""
NGINX_RELOADED=0

rollback_nginx() {
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    cp -a "$BACKUP" "$CURRENT_SITE"
    nginx -t || { echo "CRITICAL: restored nginx config does not validate"; exit 99; }
    systemctl reload nginx
    ROLLBACK_DONE=1
    echo "ROLLBACK_DONE=YES"
  fi
}

fail_step2() {
  local reason="$1"
  echo "STEP2_FAIL_REASON=${reason}"
  if [[ "$NGINX_RELOADED" == "1" ]]; then
    rollback_nginx
  fi
  exit 1
}

cd "$APP_DIR"
source "$ASSETS_ENV"

DISK_BEFORE_AVAIL="$(df -B1 / | awk 'NR==2 {print $4}')"
echo "DISK_BEFORE_AVAIL_B=${DISK_BEFORE_AVAIL}"
df -h /

echo '=== 0 PRECHECK ==='
RUNNING_CID="$(docker compose -f "$COMPOSE_FILE" ps -q app | head -1)"
[[ -n "$RUNNING_CID" ]] || fail_step2 "running app missing"
RUNNING_IMAGE_ID="$(docker inspect "$RUNNING_CID" --format '{{.Image}}')"
CURRENT_TAG_ID="$(docker image inspect cup-survey-app:current --format '{{.Id}}')"
MANIFEST_IMAGE_ID="$(python3 - <<'PY'
import sys
sys.path.insert(0, "/opt/cup-survey/deploy")
from static_manifest import get_current_deploy, load_manifest
c = get_current_deploy(load_manifest("/opt/cup-survey-shared/static-deploy-manifest.json"))
print(c["image_id"])
PY
)"
echo "RUNNING_CID=${RUNNING_CID}"
echo "RUNNING_IMAGE_ID=${RUNNING_IMAGE_ID}"
echo "CURRENT_TAG_ID=${CURRENT_TAG_ID}"
echo "MANIFEST_IMAGE_ID=${MANIFEST_IMAGE_ID}"

if [[ "$MANIFEST_IMAGE_ID" == "$CURRENT_TAG_ID" && "$CURRENT_TAG_ID" == "$RUNNING_IMAGE_ID" ]]; then
  echo "THREE_WAY_IDENTITY=PASS"
else
  echo "THREE_WAY_IDENTITY=FAIL"
  fail_step2 "three-way image identity mismatch"
fi

echo '=== 1 VERIFY CURRENT ASSETS ==='
CSS_REL="${CURRENT_CSS#/_next/static/}"
JS_REL="${CURRENT_JS#/_next/static/}"
echo "CSS_REL=${CSS_REL}"
echo "JS_REL=${JS_REL}"
test -f "/opt/cup-survey-shared/_next/static/$CSS_REL" || fail_step2 "shared CSS missing"
test -f "/opt/cup-survey-shared/_next/static/$JS_REL" || fail_step2 "shared JS missing"
SHARED_CSS_SHA="$(sha256sum "/opt/cup-survey-shared/_next/static/$CSS_REL" | awk '{print $1}')"
SHARED_JS_SHA="$(sha256sum "/opt/cup-survey-shared/_next/static/$JS_REL" | awk '{print $1}')"
echo "SHARED_CSS_SHA256=${SHARED_CSS_SHA}"
echo "SHARED_JS_SHA256=${SHARED_JS_SHA}"

echo '--- BEFORE CSS headers ---'
CSS_BEFORE="$(curl -fsSI --max-time 20 "https://cup26.mma66.ru${CURRENT_CSS}")"
echo "$CSS_BEFORE"
echo '--- BEFORE JS headers ---'
JS_BEFORE="$(curl -fsSI --max-time 20 "https://cup26.mma66.ru${CURRENT_JS}")"
echo "$JS_BEFORE"
echo "$CSS_BEFORE" | grep -qi "HTTP/.* 200" || fail_step2 "CSS before switch not 200"
echo "$JS_BEFORE" | grep -qi "HTTP/.* 200" || fail_step2 "JS before switch not 200"
CSS_BEFORE_STATUS="$(echo "$CSS_BEFORE" | head -1)"
JS_BEFORE_STATUS="$(echo "$JS_BEFORE" | head -1)"
CSS_BEFORE_CT="$(echo "$CSS_BEFORE" | grep -i '^content-type:' | head -1 || true)"
JS_BEFORE_CT="$(echo "$JS_BEFORE" | grep -i '^content-type:' | head -1 || true)"
CSS_BEFORE_CC="$(echo "$CSS_BEFORE" | grep -i '^cache-control:' | head -1 || true)"
JS_BEFORE_CC="$(echo "$JS_BEFORE" | grep -i '^cache-control:' | head -1 || true)"
echo "CSS_BEFORE_STATUS=${CSS_BEFORE_STATUS}"
echo "JS_BEFORE_STATUS=${JS_BEFORE_STATUS}"
echo "CSS_BEFORE_CT=${CSS_BEFORE_CT}"
echo "JS_BEFORE_CT=${JS_BEFORE_CT}"
echo "CSS_BEFORE_CC=${CSS_BEFORE_CC}"
echo "JS_BEFORE_CC=${JS_BEFORE_CC}"

echo '=== 2 NGINX FILE PERMISSIONS ==='
namei -l "/opt/cup-survey-shared/_next/static/$CSS_REL"
namei -l "/opt/cup-survey-shared/_next/static/$JS_REL"
ps -eo user,group,comm | grep '[n]ginx' || true
NGINX_USER="$(ps -eo user=,comm= | awk '$2=="nginx" {print $1; exit}')"
if [[ -z "$NGINX_USER" ]]; then
  NGINX_USER="$(awk '/^user / {print $2; exit}' /etc/nginx/nginx.conf | tr -d ';')"
fi
[[ -n "$NGINX_USER" ]] || fail_step2 "cannot determine nginx worker user"
echo "NGINX_USER=${NGINX_USER}"
sudo -u "$NGINX_USER" test -r "/opt/cup-survey-shared/_next/static/$CSS_REL" || fail_step2 "nginx cannot read CSS"
sudo -u "$NGINX_USER" test -r "/opt/cup-survey-shared/_next/static/$JS_REL" || fail_step2 "nginx cannot read JS"
echo "NGINX_FS_ACCESS=PASS"

echo '=== 3 REVIEW CURRENT VS CANDIDATE NGINX CONFIG ==='
test -f "$CURRENT_SITE" || fail_step2 "live nginx config missing"
test -f "$CANDIDATE" || fail_step2 "candidate nginx config missing"
echo '--- diff -u live vs candidate ---'
DIFF_OUT="$(diff -u "$CURRENT_SITE" "$CANDIDATE" || true)"
echo "$DIFF_OUT"

PATCHED_CONFIG="$(mktemp /tmp/cup26-nginx-patched.XXXXXX)"
python3 - <<'PY' "$CURRENT_SITE" "$PATCHED_CONFIG"
import re
import sys

live_path, out_path = sys.argv[1], sys.argv[2]
text = open(live_path, encoding="utf-8").read()

static_block = '''    location /_next/static/ {
        alias /opt/cup-survey-shared/_next/static/;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
'''

pattern = re.compile(
    r"[ \t]*location\s+/_next/static/\s*\{.*?\n[ \t]*\}\n?",
    re.DOTALL,
)

if pattern.search(text):
    text = pattern.sub(static_block.rstrip() + "\n", text, count=1)
else:
    loc_root = re.search(r"^([ \t]*)location\s+/\s*\{", text, re.MULTILINE)
    if not loc_root:
        sys.exit("cannot find location / block in live config")
    insert_at = loc_root.start()
    text = text[:insert_at] + static_block.rstrip() + "\n" + text[insert_at:]

open(out_path, "w", encoding="utf-8").write(text)
print("patched config written")
PY

echo '--- diff -u live vs patched (expected: static location only) ---'
PATCH_DIFF="$(diff -u "$CURRENT_SITE" "$PATCHED_CONFIG" || true)"
echo "$PATCH_DIFF"

STATIC_ONLY_RESULT="$(python3 - <<'PY' "$CURRENT_SITE" "$PATCHED_CONFIG"
import re
import sys

live_path, patched_path = sys.argv[1], sys.argv[2]
live = open(live_path, encoding="utf-8").read()
patched = open(patched_path, encoding="utf-8").read()
static_re = re.compile(
    r"[ \t]*location\s+/_next/static/\s*\{.*?\n[ \t]*\}\s*",
    re.DOTALL,
)

def without_static(text: str) -> str:
    return static_re.sub("", text, count=1)

static_match = static_re.search(patched)
if not static_match:
    print("STATIC_ONLY_CHANGE=NO")
    print("UNEXPECTED_CHANGES=patched config missing static location")
    sys.exit(0)
static_body = static_match.group(0)
required = [
    "alias /opt/cup-survey-shared/_next/static/",
    'add_header Cache-Control "public, max-age=31536000, immutable"',
    "access_log off",
]
for needle in required:
    if needle not in static_body:
        print("STATIC_ONLY_CHANGE=NO")
        print(f"UNEXPECTED_CHANGES=static block missing {needle}")
        sys.exit(0)
if " always" in static_body or "proxy_pass" in static_body:
    print("STATIC_ONLY_CHANGE=NO")
    print("UNEXPECTED_CHANGES=static block still proxies or uses always")
    sys.exit(0)

if without_static(live) == without_static(patched):
    print("STATIC_ONLY_CHANGE=YES")
    print("UNEXPECTED_CHANGES=NONE")
else:
    print("STATIC_ONLY_CHANGE=NO")
    print("UNEXPECTED_CHANGES=non-static sections differ after patch")
PY
)"
echo "$STATIC_ONLY_RESULT"
eval "$(echo "$STATIC_ONLY_RESULT" | grep -E '^(STATIC_ONLY_CHANGE|UNEXPECTED_CHANGES)=')"

if [[ "${STATIC_ONLY_CHANGE:-NO}" != "YES" ]]; then
  fail_step2 "unexpected nginx diff changes"
fi

APPROVED_CONFIG="$PATCHED_CONFIG"
echo "APPROVED_CONFIG_SOURCE=live_patched"

echo '=== 5 BACKUP LIVE NGINX CONFIG ==='
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="${CURRENT_SITE}.pre-static-retention-${STAMP}"
cp -a "$CURRENT_SITE" "$BACKUP"
test -s "$BACKUP"
ls -l "$BACKUP"
echo "BACKUP_PATH=${BACKUP}"

echo '=== 6 INSTALL MINIMAL NGINX CHANGE ==='
cp -a "$APPROVED_CONFIG" "$CURRENT_SITE"
if ! nginx -t 2>&1 | tee /tmp/nginx-t-test.log; then
  cp -a "$BACKUP" "$CURRENT_SITE"
  nginx -t || { echo "CRITICAL: restored nginx config does not validate"; exit 99; }
  fail_step2 "nginx -t failed on candidate"
fi
echo "NGINX_T=PASS"

echo '=== 7 RELOAD ==='
systemctl reload nginx
NGINX_RELOADED=1
systemctl is-active nginx
echo "NGINX_ACTIVE=$(systemctl is-active nginx)"

echo '=== 8 PUBLIC STATIC VERIFICATION ==='
CSS_AFTER="$(curl -fsSI --max-time 20 "https://cup26.mma66.ru${CURRENT_CSS}")"
JS_AFTER="$(curl -fsSI --max-time 20 "https://cup26.mma66.ru${CURRENT_JS}")"
echo '--- AFTER CSS ---'
echo "$CSS_AFTER"
echo '--- AFTER JS ---'
echo "$JS_AFTER"

CSS_STATUS="$(echo "$CSS_AFTER" | head -1)"
JS_STATUS="$(echo "$JS_AFTER" | head -1)"
CSS_CT="$(echo "$CSS_AFTER" | grep -i '^content-type:' | head -1 || true)"
JS_CT="$(echo "$JS_AFTER" | grep -i '^content-type:' | head -1 || true)"
CSS_CC="$(echo "$CSS_AFTER" | grep -i '^cache-control:' | head -1 || true)"
JS_CC="$(echo "$JS_AFTER" | grep -i '^cache-control:' | head -1 || true)"
echo "CSS_STATUS=${CSS_STATUS}"
echo "JS_STATUS=${JS_STATUS}"
echo "CSS_CT=${CSS_CT}"
echo "JS_CT=${JS_CT}"
echo "CSS_CC=${CSS_CC}"
echo "JS_CC=${JS_CC}"

POST_VERIFY_FAIL=0
echo "$CSS_AFTER" | grep -qi "HTTP/.* 200" || POST_VERIFY_FAIL=1
echo "$CSS_AFTER" | grep -qi "content-type:.*text/css" || POST_VERIFY_FAIL=1
echo "$CSS_AFTER" | grep -qi "cache-control:.*public" || POST_VERIFY_FAIL=1
echo "$CSS_AFTER" | grep -qi "max-age=31536000" || POST_VERIFY_FAIL=1
echo "$CSS_AFTER" | grep -qi "immutable" || POST_VERIFY_FAIL=1
echo "$JS_AFTER" | grep -qi "HTTP/.* 200" || POST_VERIFY_FAIL=1
echo "$JS_AFTER" | grep -Eqi "content-type:.*(javascript|ecmascript)" || POST_VERIFY_FAIL=1
echo "$JS_AFTER" | grep -qi "cache-control:.*public" || POST_VERIFY_FAIL=1
echo "$JS_AFTER" | grep -qi "max-age=31536000" || POST_VERIFY_FAIL=1
echo "$JS_AFTER" | grep -qi "immutable" || POST_VERIFY_FAIL=1
[[ "$POST_VERIFY_FAIL" == "0" ]] || fail_step2 "public static header verification failed"

echo '=== 9 404 TEST ==='
MISSING_URL="https://cup26.mma66.ru/_next/static/chunks/definitely-missing-phase1-test.css"
MISSING_HEADERS="$(curl -sSI --max-time 20 "$MISSING_URL" || true)"
echo "$MISSING_HEADERS"
MISSING_STATUS="$(echo "$MISSING_HEADERS" | head -1)"
echo "MISSING_STATUS=${MISSING_STATUS}"
MISSING_IMMUTABLE=NO
MISSING_YEAR=NO
echo "$MISSING_HEADERS" | grep -qi "cache-control:.*immutable" && MISSING_IMMUTABLE=YES
echo "$MISSING_HEADERS" | grep -qi "max-age=31536000" && MISSING_YEAR=YES
echo "MISSING_IMMUTABLE=${MISSING_IMMUTABLE}"
echo "MISSING_YEAR_MAXAGE=${MISSING_YEAR}"
echo "$MISSING_HEADERS" | grep -qi "HTTP/.* 404" || fail_step2 "missing asset not 404"
[[ "$MISSING_IMMUTABLE" == "NO" && "$MISSING_YEAR" == "NO" ]] || fail_step2 "missing asset has immutable/year cache"

echo '=== 10 CONTENT HASH AFTER SWITCH ==='
TMP_CSS="$(mktemp)"
TMP_JS="$(mktemp)"
curl -fsS --max-time 20 "https://cup26.mma66.ru${CURRENT_CSS}" -o "$TMP_CSS"
curl -fsS --max-time 20 "https://cup26.mma66.ru${CURRENT_JS}" -o "$TMP_JS"
PUBLIC_CSS_SHA="$(sha256sum "$TMP_CSS" | awk '{print $1}')"
PUBLIC_JS_SHA="$(sha256sum "$TMP_JS" | awk '{print $1}')"
rm -f "$TMP_CSS" "$TMP_JS"
echo "PUBLIC_CSS_SHA256=${PUBLIC_CSS_SHA}"
echo "PUBLIC_JS_SHA256=${PUBLIC_JS_SHA}"
if [[ "$PUBLIC_CSS_SHA" == "$SHARED_CSS_SHA" ]]; then
  echo "CSS_HASH_MATCH=YES"
else
  echo "CSS_HASH_MATCH=NO"
  fail_step2 "public CSS hash mismatch"
fi
if [[ "$PUBLIC_JS_SHA" == "$SHARED_JS_SHA" ]]; then
  echo "JS_HASH_MATCH=YES"
else
  echo "JS_HASH_MATCH=NO"
  fail_step2 "public JS hash mismatch"
fi

echo '=== 11 APPLICATION HEALTH ==='
curl -fsS --max-time 20 https://cup26.mma66.ru/ >/dev/null
echo "PUBLIC_ROOT_OK=YES"
curl -fsSI --max-time 20 https://cup26.mma66.ru/admin | head -10
echo "PUBLIC_ADMIN_OK=YES"
curl -fsS --max-time 20 http://127.0.0.1:3001/ >/dev/null
echo "LOCAL_HTTP_OK=YES"
docker compose -f "$COMPOSE_FILE" ps
RUNNING_CID_AFTER="$(docker compose -f "$COMPOSE_FILE" ps -q app | head -1)"
RUNNING_IMAGE_AFTER="$(docker inspect "$RUNNING_CID_AFTER" --format '{{.Image}}')"
echo "RUNNING_CID_AFTER=${RUNNING_CID_AFTER}"
echo "RUNNING_IMAGE_AFTER=${RUNNING_IMAGE_AFTER}"
if [[ "$RUNNING_CID_AFTER" == "$RUNNING_CID" && "$RUNNING_IMAGE_AFTER" == "$RUNNING_IMAGE_ID" ]]; then
  echo "CONTAINER_UNCHANGED=YES"
else
  echo "CONTAINER_UNCHANGED=NO"
  fail_step2 "container changed unexpectedly"
fi

echo '=== 13 DISK AFTER ==='
DISK_AFTER_AVAIL="$(df -B1 / | awk 'NR==2 {print $4}')"
df -h /
echo "DISK_AFTER_AVAIL_B=${DISK_AFTER_AVAIL}"
echo "STEP2_PASS=YES"
echo "GATE=READY FOR STEP 3 PRE-BUILD GATE"
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
        if "=" in line and not line.startswith("===") and not line.startswith("---"):
            k, v = line.split("=", 1)
            if k.strip() and " " not in k.strip():
                kv[k.strip()] = v.strip()
    return kv


def main() -> int:
    pwd = read_pwd()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(STAGING, username="root", password=pwd, timeout=60, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=300)
    out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    client.close()

    kv = parse_kv(out)
    step2_pass = (
        exit_code == 0
        and kv.get("STEP2_PASS") == "YES"
        and kv.get("THREE_WAY_IDENTITY") == "PASS"
        and kv.get("NGINX_FS_ACCESS") == "PASS"
        and kv.get("STATIC_ONLY_CHANGE") == "YES"
        and kv.get("NGINX_T") == "PASS"
        and kv.get("CSS_HASH_MATCH") == "YES"
        and kv.get("JS_HASH_MATCH") == "YES"
        and kv.get("CONTAINER_UNCHANGED") == "YES"
        and kv.get("MISSING_IMMUTABLE") == "NO"
        and kv.get("MISSING_YEAR_MAXAGE") == "NO"
    )

    result = {
        "exit_code": exit_code,
        "step2_pass": step2_pass,
        "rolled_back": kv.get("ROLLBACK_DONE") == "YES",
        "fail_reason": kv.get("STEP2_FAIL_REASON", ""),
        "kv": kv,
        "raw_output": out,
    }
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(out)
    print("\n=== STEP 2 SUMMARY ===")
    print(json.dumps({k: v for k, v in result.items() if k != "raw_output"}, indent=2))
    if step2_pass:
        print("GATE: READY FOR STEP 3 PRE-BUILD GATE")
    elif result["rolled_back"]:
        print(f"GATE: ROLLED BACK — {kv.get('STEP2_FAIL_REASON', 'unknown')}")
    else:
        print(f"GATE: STOPPED — {kv.get('STEP2_FAIL_REASON', 'unknown')}")
    return 0 if step2_pass else 1


if __name__ == "__main__":
    sys.exit(main())
