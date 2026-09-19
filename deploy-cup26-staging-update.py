#!/usr/bin/env python3
"""Update cup-survey on production VPS (direct SSH, fallback via Aktau jump)."""
from __future__ import annotations

import json
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).parent
CUP = ROOT / "cup-survey"
AKTAU = "178.83.123.167"
STAGING = "159.194.210.165"
APP_DIR = "/opt/cup-survey"
OUT = ROOT / "deploy-cup26-staging-update-result.json"

EXCLUDE_DIRS = {"node_modules", ".next", ".git", "playwright-report", "test-results", "terminals"}
EXCLUDE_FILES = {".env", ".env.local"}


def read_deploy_local_env() -> dict[str, str]:
    path = Path(r"c:\project fightcrm.ru\scripts\deploy.local.env")
    data: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def aktau_pwd() -> str:
    return next(
        l.split("=", 1)[1].strip()
        for l in (ROOT / "aktau-access/CREDENTIALS-ROTATED.txt").read_text().splitlines()
        if l.startswith("root_password=")
    )


def connect(host: str, password: str) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        host,
        username="root",
        password=password,
        timeout=60,
        banner_timeout=90,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def ssh_cmd(host: str, password: str, cmd: str, timeout: int = 120) -> str:
    client = connect(host, password)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    if code != 0:
        raise RuntimeError(f"ssh {host} exit {code}:\n{out[-5000:]}")
    return out


def sftp_put(host: str, password: str, local: Path, remote: str) -> None:
    client = connect(host, password)
    sftp = client.open_sftp()
    sftp.put(str(local), remote)
    sftp.close()
    client.close()


def ssh_via_aktau(target_host: str, target_pwd: str, cmd: str, timeout: int = 120) -> str:
    inner = cmd.replace("'", "'\"'\"'")
    pwd_esc = target_pwd.replace("'", "'\"'\"'")
    wrap = (
        f"apt-get install -y -qq sshpass 2>/dev/null || true; "
        f"SSHPASS='{pwd_esc}' sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=45 "
        f"root@{target_host} '{inner}'"
    )
    return ssh_cmd(AKTAU, aktau_pwd(), wrap, timeout=timeout + 60)


def run_on_staging(staging_pwd: str, cmd: str, timeout: int = 120) -> str:
    try:
        return ssh_cmd(STAGING, staging_pwd, cmd, timeout=timeout)
    except Exception as direct_error:
        print(f"direct ssh failed: {direct_error}", file=sys.stderr)
        return ssh_via_aktau(STAGING, staging_pwd, cmd, timeout=timeout)


def upload_tarball(staging_pwd: str, tar_path: Path) -> str:
    remote_tar = "/tmp/cup-survey-update.tar.gz"
    try:
        sftp_put(STAGING, staging_pwd, tar_path, remote_tar)
        return "direct"
    except Exception as direct_error:
        print(f"direct upload failed: {direct_error}", file=sys.stderr)

    aktau_tar = "/tmp/cup-survey-update.tar.gz"
    sftp_put(AKTAU, aktau_pwd(), tar_path, aktau_tar)
    spwd = staging_pwd.replace("'", "'\"'\"'")
    copy_cmd = (
        "set -euo pipefail; "
        "apt-get install -y -qq sshpass 2>/dev/null || true; "
        f"SSHPASS='{spwd}' export SSHPASS; "
        f"sshpass -e scp -o StrictHostKeyChecking=no -o ConnectTimeout=45 "
        f"{aktau_tar} root@{STAGING}:{remote_tar}"
    )
    ssh_cmd(AKTAU, aktau_pwd(), copy_cmd, timeout=300)
    return "via_aktau"


def make_tarball() -> Path:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz")
    tmp.close()
    tar_path = Path(tmp.name)
    with tarfile.open(tar_path, "w:gz") as tar:
        for p in CUP.rglob("*"):
            rel = p.relative_to(CUP)
            if rel.parts and rel.parts[0] in EXCLUDE_DIRS:
                continue
            if p.name in EXCLUDE_FILES:
                continue
            if p.is_dir():
                continue
            tar.add(p, arcname=str(rel).replace("\\", "/"))
    return tar_path


def main() -> int:
    staging_pwd = read_deploy_local_env()["STAGING_DEPLOY_SSH_PASSWORD"]
    result: dict = {"target": STAGING, "domain": "cup26.mma66.ru", "preserve_db": True}

    tar_path = make_tarball()
    result["tar_mb"] = round(tar_path.stat().st_size / 1024 / 1024, 2)

    result["upload"] = upload_tarball(staging_pwd, tar_path)

    remote_deploy = f"""
exec 9>/var/lock/cup-survey-deploy.lock
if ! flock -n 9; then
  echo 'another deploy is running'
  exit 1
fi
trap 'flock -u 9' EXIT
set -euo pipefail

APP_DIR={APP_DIR}
test -f "$APP_DIR/.env" || {{ echo 'missing .env'; exit 1; }}

cp "$APP_DIR/.env" /tmp/cup-survey.env.bak
mkdir -p "$APP_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {{}} +
tar -xzf /tmp/cup-survey-update.tar.gz -C "$APP_DIR"
mv /tmp/cup-survey.env.bak "$APP_DIR/.env"
chmod +x "$APP_DIR"/deploy/*.sh 2>/dev/null || true

cd "$APP_DIR"
mkdir -p /etc/nginx/snippets /opt/cup-survey-shared/_next/static
cp deploy/nginx-security-headers.conf /etc/nginx/snippets/cup-survey-security-headers.conf

export CUP_RELEASE_TAG="release-$(date -u +%Y%m%dT%H%M%SZ)"
./deploy/release-app.sh 2>&1 | tail -80

source /opt/cup-survey-shared/deploy-assets.env
./deploy/verify-public-static.sh "${{PREV_CSS}}" "${{PREV_JS}}" "${{CURRENT_CSS}}" "${{CURRENT_JS}}"

docker compose -f docker-compose.prod.yml ps
"""
    result["setup"] = run_on_staging(staging_pwd, remote_deploy, timeout=1800)[-8000:]
    result["url"] = "https://cup26.mma66.ru/"
    result["admin_url"] = "https://cup26.mma66.ru/admin"

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    tar_path.unlink(missing_ok=True)
    print(json.dumps({k: v for k, v in result.items() if k != "setup"}, ensure_ascii=False, indent=2))
    print("--- setup tail ---")
    print(result["setup"][-2500:])
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"UPDATE FAILED: {e}", file=sys.stderr)
        raise
