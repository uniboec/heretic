#!/usr/bin/env python3
"""Regression: app-only compose up must use --no-deps in release-app.sh."""
from __future__ import annotations

from pathlib import Path

SCRIPT = Path(__file__).parent / "release-app.sh"


def test_forward_switch_uses_no_deps() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    assert (
        'docker compose -f "${COMPOSE_FILE}" up -d --no-build --no-deps --force-recreate app'
        in text
    )


def test_rollback_switch_uses_no_deps() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    rollback_line = (
        'docker compose -f "${COMPOSE_FILE}" up -d --no-build --no-deps --force-recreate app 2>/dev/null || true'
    )
    assert rollback_line in text


def test_no_app_up_without_no_deps() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    for line in text.splitlines():
        if "docker compose" in line and " up " in line and " app" in line:
            assert "--no-deps" in line, f"missing --no-deps: {line.strip()}"


if __name__ == "__main__":
    test_forward_switch_uses_no_deps()
    test_rollback_switch_uses_no_deps()
    test_no_app_up_without_no_deps()
    print("ALL PASSED")
