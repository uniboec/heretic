#!/usr/bin/env python3
"""STEP -1: Install migration tooling on VPS without application deploy."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).parent
CUP = ROOT / "cup-survey"
STAGING = "159.194.210.165"
APP_DIR = "/opt/cup-survey"
OUT = ROOT / "deploy-cup26-install-migration-tooling-result.json"

FILES_TO_INSTALL = [
    "deploy/common.sh",
    "deploy/static-manifest.py",
    "deploy/write-merge-metadata.py",
    "deploy/merge-static-assets.sh",
    "deploy/bootstrap-static-assets.sh",
    "deploy/seed-current-image-tag.sh",
    "deploy/prevalidate-production-state.sh",
    "deploy/verify-public-static.sh",
    "deploy/release-app.sh",
    "deploy/prune-static-assets.sh",
    "deploy/nginx-cup26.mma66.ru.conf",
    "docker-compose.prod.yml",
]


def read_deploy_local_env() -> dict[str, str]:
    data: dict[str, str] = {}
    for line in Path(r"c:\project fightcrm.ru\scripts\deploy.local.env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def connect(password: str) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        STAGING,
        username="root",
        password=password,
        timeout=60,
        banner_timeout=90,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def main() -> int:
    pwd = read_deploy_local_env()["STAGING_DEPLOY_SSH_PASSWORD"]
    client = connect(pwd)
    sftp = client.open_sftp()

    backup_ts = __import__("datetime").datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    installed: list[str] = []
    backups: list[str] = []

    for rel in FILES_TO_INSTALL:
        local = CUP / rel
        if not local.exists():
            raise FileNotFoundError(local)
        remote = f"{APP_DIR}/{rel.replace(chr(92), '/')}"
        remote_dir = "/".join(remote.split("/")[:-1])
        try:
            sftp.stat(remote_dir)
        except OSError:
            parts = remote_dir.split("/")
            cur = ""
            for part in parts:
                if not part:
                    continue
                cur = f"{cur}/{part}" if cur else f"/{part}"
                try:
                    sftp.stat(cur)
                except OSError:
                    sftp.mkdir(cur)

        try:
            sftp.stat(remote)
            backup = f"{remote}.bak-migration-{backup_ts}"
            client.exec_command(f"cp -a '{remote}' '{backup}'")
            backups.append(backup)
        except OSError:
            pass

        sftp.put(str(local), remote)
        installed.append(remote)

    sftp.close()

    verify_cmd = f"""
set +e
cd {APP_DIR}
for f in deploy/*.sh; do sed -i 's/\\r$//' "$f" 2>/dev/null || true; done
chmod +x deploy/*.sh 2>/dev/null || true
echo '=== bash -n ==='
for f in deploy/*.sh; do bash -n "$f" && echo "OK $f" || echo "FAIL $f"; done
echo '=== py_compile ==='
for f in deploy/*.py; do python3 -m py_compile "$f" && echo "OK $f" || echo "FAIL $f"; done
echo '=== docker ps ==='
docker ps --filter name=cup-survey --format '{{{{.Names}}}} {{{{.Status}}}}'
"""
    _, stdout, stderr = client.exec_command(verify_cmd, timeout=120)
    verify_out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    client.close()

    result = {
        "installed": installed,
        "backups": backups,
        "verify": verify_out,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"installed_count": len(installed), "backups_count": len(backups)}, indent=2))
    print("--- verify ---")
    print(verify_out[-4000:])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
