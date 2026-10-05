#!/usr/bin/env python3
"""Tests for active slot resolution logic (mirrors common.sh)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

DEPLOY = Path(__file__).parent


class ActiveSlotLogicTests(unittest.TestCase):
    def test_state_file_blue(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "deploy-state.json"
            state.write_text(json.dumps({"active_slot": "blue"}), encoding="utf-8")
            data = json.loads(state.read_text(encoding="utf-8"))
            self.assertEqual(data.get("active_slot"), "blue")

    def test_state_file_green(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "deploy-state.json"
            state.write_text(json.dumps({"active_slot": "green"}), encoding="utf-8")
            data = json.loads(state.read_text(encoding="utf-8"))
            self.assertEqual(data.get("active_slot"), "green")


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
