#!/usr/bin/env python3
"""STEP 0: Live read-only preflight on production VPS."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import paramiko

STAGING = "159.194.210.165"
OUT = Path(__file__).parent / "deploy-cup26-phase0-preflight-result.json"

PREFLIGHT_CMD = r"""
set +e
echo '=== df -h / ==='
df -h /
echo '=== df -i / ==='
df -i /
echo '=== docker system df ==='
docker system df 2>/dev/null || true
echo '=== docker ps ==='
docker ps --filter name=cup-survey --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
echo '=== docker images cup-survey-app ==='
docker images cup-survey-app -a --no-trunc --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedSince}} {{.Size}}'
echo '=== static size ==='
CID=$(docker ps -q --filter name=cup-survey-app | head -1)
if [ -n "$CID" ]; then docker exec "$CID" du -sh /app/.next/static 2>/dev/null; fi
echo '=== html assets ==='
HTML=$(curl -fsS --max-time 20 http://127.0.0.1:3001/ 2>/dev/null || true)
echo "$HTML" | grep -oE '/_next/static/chunks/[^"]+\.css' | head -1
echo "$HTML" | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1
"""


def read_pwd() -> str:
    data: dict[str, str] = {}
    for line in Path(r"c:\project fightcrm.ru\scripts\deploy.local.env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    return data["STAGING_DEPLOY_SSH_PASSWORD"]


def parse_df(output: str) -> dict[str, str]:
    info: dict[str, str] = {}
    for line in output.splitlines():
        if line.startswith("/dev/") or re.match(r"^/dev/", line) or " / " in line:
            parts = line.split()
            if len(parts) >= 5 and parts[-1] == "/":
                info["total"] = parts[1]
                info["used"] = parts[2]
                info["avail"] = parts[3]
                info["use_pct"] = parts[4]
    return info


def main() -> int:
    pwd = read_pwd()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(STAGING, username="root", password=pwd, timeout=45, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = client.exec_command(PREFLIGHT_CMD, timeout=90)
    out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    client.close()

    css_matches = re.findall(r"/_next/static/chunks/[^\s\"']+\.css", out)
    js_matches = re.findall(r"/_next/static/chunks/[^\s\"']+\.js", out)
    css = css_matches[0] if css_matches else ""
    js = js_matches[0] if js_matches else ""
    df_info = parse_df(out)

    free_pct = None
    if "use_pct" in df_info:
        try:
            free_pct = 100 - int(df_info["use_pct"].rstrip("%"))
        except ValueError:
            free_pct = None

    assets_env = ""
    if css and js:
        assets_env = (
            f"CURRENT_CSS={css}\nCURRENT_JS={js}\n"
            f"CAPTURED_AT={__import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}\n"
        )

    result = {
        "raw_output": out,
        "disk": df_info,
        "free_pct_estimate": free_pct,
        "current_css": css,
        "current_js": js,
        "phase1_assets_env": assets_env,
        "gate": "READY FOR STEP 1 BOOTSTRAP" if free_pct is not None and free_pct >= 15 and css and js else "STOPPED",
    }

    if assets_env:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(STAGING, username="root", password=read_pwd(), timeout=45, allow_agent=False, look_for_keys=False)
        sftp = client.open_sftp()
        with sftp.file("/tmp/cup-survey-phase1-assets.env", "w") as remote_f:
            remote_f.write(assets_env)
        sftp.close()
        client.close()
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "raw_output"}, indent=2))
    if result["gate"] != "READY FOR STEP 1 BOOTSTRAP":
        print("STOPPED — preflight gate not passed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
