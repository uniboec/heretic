#!/usr/bin/env python3
"""Atomic manifest operations for cup-survey static asset retention."""
from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

MANIFEST_VERSION = 2
REQUIRED_DEPLOY_KEYS = (
    "deploy_id",
    "build_id",
    "image_id",
    "image_ref",
    "deployed_at",
    "retired_at",
    "file_count",
    "files",
)
ALLOWED_STATIC_ROOT = "/opt/cup-survey-shared/_next/static"


class ManifestError(Exception):
    """Raised when manifest cannot be read, validated, or written safely."""


class ManifestCorruptError(ManifestError):
    """Existing manifest is present but invalid."""


class ManifestMissingError(ManifestError):
    """Manifest file does not exist."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_utc(value: str, field_name: str) -> datetime:
    if value is None:
        raise ManifestError(f"{field_name} cannot be null for parsing")
    normalized = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ManifestError(f"invalid {field_name}: {value}") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def validate_manifest(data: Any, *, expected_static_root: str | None = None) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ManifestError("manifest root must be an object")

    version = data.get("version")
    if version != MANIFEST_VERSION:
        raise ManifestError(f"unsupported manifest version: {version}")

    static_root = data.get("static_root")
    if static_root != ALLOWED_STATIC_ROOT:
        raise ManifestError(f"unexpected static_root: {static_root}")

    if expected_static_root is not None and static_root != expected_static_root:
        raise ManifestError("static_root mismatch with environment")

    deploys = data.get("deploys")
    if not isinstance(deploys, list):
        raise ManifestError("deploys must be a list")

    seen_image_ids: set[str] = set()
    seen_deploy_ids: set[str] = set()
    current_count = 0

    for index, deploy in enumerate(deploys):
        if not isinstance(deploy, dict):
            raise ManifestError(f"deploy[{index}] must be an object")

        for key in REQUIRED_DEPLOY_KEYS:
            if key not in deploy:
                raise ManifestError(f"deploy[{index}] missing required field: {key}")

        deploy_id = deploy["deploy_id"]
        if not isinstance(deploy_id, str) or not deploy_id:
            raise ManifestError(f"deploy[{index}] invalid deploy_id")

        if deploy_id in seen_deploy_ids:
            raise ManifestError(f"duplicate deploy_id: {deploy_id}")
        seen_deploy_ids.add(deploy_id)

        image_id = deploy["image_id"]
        if not isinstance(image_id, str) or not image_id.startswith("sha256:"):
            raise ManifestError(f"deploy[{index}] invalid image_id")

        if image_id in seen_image_ids:
            raise ManifestError(f"duplicate image_id in manifest: {image_id}")
        seen_image_ids.add(image_id)

        parse_utc(deploy["deployed_at"], "deployed_at")

        retired_at = deploy["retired_at"]
        if retired_at is not None:
            retired_dt = parse_utc(retired_at, "retired_at")
            deployed_dt = parse_utc(deploy["deployed_at"], "deployed_at")
            if retired_dt < deployed_dt:
                raise ManifestError(f"deploy[{index}] retired_at precedes deployed_at")
        else:
            current_count += 1

        files = deploy["files"]
        if not isinstance(files, list) or not files:
            raise ManifestError(f"deploy[{index}] files must be a non-empty list")

        for file_index, rel_path in enumerate(files):
            if not isinstance(rel_path, str):
                raise ManifestError(f"deploy[{index}].files[{file_index}] must be string")
            if rel_path.startswith("/") or ".." in Path(rel_path).parts:
                raise ManifestError(f"unsafe relative path: {rel_path}")

        file_count = deploy["file_count"]
        if not isinstance(file_count, int) or file_count != len(files):
            raise ManifestError(
                f"deploy[{index}] file_count mismatch: {file_count} != {len(files)}"
            )

    if len(deploys) > 0 and current_count != 1:
        raise ManifestError(
            f"manifest must have exactly one current deploy, got {current_count}"
        )

    return data


def load_manifest(path: str | Path) -> dict[str, Any]:
    manifest_path = Path(path)
    if not manifest_path.exists():
        raise ManifestMissingError(f"manifest not found: {manifest_path}")

    try:
        raw = manifest_path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ManifestCorruptError(f"manifest JSON is corrupted: {manifest_path}") from exc
    except OSError as exc:
        raise ManifestError(f"cannot read manifest: {manifest_path}") from exc

    try:
        return validate_manifest(data)
    except ManifestError as exc:
        raise ManifestCorruptError(str(exc)) from exc


def write_manifest_atomic(path: str | Path, data: dict[str, Any]) -> None:
    manifest_path = Path(path)
    validated = validate_manifest(data)

    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    fd, temp_name = tempfile.mkstemp(
        prefix=f".{manifest_path.name}.",
        suffix=".tmp",
        dir=str(manifest_path.parent),
        text=True,
    )
    temp_path = Path(temp_name)

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(validated, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, manifest_path)
    except Exception:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        raise


def get_current_deploy(manifest: dict[str, Any]) -> dict[str, Any] | None:
    currents = [d for d in manifest["deploys"] if d["retired_at"] is None]
    if not currents:
        return None
    if len(currents) > 1:
        raise ManifestCorruptError("multiple current deploys detected")
    return currents[0]


def add_initial_deploy_atomic(path: str | Path, entry: dict[str, Any]) -> dict[str, Any]:
    manifest_path = Path(path)
    if manifest_path.exists():
        raise ManifestError("manifest already exists; use retire_and_promote")

    if entry.get("retired_at") is not None:
        raise ManifestError("initial deploy must have retired_at=null")

    manifest = {
        "version": MANIFEST_VERSION,
        "static_root": ALLOWED_STATIC_ROOT,
        "deploys": [entry],
    }
    validate_manifest(manifest)
    write_manifest_atomic(manifest_path, manifest)
    return manifest


def retire_and_promote_current_atomic(
    path: str | Path,
    new_entry: dict[str, Any],
    *,
    retired_at: str | None = None,
) -> dict[str, Any]:
    if new_entry.get("retired_at") is not None:
        raise ManifestError("new current deploy must have retired_at=null")

    manifest = load_manifest(path)
    current = get_current_deploy(manifest)

    retired_at_value = retired_at or format_utc(utc_now())

    if current is not None:
        if current["image_id"] == new_entry["image_id"]:
            raise ManifestError("new deploy image_id matches current deploy")
        current["retired_at"] = retired_at_value

    manifest["deploys"].append(new_entry)
    validate_manifest(manifest)
    write_manifest_atomic(path, manifest)
    return manifest


@dataclass(frozen=True)
class ProtectedSet:
    protected_paths: frozenset[str]
    protected_deploy_ids: frozenset[str]
    protected_build_ids: frozenset[str]
    protected_image_ids: frozenset[str]


def compute_protected_set(
    manifest: dict[str, Any],
    *,
    retention_days: int,
    keep_recent_deploys: int,
    now: datetime | None = None,
) -> ProtectedSet:
    now = now or utc_now()
    deploys = sorted(
        manifest["deploys"],
        key=lambda item: parse_utc(item["deployed_at"], "deployed_at"),
        reverse=True,
    )

    recent_deploy_ids = {deploy["deploy_id"] for deploy in deploys[:keep_recent_deploys]}

    protected_paths: set[str] = set()
    protected_deploy_ids: set[str] = set()
    protected_build_ids: set[str] = set()
    protected_image_ids: set[str] = set()

    for deploy in deploys:
        retired_at = deploy["retired_at"]
        is_current = retired_at is None
        in_recent = deploy["deploy_id"] in recent_deploy_ids

        protected_by_retirement = False
        if is_current:
            protected_by_retirement = True
        else:
            retired_dt = parse_utc(retired_at, "retired_at")
            protection_until = retired_dt + timedelta(days=retention_days)
            protected_by_retirement = now < protection_until

        if protected_by_retirement or in_recent:
            protected_deploy_ids.add(deploy["deploy_id"])
            protected_build_ids.add(deploy["build_id"])
            protected_image_ids.add(deploy["image_id"])
            protected_paths.update(deploy["files"])

    return ProtectedSet(
        protected_paths=frozenset(protected_paths),
        protected_deploy_ids=frozenset(protected_deploy_ids),
        protected_build_ids=frozenset(protected_build_ids),
        protected_image_ids=frozenset(protected_image_ids),
    )


def resolve_under_static_root(static_root: Path, rel_path: str) -> Path:
    candidate = (static_root / rel_path).resolve()
    static_root_resolved = static_root.resolve()
    if static_root_resolved not in candidate.parents and candidate != static_root_resolved:
        raise ManifestError(f"path escapes static root: {rel_path}")
    return candidate
