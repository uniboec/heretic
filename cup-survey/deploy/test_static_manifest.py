#!/usr/bin/env python3
"""Unit tests for static_manifest.py"""
from __future__ import annotations

import json
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import static_manifest

ManifestCorruptError = static_manifest.ManifestCorruptError
ManifestError = static_manifest.ManifestError
ManifestMissingError = static_manifest.ManifestMissingError
add_initial_deploy_atomic = static_manifest.add_initial_deploy_atomic
compute_protected_set = static_manifest.compute_protected_set
format_utc = static_manifest.format_utc
load_manifest = static_manifest.load_manifest
retire_and_promote_current_atomic = static_manifest.retire_and_promote_current_atomic
validate_manifest = static_manifest.validate_manifest

SHA = "sha256:" + "a" * 64
SHA_B = "sha256:" + "b" * 64


def _entry(
    deploy_id: str,
    image_id: str = SHA,
    retired_at: str | None = None,
    deployed_at: str = "2026-09-01T00:00:00Z",
) -> dict:
    return {
        "deploy_id": deploy_id,
        "build_id": "build-" + deploy_id,
        "image_id": image_id,
        "image_ref": f"cup-survey-app:{deploy_id}",
        "deployed_at": deployed_at,
        "retired_at": retired_at,
        "file_count": 1,
        "files": ["chunks/test.css"],
    }


def test_one_current_pass() -> None:
    manifest = {
        "version": 2,
        "static_root": "/opt/cup-survey-shared/_next/static",
        "deploys": [_entry("d1")],
    }
    validate_manifest(manifest)


def test_two_current_fail() -> None:
    manifest = {
        "version": 2,
        "static_root": "/opt/cup-survey-shared/_next/static",
        "deploys": [_entry("d1"), _entry("d2", SHA_B)],
    }
    try:
        validate_manifest(manifest)
        raise AssertionError("expected failure for two current deploys")
    except ManifestError:
        pass


def test_zero_current_nonempty_fail() -> None:
    manifest = {
        "version": 2,
        "static_root": "/opt/cup-survey-shared/_next/static",
        "deploys": [_entry("d1", retired_at="2026-09-02T00:00:00Z")],
    }
    try:
        validate_manifest(manifest)
        raise AssertionError("expected failure for zero current deploys")
    except ManifestError:
        pass


def test_deployed_at_bootstrap_prefix_invalid() -> None:
    entry = _entry("bootstrap-2026-09-18T15:47:51Z")
    entry["deployed_at"] = "bootstrap-2026-09-18T15:47:51Z"
    manifest = {
        "version": 2,
        "static_root": "/opt/cup-survey-shared/_next/static",
        "deploys": [entry],
    }
    try:
        validate_manifest(manifest)
        raise AssertionError("expected invalid deployed_at")
    except ManifestError:
        pass


def test_retention_day0_day20_day36() -> None:
    day0 = datetime(2026, 9, 1, tzinfo=timezone.utc)
    day20 = datetime(2026, 9, 21, tzinfo=timezone.utc)
    day21 = datetime(2026, 9, 22, tzinfo=timezone.utc)
    day35 = datetime(2026, 10, 6, tzinfo=timezone.utc)
    day36 = datetime(2026, 10, 7, tzinfo=timezone.utc)

    manifest = {
        "version": 2,
        "static_root": "/opt/cup-survey-shared/_next/static",
        "deploys": [
            {
                **_entry("a", image_id=SHA, retired_at=format_utc(day20), deployed_at=format_utc(day0)),
                "files": ["chunks/a.css"],
            },
            {
                **_entry("b", image_id=SHA_B, retired_at=None, deployed_at=format_utc(day20)),
                "files": ["chunks/b.css"],
            },
        ],
    }
    validate_manifest(manifest)

    protected_21 = compute_protected_set(manifest, retention_days=16, keep_recent_deploys=1, now=day21)
    assert "chunks/a.css" in protected_21.protected_paths

    protected_35 = compute_protected_set(manifest, retention_days=16, keep_recent_deploys=1, now=day35)
    assert "chunks/a.css" in protected_35.protected_paths

    protected_36 = compute_protected_set(manifest, retention_days=16, keep_recent_deploys=1, now=day36)
    assert "chunks/a.css" not in protected_36.protected_paths
    assert "chunks/b.css" in protected_36.protected_paths


def test_corrupt_manifest_abort() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "manifest.json"
        path.write_text("{not json", encoding="utf-8")
        try:
            load_manifest(path)
            raise AssertionError("expected corrupt manifest failure")
        except ManifestCorruptError:
            pass


def test_atomic_promote() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "manifest.json"
        add_initial_deploy_atomic(path, _entry("bootstrap-1"))
        retire_and_promote_current_atomic(
            path,
            _entry("deploy-2", image_id=SHA_B, deployed_at="2026-09-21T00:00:00Z"),
            retired_at="2026-09-21T00:00:00Z",
        )
        manifest = load_manifest(path)
        assert manifest["deploys"][0]["retired_at"] == "2026-09-21T00:00:00Z"
        assert manifest["deploys"][1]["retired_at"] is None


def main() -> None:
    test_one_current_pass()
    test_two_current_fail()
    test_zero_current_nonempty_fail()
    test_deployed_at_bootstrap_prefix_invalid()
    test_retention_day0_day20_day36()
    test_corrupt_manifest_abort()
    test_atomic_promote()
    print("test_static_manifest: ALL PASSED")


if __name__ == "__main__":
    main()
