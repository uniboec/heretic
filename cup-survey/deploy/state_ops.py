#!/usr/bin/env python3
"""Deploy state, journal, and recovery helpers."""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any

from atomic_write import atomic_write


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load(path: str) -> dict[str, Any] | None:
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def save(path: str, data: dict[str, Any]) -> None:
    data["updated_at"] = utc_now()
    atomic_write(path, json.dumps(data, indent=2, sort_keys=True) + "\n")


def journal_get(path: str, field: str) -> str:
    data = load(path)
    if not data:
        return ""
    value = data.get(field)
    return "" if value is None else str(value)


def write_journal_prepared(
    path: str,
    *,
    target_image_ref: str,
    target_image_id: str,
    target_release_id: str,
    target_git_sha: str,
    previous_port: int,
    target_port: int,
    previous_slot: str,
    target_slot: str,
    previous_image: str,
    previous_image_id: str,
    previous_state_existed: bool,
    snapshot: dict[str, Any] | None,
    legacy_previous_identity: dict[str, Any] | None = None,
    rollback_intent: bool = False,
) -> None:
    entry: dict[str, Any] = {
        "journal_phase": "PREPARED",
        "verification_status": "unverified",
        "previous_port": previous_port,
        "target_port": target_port,
        "previous_slot": previous_slot,
        "target_slot": target_slot,
        "target_image_ref": target_image_ref,
        "target_image_id": target_image_id,
        "target_release_id": target_release_id,
        "target_git_sha": target_git_sha,
        "previous_image": previous_image,
        "previous_image_id": previous_image_id,
        "previous_state_existed": previous_state_existed,
        "previous_deploy_state_snapshot": snapshot,
        "legacy_previous_identity": legacy_previous_identity,
        "rollback_intent": rollback_intent,
        "started_at": utc_now(),
    }
    save(path, entry)


def update_journal_phase(path: str, phase: str) -> None:
    data = load(path)
    if not data:
        raise SystemExit("journal missing")
    data["journal_phase"] = phase
    save(path, data)


def delete_journal(path: str) -> None:
    if os.path.isfile(path):
        os.remove(path)


def commit_state_after_switch(
    state_path: str,
    *,
    active_slot: str,
    active_image: str,
    active_image_id: str,
    previous_image: str,
    previous_image_id: str,
    nginx_port: int,
) -> None:
    state = load(state_path) or {}
    state.update(
        {
            "active_slot": active_slot,
            "active_image": active_image,
            "active_image_id": active_image_id,
            "previous_image": previous_image,
            "previous_image_id": previous_image_id,
            "previous_manual_rollback_compatible": True,
            "nginx_upstream_port": nginx_port,
            "verification_status": "unverified",
            "traffic_status": "observing",
            "traffic_committed_at": None,
            "cleanup_status": "pending",
        }
    )
    save(state_path, state)


def mark_verified(state_path: str) -> None:
    state = load(state_path)
    if not state:
        raise SystemExit("deploy-state missing")
    state["verification_status"] = "verified"
    save(state_path, state)


def mark_traffic_committed(state_path: str) -> None:
    state = load(state_path)
    if not state:
        raise SystemExit("deploy-state missing")
    state["traffic_status"] = "committed"
    state["traffic_committed_at"] = utc_now()
    state["cleanup_status"] = "pending"
    save(state_path, state)


def mark_cleanup_complete(state_path: str) -> None:
    state = load(state_path)
    if not state:
        raise SystemExit("deploy-state missing")
    state["cleanup_status"] = "complete"
    save(state_path, state)


def mark_cleanup_failed(state_path: str) -> None:
    state = load(state_path)
    if not state:
        state = {}
    state["cleanup_status"] = "failed"
    save(state_path, state)


def restore_snapshot(state_path: str, snapshot: dict[str, Any]) -> None:
    save(state_path, snapshot)


def swap_active_previous(state_path: str, *, new_active_image: str, new_active_image_id: str) -> None:
    state = load(state_path)
    if not state:
        raise SystemExit("deploy-state missing")
    old_active_image = state.get("active_image", "")
    old_active_image_id = state.get("active_image_id", "")
    old_slot = state.get("active_slot", "blue")
    new_slot = "green" if old_slot == "blue" else "blue"
    new_port = int(state.get("nginx_upstream_port", 3001))
    prev_port = 3002 if new_port == 3001 else 3001
    state.update(
        {
            "active_slot": new_slot,
            "active_image": new_active_image,
            "active_image_id": new_active_image_id,
            "previous_image": old_active_image,
            "previous_image_id": old_active_image_id,
            "previous_manual_rollback_compatible": True,
            "nginx_upstream_port": prev_port if state.get("rollback_intent") else new_port,
            "verification_status": "unverified",
            "traffic_status": "observing",
            "traffic_committed_at": None,
            "cleanup_status": "pending",
        }
    )
    save(state_path, state)


def read_upstream_port(snippet_path: str) -> int | None:
    if not os.path.isfile(snippet_path):
        return None
    with open(snippet_path, encoding="utf-8") as handle:
        text = handle.read()
    match = re.search(r"127\.0\.0\.1:(\d+)", text)
    return int(match.group(1)) if match else None


def write_upstream_snippet(snippet_path: str, port: int) -> None:
    content = (
        "upstream cup_survey_app {\n"
        f"    server 127.0.0.1:{port};\n"
        "    keepalive 16;\n"
        "}\n"
    )
    atomic_write(snippet_path, content)


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "journal-get" and len(sys.argv) == 4:
        print(journal_get(sys.argv[2], sys.argv[3]))
        return 0
    if cmd == "read-upstream-port" and len(sys.argv) == 3:
        port = read_upstream_port(sys.argv[2])
        print(port if port is not None else "")
        return 0
    if cmd == "write-upstream-snippet" and len(sys.argv) == 4:
        write_upstream_snippet(sys.argv[2], int(sys.argv[3]))
        return 0
    print("usage: state_ops.py <command> ...", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
