#!/usr/bin/env python3
"""Fact-matrix classification for pending-switch recovery."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Any

from state_ops import load, read_upstream_port


def _run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def get_public_release_id(public_base_url: str) -> str:
    url = f"{public_base_url.rstrip('/')}/api/build-info"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.load(resp)
        return str(data.get("releaseId", "") or "")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return ""


def previous_release_from_journal(journal: dict[str, Any]) -> str:
    previous_image = journal.get("previous_image", "")
    if not previous_image:
        return ""
    try:
        return _run(
            [
                "docker",
                "image",
                "inspect",
                "--format",
                '{{index .Config.Labels "cup.release_id"}}',
                previous_image,
            ]
        )
    except subprocess.CalledProcessError:
        return ""


def collect_facts(
    *,
    journal_path: str,
    state_path: str,
    snippet_path: str,
    public_base_url: str,
) -> dict[str, Any]:
    journal = load(journal_path)
    state = load(state_path) if os.path.isfile(state_path) else None
    facts: dict[str, Any] = {
        "journal_exists": journal is not None,
        "journal": journal or {},
        "state": state or {},
        "state_exists": state is not None,
        "snippet_port": read_upstream_port(snippet_path),
        "public_release": get_public_release_id(public_base_url),
    }
    if journal:
        facts["phase"] = journal.get("journal_phase", "")
        facts["target_release"] = journal.get("target_release_id", "")
        facts["target_port"] = int(journal.get("target_port", 0) or 0)
        facts["previous_port"] = int(journal.get("previous_port", 0) or 0)
        facts["target_image_id"] = journal.get("target_image_id", "")
        facts["previous_release"] = previous_release_from_journal(journal)
    if state:
        facts["state_image_id"] = state.get("active_image_id", "")
        facts["state_traffic"] = state.get("traffic_status", "")
        facts["state_verification"] = state.get("verification_status", "")
        facts["cleanup_status"] = state.get("cleanup_status", "")
        active_image = state.get("active_image", "")
        if active_image:
            try:
                facts["target_release"] = _run(
                    [
                        "docker",
                        "image",
                        "inspect",
                        "--format",
                        '{{index .Config.Labels "cup.release_id"}}',
                        active_image,
                    ]
                )
            except subprocess.CalledProcessError:
                facts["target_release"] = ""
        facts["target_port"] = int(state.get("nginx_upstream_port", 0) or 0)
    return facts


def diagnose(facts: dict[str, Any]) -> str:
    lines = [
        f"journal_exists={facts.get('journal_exists')}",
        f"phase={facts.get('phase', '')}",
        f"public_release={facts.get('public_release', '')}",
        f"snippet_port={facts.get('snippet_port')}",
        f"state_traffic={facts.get('state_traffic', '')}",
        f"state_verification={facts.get('state_verification', '')}",
        f"cleanup_status={facts.get('cleanup_status', '')}",
    ]
    return "\n".join(lines)


def classify_recovery(facts: dict[str, Any]) -> str:
    if not facts.get("journal_exists"):
        state = facts.get("state") or {}
        public = facts.get("public_release", "")
        target_release = facts.get("target_release", "")
        state_image = facts.get("state_image_id", "")
        if (
            state.get("verification_status") == "verified"
            and state.get("traffic_status") not in {"committed", ""}
            and public
            and state_image
        ):
            return "OBSERVATION_INTERRUPTED"
        if (
            state.get("traffic_status") == "observing"
            and public
            and facts.get("snippet_port") == facts.get("target_port")
        ):
            return "FINISH_OBSERVATION"
        return "NO_JOURNAL"

    journal = facts["journal"]
    phase = journal.get("journal_phase", "")
    public = facts.get("public_release", "")
    target_release = facts.get("target_release", "")
    previous_release = facts.get("previous_release", "")
    snippet = facts.get("snippet_port")
    target_port = facts.get("target_port")
    previous_port = facts.get("previous_port")
    state = facts.get("state") or {}
    state_image = facts.get("state_image_id", "")
    target_image = facts.get("target_image_id", "")

    # Partial rollback: public=previous, state=target, snippet=previous
    if (
        public
        and previous_release
        and public == previous_release
        and snippet == previous_port
        and state_image
        and target_image
        and state_image == target_image
    ):
        return "PARTIAL_ROLLBACK"

    # Rollback complete, journal stale
    if (
        public
        and previous_release
        and public == previous_release
        and snippet == previous_port
        and state_image
        and state_image != target_image
    ):
        return "STALE_JOURNAL_CLOSE"

    if phase == "VERIFIED":
        if (
            state.get("traffic_status") == "committed"
            and state_image == target_image
        ):
            return "COMMITTED_STALE_JOURNAL"
        if public == target_release and snippet == target_port:
            return "FINISH_OBSERVATION"

    if phase == "STATE_COMMITTED":
        if public == target_release and snippet == target_port:
            return "FINISH_VERIFICATION"
        if public != target_release and snippet == previous_port:
            return "ROLLBACK"

    if phase == "PREPARED":
        if snippet == target_port and public == target_release:
            return "RESUME_AFTER_SWITCH"
        if snippet == previous_port:
            return "ABORT_CANDIDATE"
        return "RESUME_PREPARED"

    return "MANUAL_RECOVERY"


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "classify"
    journal_path = os.environ["JOURNAL_FILE"]
    state_path = os.environ["DEPLOY_STATE_FILE"]
    snippet_path = os.environ["UPSTREAM_SNIPPET"]
    public_base_url = os.environ.get("PUBLIC_BASE_URL", "https://cup26.mma66.ru")

    facts = collect_facts(
        journal_path=journal_path,
        state_path=state_path,
        snippet_path=snippet_path,
        public_base_url=public_base_url,
    )

    if cmd == "diagnose":
        print(diagnose(facts))
        return 0
    if cmd == "classify":
        print(classify_recovery(facts))
        return 0
    print("usage: recovery_matrix.py classify|diagnose", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
