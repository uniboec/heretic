#!/usr/bin/env python3
"""Tests for manifest_gate and recovery_matrix."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

DEPLOY = Path(__file__).parent
sys.path.insert(0, str(DEPLOY))

from manifest_gate import check_manifest_deploy_gate  # noqa: E402
from recovery_matrix import classify_recovery, collect_facts  # noqa: E402


class ManifestGateTests(unittest.TestCase):
    def test_matching_manifest_passes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "state.json"
            manifest_path = Path(tmp) / "manifest.json"
            image_id = "sha256:abc"
            state_path.write_text(
                json.dumps({"active_image_id": image_id, "traffic_status": "committed"}),
                encoding="utf-8",
            )
            manifest_path.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "static_root": "/opt/cup-survey-shared/_next/static",
                        "deploys": [
                            {
                                "deploy_id": "d1",
                                "build_id": "b1",
                                "image_id": image_id,
                                "image_ref": "cup-survey-app:r1",
                                "deployed_at": "2026-01-01T00:00:00Z",
                                "retired_at": None,
                                "file_count": 1,
                                "files": ["a.js"],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            ok, reason = check_manifest_deploy_gate(str(state_path), str(manifest_path))
            self.assertTrue(ok, reason)

    def test_mismatch_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            state_path = Path(tmp) / "state.json"
            manifest_path = Path(tmp) / "manifest.json"
            state_path.write_text(
                json.dumps({"active_image_id": "sha256:new", "traffic_status": "committed"}),
                encoding="utf-8",
            )
            manifest_path.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "static_root": "/opt/cup-survey-shared/_next/static",
                        "deploys": [
                            {
                                "deploy_id": "d1",
                                "build_id": "b1",
                                "image_id": "sha256:old",
                                "image_ref": "cup-survey-app:r1",
                                "deployed_at": "2026-01-01T00:00:00Z",
                                "retired_at": None,
                                "file_count": 1,
                                "files": ["a.js"],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            ok, _ = check_manifest_deploy_gate(str(state_path), str(manifest_path))
            self.assertFalse(ok)


class RecoveryMatrixTests(unittest.TestCase):
    def test_partial_rollback_classification(self) -> None:
        facts = {
            "journal_exists": True,
            "journal": {"journal_phase": "PREPARED", "target_image_id": "sha256:t"},
            "public_release": "release-old",
            "previous_release": "release-old",
            "snippet_port": 3001,
            "previous_port": 3001,
            "target_port": 3002,
            "state_image_id": "sha256:t",
            "target_image_id": "sha256:t",
            "state": {},
        }
        self.assertEqual(classify_recovery(facts), "PARTIAL_ROLLBACK")


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
