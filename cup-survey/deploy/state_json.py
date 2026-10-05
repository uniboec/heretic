#!/usr/bin/env python3
"""Read/write deploy-state.json and pending-switch.json."""
from __future__ import annotations

import json
import os
import sys
from typing import Any

from atomic_write import atomic_write


def load_json(path: str) -> dict[str, Any] | None:
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: str, data: dict[str, Any]) -> None:
    atomic_write(path, json.dumps(data, indent=2, sort_keys=True) + "\n")


def journal_field(path: str, field: str) -> str:
    data = load_json(path)
    if not data:
        return ""
    value = data.get(field)
    return "" if value is None else str(value)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: state_json.py <get-field|save> ...", file=sys.stderr)
        return 2
    cmd = sys.argv[1]
    if cmd == "get-field" and len(sys.argv) == 4:
        print(journal_field(sys.argv[2], sys.argv[3]))
        return 0
    if cmd == "save" and len(sys.argv) == 4:
        with open(sys.argv[3], encoding="utf-8") as handle:
            save_json(sys.argv[2], json.load(handle))
        return 0
    print("unknown command", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
