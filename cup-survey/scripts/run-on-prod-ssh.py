#!/usr/bin/env python3
"""Upload script+lib and run on production via migrate container."""
from __future__ import annotations

import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

DEPLOY_ENV = Path(r"c:\project fightcrm.ru\scripts\deploy.local.env")
ROOT = Path(__file__).parent.parent
REMOTE_HOST = "159.194.210.165"
REMOTE_USER = "root"
REMOTE_APP_DIR = "/opt/cup-survey"


def read_password() -> str:
    for line in DEPLOY_ENV.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("STAGING_DEPLOY_SSH_PASSWORD="):
            return line.split("=", 1)[1].strip().strip("'").strip('"')
    raise RuntimeError("password not found")


def make_bundle(script_name: str) -> Path:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz")
    tmp.close()
    tar_path = Path(tmp.name)
    with tarfile.open(tar_path, "w:gz") as tar:
        bundle_roots = [
            ROOT / "lib",
            ROOT / "scripts",
            ROOT / "lib" / "registration",
        ]
        seen: set[str] = set()
        for base in bundle_roots:
            if not base.exists():
                continue
            for path in base.rglob("*"):
                if path.is_dir() or "__tests__" in path.parts:
                    continue
                arcname = path.relative_to(ROOT).as_posix()
                if arcname in seen:
                    continue
                seen.add(arcname)
                tar.add(path, arcname=arcname)
    return tar_path


def main() -> int:
    script_name = sys.argv[1] if len(sys.argv) > 1 else "mavlikayev-bahtin-prod-once.ts"
    local_script = ROOT / "scripts" / script_name
    if not local_script.exists():
        raise RuntimeError(f"Script not found: {local_script}")

    tar_path = make_bundle(script_name)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        REMOTE_HOST,
        username=REMOTE_USER,
        password=read_password(),
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = client.open_sftp()
    sftp.put(str(tar_path), "/tmp/cup-survey-script-bundle.tar.gz")
    sftp.close()
    tar_path.unlink(missing_ok=True)

    cmd = (
        f"set -euo pipefail; cd {REMOTE_APP_DIR}; "
        f"tar -xzf /tmp/cup-survey-script-bundle.tar.gz -C {REMOTE_APP_DIR}; "
        f"if [[ -f /opt/cup-survey-shared/deploy-state.json ]]; then "
        f"RELEASE_TAG=$(python3 -c \"import json; print(json.load(open('/opt/cup-survey-shared/deploy-state.json'))['active_image'].split(':')[-1])\"); "
        f"MIGRATE_RUNTIME_ENV=$(mktemp /tmp/migrate-runtime.XXXXXX); "
        f"./deploy/generate-migrate-runtime-env.sh \"$RELEASE_TAG\" > \"${{MIGRATE_RUNTIME_ENV}}\"; "
        f"chmod 600 \"${{MIGRATE_RUNTIME_ENV}}\"; "
        f"docker run --rm --network cup-survey-prod --env-file \"${{MIGRATE_RUNTIME_ENV}}\" "
        f"-v {REMOTE_APP_DIR}/scripts:/app/scripts -v {REMOTE_APP_DIR}/lib:/app/lib "
        f"\"cup-survey-migrate:${{RELEASE_TAG}}\" "
        f"sh -c 'CUP_SURVEY_SCRIPT_MODE=1 npx tsx scripts/{script_name}'; "
        f"rm -f \"${{MIGRATE_RUNTIME_ENV}}\"; "
        f"else "
        f"docker compose -f docker-compose.legacy.prod.yml run --rm --no-deps "
        f"-v {REMOTE_APP_DIR}/scripts:/app/scripts -v {REMOTE_APP_DIR}/lib:/app/lib "
        f"migrate sh -c 'CUP_SURVEY_SCRIPT_MODE=1 npx tsx scripts/{script_name}'; "
        f"fi"
    )
    _, stdout, stderr = client.exec_command(cmd, timeout=300)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    client.close()

    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
