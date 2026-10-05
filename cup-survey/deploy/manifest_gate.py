#!/usr/bin/env python3
"""Manifest / deploy-state consistency gate for reconcile."""
from __future__ import annotations

import json
import os
import sys
from typing import Any

from static_manifest import ManifestCorruptError, ManifestMissingError, get_current_deploy, load_manifest


def load_state(path: str) -> dict[str, Any] | None:
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def check_manifest_deploy_gate(
    state_path: str,
    manifest_path: str,
    *,
    cleanup_status: str = "",
) -> tuple[bool, str]:
    state = load_state(state_path)
    if state is None:
        return True, "no deploy-state"

    traffic = state.get("traffic_status", "")
    active_image_id = state.get("active_image_id", "")
    if not active_image_id:
        return True, "no active_image_id in state"

    try:
        manifest = load_manifest(manifest_path)
    except ManifestMissingError:
        if traffic == "committed":
            return False, "manifest missing while traffic committed"
        return True, "manifest missing (pre-commit)"
    except ManifestCorruptError as exc:
        return False, f"manifest corrupt: {exc}"

    current = get_current_deploy(manifest)
    if current is None:
        if traffic == "committed":
            return False, "manifest has no current deploy while traffic committed"
        return True, "no current deploy yet"

    if current["image_id"] != active_image_id:
        return (
            False,
            f"manifest/state image mismatch manifest={current['image_id']} state={active_image_id}",
        )

    if cleanup_status in {"failed", "pending"} and traffic == "committed":
        # Allow pending cleanup to proceed; failed cleanup with mismatch already caught above.
        if cleanup_status == "failed" and current["image_id"] != active_image_id:
            return False, "cleanup failed with manifest/state mismatch"

    return True, "ok"


def main() -> int:
    state_path = os.environ.get("DEPLOY_STATE_FILE", "")
    manifest_path = os.environ.get("MANIFEST_PATH", "")
    cleanup_status = os.environ.get("CLEANUP_STATUS", "")
    if not state_path or not manifest_path:
        print("usage: manifest_gate.py (needs DEPLOY_STATE_FILE, MANIFEST_PATH)", file=sys.stderr)
        return 2
    ok, reason = check_manifest_deploy_gate(
        state_path, manifest_path, cleanup_status=cleanup_status
    )
    if ok:
        print(reason)
        return 0
    print(reason, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
