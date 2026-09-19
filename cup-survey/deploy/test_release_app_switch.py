#!/usr/bin/env python3
"""Regression tests for release-app image retention and switch behavior."""
from __future__ import annotations

import re
import subprocess
import sys
import unittest
from pathlib import Path

DEPLOY = Path(__file__).parent
ROOT = DEPLOY.parent
RELEASE_APP = DEPLOY / "release-app.sh"
RETENTION_SH = DEPLOY / "release-image-retention.sh"

sys.path.insert(0, str(DEPLOY))
from image_retention import (  # noqa: E402
    anchor_name_for_deploy,
    is_immutable_release_ref,
    resolve_previous_image_ref,
    retained_tag_for_deploy,
    sanitize_deploy_id,
)


class ImageRetentionLogicTests(unittest.TestCase):
    def test_sanitize_deploy_id(self) -> None:
        self.assertEqual(
            sanitize_deploy_id("bootstrap-2026-09-19T05:50:23Z"),
            "bootstrap-2026-09-19T05-50-23Z",
        )

    def test_immutable_release_ref(self) -> None:
        self.assertTrue(is_immutable_release_ref("cup-survey-app:release-20260919T180530Z"))
        self.assertFalse(is_immutable_release_ref("cup-survey-app"))
        self.assertFalse(is_immutable_release_ref("cup-survey-app:current"))

    def test_retained_fallback_tag(self) -> None:
        tag = retained_tag_for_deploy("bootstrap-2026-09-19T05:50:23Z")
        self.assertEqual(tag, "cup-survey-app:retained-bootstrap-2026-09-19T05-50-23Z")

    def test_anchor_name(self) -> None:
        self.assertEqual(
            anchor_name_for_deploy("2026-09-19T18:06:46Z"),
            "cup-survey-retain-2026-09-19T18-06-46Z",
        )

    def test_resolve_previous_ref_prefers_release(self) -> None:
        self.assertEqual(
            resolve_previous_image_ref(
                "cup-survey-app:release-20260919T180530Z",
                "2026-09-19T18:06:46Z",
            ),
            "cup-survey-app:release-20260919T180530Z",
        )

    def test_resolve_previous_ref_legacy_fallback(self) -> None:
        self.assertEqual(
            resolve_previous_image_ref("cup-survey-app", "bootstrap-2026-09-19T05:50:23Z"),
            "cup-survey-app:retained-bootstrap-2026-09-19T05-50-23Z",
        )


class ReleaseAppStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = RELEASE_APP.read_text(encoding="utf-8")
        cls.lines = cls.text.splitlines()
        cls.retention = RETENTION_SH.read_text(encoding="utf-8")

    def _index(self, needle: str) -> int:
        for i, line in enumerate(self.lines):
            if needle in line:
                return i
        raise AssertionError(f"missing: {needle}")

    def test_forward_switch_uses_no_deps(self) -> None:
        self.assertIn(
            'docker compose -f "${COMPOSE_FILE}" up -d --no-build --no-deps --force-recreate app',
            self.text,
        )

    def test_rollback_switch_uses_no_deps(self) -> None:
        self.assertIn(
            'docker compose -f "${COMPOSE_FILE}" up -d --no-build --no-deps --force-recreate app 2>/dev/null || true',
            self.text,
        )

    def test_no_app_up_without_no_deps(self) -> None:
        for line in self.lines:
            if "docker compose" in line and " up " in line and " app" in line:
                self.assertIn("--no-deps", line, msg=line.strip())

    def test_previous_protection_before_build(self) -> None:
        protect = self._index("ensure_previous_image_protected")
        build = self._index('docker compose -f "${COMPOSE_FILE}" build app')
        self.assertLess(protect, build)

    def test_new_release_tag_after_build_before_switch(self) -> None:
        build = self._index('docker compose -f "${COMPOSE_FILE}" build app')
        ensure_new = self._index("ensure_new_release_tag")
        switch = self._index("CONTAINER_SWITCHED=1")
        self.assertLess(build, ensure_new)
        self.assertLess(ensure_new, switch)

    def test_rollback_uses_previous_image_id(self) -> None:
        self.assertIn('docker tag "${PREVIOUS_IMAGE_ID}" cup-survey-app:current', self.text)

    def test_no_docker_prune(self) -> None:
        self.assertNotRegex(self.text, re.compile(r"docker\s+.*prune", re.I))
        self.assertNotRegex(self.retention, re.compile(r"docker\s+.*prune", re.I))

    def test_previous_anchor_created_not_run(self) -> None:
        self.assertIn("docker create", self.retention)
        self.assertNotIn("docker run", self.retention)
        self.assertIn('--restart=no', self.retention)
        self.assertIn('--entrypoint /bin/sh', self.retention)

    def test_anchor_has_no_volumes_or_ports(self) -> None:
        create_block = self.retention[self.retention.index("docker create") :]
        self.assertNotIn("--volume", create_block)
        self.assertNotIn("-v ", create_block)
        self.assertNotIn("-p ", create_block)
        self.assertNotIn("--publish", create_block)

    def test_fail_closed_on_tag_mismatch(self) -> None:
        self.assertIn("fail_closed", self.retention)
        self.assertIn("points to", self.retention)

    def test_fail_closed_on_anchor_mismatch(self) -> None:
        self.assertIn("anchor ${anchor_name} references", self.retention)

    def test_success_does_not_remove_anchor(self) -> None:
        self.assertNotIn("docker rm", self.text)
        self.assertNotIn("docker rmi", self.text)

    def test_manifest_promotion_uses_metadata_image_ref(self) -> None:
        self.assertIn('"image_ref": meta["image_ref"]', self.text)


class ShellSyntaxTests(unittest.TestCase):
    def _bash_n(self, path: Path) -> None:
        proc = subprocess.run(
            ["bash", "-n", path.as_posix()],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        if proc.returncode == 127 and "No such file" in proc.stderr:
            self.skipTest("bash unavailable in this environment")
        self.assertEqual(proc.returncode, 0, proc.stderr)

    def test_bash_syntax_release_app(self) -> None:
        self._bash_n(RELEASE_APP)

    def test_bash_syntax_retention(self) -> None:
        self._bash_n(RETENTION_SH)


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
