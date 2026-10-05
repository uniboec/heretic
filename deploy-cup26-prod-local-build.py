#!/usr/bin/env python3
"""Deploy cup-survey to cup26 prod: build images locally, upload, switch on server."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import paramiko

ROOT = Path(__file__).parent
CUP = ROOT / "cup-survey"
STAGING = "159.194.210.165"
APP_DIR = "/opt/cup-survey"
OUT = ROOT / "deploy-cup26-prod-local-build-result.json"
MANIFEST_DEFAULT = ROOT / "deploy-cup26-release-manifest.json"
ARTIFACTS_DIR = ROOT / "deploy-artifacts"
STABLE_ARTIFACT = ARTIFACTS_DIR / "cup-survey-images.tar.gz"
LOG = "/tmp/cup-survey-local-build-deploy.log"
REMOTE = "/tmp/run-local-build-deploy.sh"
IMAGES_REMOTE = "/tmp/cup-survey-images.tar.gz"
IMAGES_SHA_REMOTE = "/tmp/cup-survey-images.tar.gz.sha256"
MANIFEST_REMOTE = "/tmp/cup-survey-release-manifest.json"

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    "data",
    "playwright-report",
    "test-results",
    "terminals",
}
EXCLUDE_FILES = {".env", ".env.local"}


def read_password() -> str:
    path = Path(r"c:\project fightcrm.ru\scripts\deploy.local.env")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("STAGING_DEPLOY_SSH_PASSWORD="):
            return line.split("=", 1)[1].strip().strip("'").strip('"')
    raise RuntimeError("STAGING_DEPLOY_SSH_PASSWORD not found")


def connect() -> paramiko.SSHClient:
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                STAGING,
                username="root",
                password=read_password(),
                timeout=60,
                banner_timeout=120,
                auth_timeout=90,
                allow_agent=False,
                look_for_keys=False,
            )
            return client
        except Exception as error:
            last_error = error
            time.sleep(min(10 * (attempt + 1), 30))
    raise RuntimeError(f"SSH connect failed: {last_error}")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str]:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    return stdout.channel.recv_exit_status(), out


def run_local(cmd: list[str], *, cwd: Path | None = None, timeout: int | None = None) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True, timeout=timeout)


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def make_source_tarball() -> Path:
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


def build_images_locally(release_id: str, git_sha: str) -> None:
    base = [
        "docker",
        "buildx",
        "build",
        "--platform",
        "linux/amd64",
        "--build-arg",
        f"RELEASE_ID={release_id}",
        "--build-arg",
        f"GIT_SHA={git_sha}",
        "-f",
        "Dockerfile",
        "--load",
    ]
    print("=== LOCAL BUILD: migrate ===", flush=True)
    run_local(
        [
            *base,
            "--target",
            "migrate",
            "-t",
            f"cup-survey-migrate:{release_id}",
            "-t",
            "cup-survey-migrate:current",
            ".",
        ],
        cwd=CUP,
        timeout=3600,
    )
    print("=== LOCAL BUILD: runner ===", flush=True)
    run_local(
        [
            *base,
            "--target",
            "runner",
            "-t",
            f"cup-survey-app:{release_id}",
            "-t",
            "cup-survey-app:current",
            ".",
        ],
        cwd=CUP,
        timeout=3600,
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def docker_image_id(image_ref: str) -> str:
    return subprocess.check_output(
        ["docker", "image", "inspect", "--format", "{{.Id}}", image_ref],
        text=True,
    ).strip()


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_manifest(
    *,
    release_id: str,
    git_sha: str,
    artifact_path: Path,
    app_image_id: str,
    migrate_image_id: str,
) -> dict:
    return {
        "release_id": release_id,
        "git_sha": git_sha,
        "app_image_id": app_image_id,
        "migrate_image_id": migrate_image_id,
        "artifact_path": artifact_path.name,
        "artifact_sha256": sha256_file(artifact_path),
        "built_at": datetime.now(timezone.utc).isoformat(),
        "cup_disable_lazy_reconcile": "1",
        "drill_passed": False,
    }


def write_manifest_files(manifest: dict, manifest_path: Path, artifact_path: Path) -> Path:
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    sha_path = artifact_path.with_suffix(artifact_path.suffix + ".sha256")
    sha_path.write_text(
        f"{manifest['artifact_sha256']}  {artifact_path.name}\n",
        encoding="utf-8",
        newline="\n",
    )
    return sha_path


def save_images() -> Path:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz")
    tmp.close()
    tar_path = Path(tmp.name)
    raw = tar_path.with_suffix(".tar")
    run_local(
        [
            "docker",
            "save",
            "-o",
            str(raw),
            "cup-survey-app:current",
            "cup-survey-migrate:current",
        ],
        timeout=600,
    )
    import gzip
    import shutil

    with open(raw, "rb") as src, gzip.open(tar_path, "wb", compresslevel=6) as dst:
        shutil.copyfileobj(src, dst)
    raw.unlink(missing_ok=True)
    return tar_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy cup-survey to cup26 prod")
    parser.add_argument(
        "--upload-only",
        action="store_true",
        help="Skip local docker build; upload pre-built artifacts only (P0.9)",
    )
    parser.add_argument(
        "--artifact",
        type=Path,
        help="Pre-built images tarball (.tar.gz) for --upload-only",
    )
    parser.add_argument(
        "--source-artifact",
        type=Path,
        help="Pre-built source tarball for --upload-only (default: build from cup-survey/)",
    )
    parser.add_argument("--release-id", type=str, help="Release tag for --upload-only")
    parser.add_argument("--git-sha", type=str, help="Git SHA label for --upload-only")
    parser.add_argument(
        "--manifest",
        type=Path,
        help="Release manifest JSON (written after local build; required for --upload-only verify)",
    )
    parser.add_argument(
        "--manifest-out",
        type=Path,
        default=MANIFEST_DEFAULT,
        help="Where to write release manifest after local build",
    )
    parser.add_argument(
        "--skip-migrate",
        action="store_true",
        help="RC path: do not run prisma migrate on prod (0 migrations)",
    )
    parser.add_argument(
        "--rc",
        action="store_true",
        help="Alias for --skip-migrate (Flow A RC deploy)",
    )
    parser.add_argument(
        "--build-only",
        action="store_true",
        help="Local build + release manifest only (no SSH upload; plan step 4b)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.build_only and args.upload_only:
        raise RuntimeError("--build-only and --upload-only are mutually exclusive")
    skip_migrate = args.skip_migrate or args.rc
    if not (CUP / "Dockerfile").is_file():
        raise RuntimeError(f"missing Dockerfile in {CUP}")

    release_id = args.release_id or f"release-{stamp()}"
    git_sha = args.git_sha or f"local-{stamp()}"
    started = datetime.now(timezone.utc).isoformat()
    mode = "upload-only" if args.upload_only else "build-only" if args.build_only else "local-build"
    result: dict = {
        "target": STAGING,
        "domain": "cup26.mma66.ru",
        "release": release_id,
        "git_sha": git_sha,
        "started_at": started,
        "mode": mode,
        "skip_migrate": skip_migrate,
    }

    if args.upload_only:
        if not args.artifact or not args.artifact.is_file():
            raise RuntimeError("--upload-only requires --artifact <path> to a pre-built images tarball")
        images_tar = args.artifact.resolve()
        source_tar = (
            args.source_artifact.resolve()
            if args.source_artifact
            else make_source_tarball()
        )
        manifest_path = (args.manifest or args.manifest_out).resolve()
        if not manifest_path.is_file():
            raise RuntimeError("--upload-only requires --manifest with release manifest from drill")
        manifest = load_manifest(manifest_path)
        if sha256_file(images_tar) != manifest["artifact_sha256"]:
            raise RuntimeError("artifact sha256 does not match release manifest")
        release_id = manifest.get("release_id", release_id)
        git_sha = manifest.get("git_sha", git_sha)
        print(f"UPLOAD-ONLY: images={images_tar}", flush=True)
        print(f"UPLOAD-ONLY: source={source_tar}", flush=True)
        print(f"UPLOAD-ONLY: manifest={manifest_path}", flush=True)
    else:
        build_images_locally(release_id, git_sha)
        images_tar = save_images()
        source_tar = make_source_tarball()
        manifest = build_manifest(
            release_id=release_id,
            git_sha=git_sha,
            artifact_path=images_tar,
            app_image_id=docker_image_id("cup-survey-app:current"),
            migrate_image_id=docker_image_id("cup-survey-migrate:current"),
        )
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(images_tar, STABLE_ARTIFACT)
        images_tar = STABLE_ARTIFACT
        manifest = build_manifest(
            release_id=release_id,
            git_sha=git_sha,
            artifact_path=images_tar,
            app_image_id=manifest["app_image_id"],
            migrate_image_id=manifest["migrate_image_id"],
        )
        manifest_path = args.manifest_out.resolve()
        sha_path = write_manifest_files(manifest, manifest_path, images_tar)
        print(f"Stable artifact: {STABLE_ARTIFACT}", flush=True)
        print(f"Release manifest: {manifest_path}", flush=True)
        print(f"Artifact sha256: {manifest['artifact_sha256']}", flush=True)
        print(f"SHA sidecar: {sha_path}", flush=True)

    if args.build_only:
        result.update(
            {
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "ok": True,
                "manifest": str(manifest_path),
                "artifact": str(images_tar),
                "artifact_sha256": manifest["artifact_sha256"],
                "app_image_id": manifest["app_image_id"],
                "migrate_image_id": manifest["migrate_image_id"],
            }
        )
        OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({k: v for k, v in result.items()}, ensure_ascii=False, indent=2), flush=True)
        print(
            "\nNext: migration drill -> p09 checklist -> "
            "python deploy-cup26-prod-local-build.py --upload-only --rc "
            f"--artifact {images_tar} --manifest {manifest_path}",
            flush=True,
        )
        return 0

    sha_path = images_tar.with_suffix(images_tar.suffix + ".sha256")
    if not sha_path.is_file():
        sha_path.write_text(f"{manifest['artifact_sha256']}  {images_tar.name}\n", encoding="utf-8")

    result["images_mb"] = round(images_tar.stat().st_size / 1024 / 1024, 2)
    result["source_mb"] = round(source_tar.stat().st_size / 1024 / 1024, 2)
    result["manifest"] = str(manifest_path)
    result["artifact_sha256"] = manifest["artifact_sha256"]
    result["app_image_id"] = manifest["app_image_id"]
    result["migrate_image_id"] = manifest["migrate_image_id"]
    print(f"Images tarball: {result['images_mb']} MB", flush=True)
    print(f"Source tarball: {result['source_mb']} MB", flush=True)

    client = connect()
    sftp = client.open_sftp()

    def upload_with_progress(local: Path, remote: str) -> None:
        size = local.stat().st_size
        last_pct = -1

        def progress(sent: int, total: int) -> None:
            nonlocal last_pct
            pct = int(sent * 100 / total) if total else 100
            if pct >= last_pct + 10 or pct == 100:
                print(f"upload {remote}: {pct}%", flush=True)
                last_pct = pct

        sftp.put(str(local), remote, callback=progress)

    upload_with_progress(images_tar, IMAGES_REMOTE)
    upload_with_progress(sha_path, IMAGES_SHA_REMOTE)
    upload_with_progress(manifest_path, MANIFEST_REMOTE)
    upload_with_progress(source_tar, "/tmp/cup-survey-update.tar.gz")
    sftp.close()
    if args.upload_only:
        images_tar.unlink(missing_ok=True)
    source_tar.unlink(missing_ok=True)

    skip_migrate_flag = "1" if skip_migrate else "0"
    deploy_script = f"""#!/bin/bash
set -euo pipefail
exec > {LOG} 2>&1
echo START $(date -u +%Y-%m-%dT%H:%M:%SZ)
echo release_tag={release_id}
echo git_sha={git_sha}
echo skip_migrate={skip_migrate_flag}
echo expected_app_image_id={manifest["app_image_id"]}
echo expected_migrate_image_id={manifest["migrate_image_id"]}
echo artifact_sha256={manifest["artifact_sha256"]}

exec 9>/var/lock/cup-survey-deploy.lock
flock -n 9 || {{ echo 'another deploy running'; exit 1; }}
trap 'flock -u 9' EXIT

APP_DIR={APP_DIR}
cd "$APP_DIR"

PREV_IMAGE="$(python3 -c "import json; print(json.load(open('/opt/cup-survey-shared/deploy-state.json')).get('active_image','unknown'))" 2>/dev/null || docker inspect cup-survey-app-1 --format '{{{{.Config.Image}}}}' 2>/dev/null || echo unknown)"
echo previous_image=$PREV_IMAGE
df -h / | tail -1

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR=/opt/cup-survey-backups

echo '=== POSTGRES BACKUP ==='
mkdir -p "$BACKUP_DIR/postgres"
docker exec cup-survey-postgres-1 pg_dump -U cup_survey -d cup_survey --no-owner -Fc > "$BACKUP_DIR/postgres/postgres-$STAMP.dump"
size=$(wc -c < "$BACKUP_DIR/postgres/postgres-$STAMP.dump")
[[ "$size" -gt 1024 ]] || {{ echo 'backup too small'; exit 1; }}
ls -lh "$BACKUP_DIR/postgres/postgres-$STAMP.dump"
echo BACKUP_FILE=$BACKUP_DIR/postgres/postgres-$STAMP.dump

echo '=== PAYMENT PROOFS BACKUP ==='
if [ -x deploy/backup-payment-proofs.sh ]; then
  ./deploy/backup-payment-proofs.sh || true
fi

echo '=== APP SOURCE BACKUP ==='
mkdir -p "$BACKUP_DIR/app"
tar -czf "$BACKUP_DIR/app/app-$STAMP.tar.gz" -C "$APP_DIR" --exclude='node_modules' --exclude='.next' .
ls -lh "$BACKUP_DIR/app/app-$STAMP.tar.gz"

echo '=== DOCKER IMAGE BACKUP ==='
docker tag "$PREV_IMAGE" "cup-survey-app:backup-$STAMP" 2>/dev/null || true
docker tag cup-survey-app:current "cup-survey-app:backup-current-$STAMP" 2>/dev/null || true

echo '=== UPLOAD SOURCE ==='
cp "$APP_DIR/.env" /tmp/cup-survey.env.bak
cp "$APP_DIR/docker-compose.legacy.prod.yml" /tmp/cup-survey.legacy.compose.bak 2>/dev/null || true
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {{}} +
tar -xzf /tmp/cup-survey-update.tar.gz -C "$APP_DIR"
mv /tmp/cup-survey.env.bak "$APP_DIR/.env"
mv /tmp/cup-survey.legacy.compose.bak "$APP_DIR/docker-compose.legacy.prod.yml" 2>/dev/null || true
for f in "$APP_DIR"/deploy/*.sh; do
  sed -i 's/\\r$//' "$f" 2>/dev/null || true
done
chmod +x "$APP_DIR"/deploy/*.sh 2>/dev/null || true

echo '=== VERIFY ARTIFACT SHA256 ==='
cd /tmp
sed -i 's/\\r$//' cup-survey-images.tar.gz.sha256
sha256sum -c cup-survey-images.tar.gz.sha256

echo '=== LOAD IMAGES ==='
gunzip -c {IMAGES_REMOTE} | docker load
docker image inspect cup-survey-app:current >/dev/null
docker image inspect cup-survey-migrate:current >/dev/null
LOADED_APP_ID="$(docker image inspect --format '{{{{.Id}}}}' cup-survey-app:current)"
LOADED_MIGRATE_ID="$(docker image inspect --format '{{{{.Id}}}}' cup-survey-migrate:current)"
echo loaded_app_image_id=$LOADED_APP_ID
echo loaded_migrate_image_id=$LOADED_MIGRATE_ID
test "$LOADED_APP_ID" = "{manifest["app_image_id"]}" || {{ echo 'APP_IMAGE_ID mismatch'; exit 1; }}
test "$LOADED_MIGRATE_ID" = "{manifest["migrate_image_id"]}" || {{ echo 'MIGRATE_IMAGE_ID mismatch'; exit 1; }}
docker tag cup-survey-app:current "cup-survey-app:{release_id}"
docker tag cup-survey-migrate:current "cup-survey-migrate:{release_id}"
docker images cup-survey-app --format '{{{{.Repository}}}}:{{{{.Tag}}}}' | head -5

echo '=== TAG ROLLBACK ==='
docker tag "$PREV_IMAGE" "cup-survey-app:rollback-pre-release" 2>/dev/null || true

echo '=== BLUE-GREEN RELEASE ==='
export DEPLOY_SCRIPT_DIR="$APP_DIR/deploy"
source "$DEPLOY_SCRIPT_DIR/common.sh"
export APP_DIR COMPOSE_FILE PRODUCTION_ENV_FILE COMPOSE_IMAGES_ENV DEPLOY_STATE_FILE DEPLOY_SCRIPT_DIR STATE_DIR JOURNAL_FILE DEPLOY_LOCK_FILE SHARED_STATIC_ROOT MANIFEST_PATH DOCKER_NETWORK UPSTREAM_SNIPPET PUBLIC_BASE_URL BLUE_PORT GREEN_PORT PYTHON
export CUP_SKIP_BUILD=1
export CUP_RELEASE_TAG="{release_id}"
export EXPECTED_GIT_SHA="{git_sha}"
export CUP_ALLOW_RELEASE_APP_DURING_RECOVERY=1
export CUP_DISABLE_LAZY_RECONCILE=1
export DISK_GATE_GB=4
export SWAP_USED_MAX_MB=1024
cd "$APP_DIR"
./deploy/release-app.sh 2>&1 | tail -80

echo '=== VERIFY ==='
ACTIVE_PORT="$(python3 -c "import json; s=json.load(open('/opt/cup-survey-shared/deploy-state.json')).get('active_slot','blue'); print(3001 if s=='blue' else 3002)")"
curl -s -o /dev/null -w 'health=%{{http_code}}\\n' --max-time 20 "http://127.0.0.1:${{ACTIVE_PORT}}/api/health"
curl -fsS --max-time 20 "http://127.0.0.1:${{ACTIVE_PORT}}/api/tournament/participants?limit=2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('participants', len(d.get('participants',[])), 'stats', d.get('stats'))"
curl -s -o /dev/null -w 'site_health=%{{http_code}}\\n' --max-time 20 https://cup26.mma66.ru/api/health

echo '=== ATHLETE RATING SETTINGS ==='
if [ -x deploy/apply-athlete-rating-settings.sh ]; then
  ./deploy/apply-athlete-rating-settings.sh
else
  echo 'apply-athlete-rating-settings.sh missing — skip'
fi

echo deployed={release_id}
echo backup_postgres=$BACKUP_DIR/postgres/postgres-$STAMP.dump
echo DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)
"""

    sftp = client.open_sftp()
    with sftp.file(REMOTE, "w") as handle:
        handle.write(deploy_script)
    sftp.close()

    code, out = run(client, f"chmod +x {REMOTE}; nohup {REMOTE} >/dev/null 2>&1 & echo started", timeout=30)
    print(out, flush=True)
    client.close()

    print("Waiting for remote deploy (up to 30 min)...", flush=True)
    done_line = ""
    full_log = ""
    for attempt in range(90):
        time.sleep(20)
        client = connect()
        _, log_tail = run(client, f"tail -20 {LOG} 2>/dev/null || echo waiting", timeout=30)
        _, done_line = run(client, f"grep '^DONE ' {LOG} 2>/dev/null | tail -1", timeout=30)
        client.close()
        lines = [line for line in log_tail.strip().splitlines() if line.strip()]
        if lines:
            print(f"[{attempt + 1}] {lines[-1][:160]}", flush=True)
        if done_line.strip().startswith("DONE "):
            full_log = log_tail
            break
        lower = log_tail.lower()
        if "another deploy running" in lower and attempt > 1:
            raise RuntimeError("another deploy running")
        if attempt > 3 and "error" in lower and "done" not in lower:
            if "migration failed" in lower or "load" in lower and "failed" in lower:
                break
    else:
        raise RuntimeError("remote deploy timed out after 30 minutes")

    client = connect()
    _, full_log = run(client, f"cat {LOG}", timeout=120)
    _, health = run(
        client,
        "curl -s -o /dev/null -w 'participants=%{http_code} health=%{http_code} site=%{http_code}\\n' "
        "'https://cup26.mma66.ru/api/tournament/participants?limit=1' "
        "'https://cup26.mma66.ru/api/health' 'https://cup26.mma66.ru/'",
        timeout=30,
    )
    client.close()

    backup_file = "unknown"
    for line in full_log.splitlines():
        if line.startswith("backup_postgres="):
            backup_file = line.split("=", 1)[1]

    ok = (
        "participants=200" in health
        and "health=200" in health
        and done_line.strip().startswith("DONE ")
        and "release-app: OK" in full_log
        and "health=200" in full_log
        and "site_health=200" in full_log
    )

    result.update(
        {
            "ok": ok,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "health": health.strip(),
            "backup_postgres": backup_file,
            "log_tail": full_log[-12000:],
        }
    )
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {k: v for k, v in result.items() if k != "log_tail"}
    sys.stdout.buffer.write(
        (json.dumps(summary, ensure_ascii=False, indent=2) + "\n--- log tail ---\n" + full_log[-4000:]).encode(
            "utf-8", errors="replace"
        )
    )
    sys.stdout.buffer.flush()

    if not ok:
        raise RuntimeError("deploy finished but verification failed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"DEPLOY FAILED: {error}", file=sys.stderr)
        raise
