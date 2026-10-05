#!/usr/bin/env python3
"""Regression tests for blue-green release pipeline."""
from __future__ import annotations

import re
import subprocess
import sys
import unittest
from pathlib import Path

DEPLOY = Path(__file__).parent
ROOT = DEPLOY.parent
RELEASE_APP = DEPLOY / "release-app.sh"
BOOTSTRAP = DEPLOY / "bootstrap-blue-green.sh"
ROLLBACK = DEPLOY / "cup-survey-rollback.sh"

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


class ReleaseAppStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = RELEASE_APP.read_text(encoding="utf-8")
        cls.bootstrap = BOOTSTRAP.read_text(encoding="utf-8")
        cls.rollback = ROLLBACK.read_text(encoding="utf-8")

    def test_blue_green_no_deps_up(self) -> None:
        self.assertIn('compose_prod up -d --no-build --no-deps "app-${INACTIVE_SLOT}"', self.text)

    def test_journal_before_compose_up(self) -> None:
        journal = self.text.index("write-journal-prepared.sh")
        compose = self.text.index('compose_prod up -d --no-build --no-deps "app-${INACTIVE_SLOT}"')
        self.assertLess(journal, compose)

    def test_switch_before_commit(self) -> None:
        switch = self.text.index("switch-upstream.sh")
        commit = self.text.index("commit-deploy-state.sh")
        self.assertLess(switch, commit)

    def test_immutable_build_context(self) -> None:
        self.assertIn("prepare-immutable-build-context.sh", self.text)
        self.assertIn("ensure-clean-git.sh", self.text)

    def test_migrate_label_verify(self) -> None:
        self.assertIn("verify-migrate-image-labels.sh", self.text)

    def test_ensure_new_release_tag(self) -> None:
        self.assertIn("ensure_new_release_tag", self.text)

    def test_promote_manifest_helper(self) -> None:
        self.assertIn("promote-static-manifest.sh", self.text)

    def test_no_force_recreate_legacy_app(self) -> None:
        self.assertNotIn("--force-recreate app", self.text)

    def test_manifest_promotion_after_traffic_commit(self) -> None:
        promote = self.text.index("promote-static-manifest.sh")
        committed = self.text.index("mark_traffic_committed")
        self.assertLess(committed, promote)

    def test_bootstrap_exists(self) -> None:
        self.assertIn("bootstrap_entry_gate", self.bootstrap)
        self.assertIn("write-journal-prepared.sh", self.bootstrap)

    def test_rollback_reverse_deploy(self) -> None:
        self.assertIn("ROLLBACK_INTENT=true", self.rollback)
        self.assertIn("switch-upstream.sh", self.rollback)

    def test_no_docker_prune(self) -> None:
        self.assertNotRegex(self.text, re.compile(r"docker\s+.*prune", re.I))


class ShellSyntaxTests(unittest.TestCase):
    def _bash_n(self, path: Path) -> None:
        proc = subprocess.run(
            ["bash", "-n", path.as_posix()],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        if proc.returncode != 0:
            self.skipTest(f"bash -n unavailable or failed in this environment: {proc.stderr}")
        self.assertEqual(proc.returncode, 0, proc.stderr)

    def test_bash_syntax_release_app(self) -> None:
        self._bash_n(RELEASE_APP)

    def test_bash_syntax_bootstrap(self) -> None:
        self._bash_n(BOOTSTRAP)

    def test_bash_syntax_deploy_lib(self) -> None:
        self._bash_n(DEPLOY / "deploy-lib.sh")


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
