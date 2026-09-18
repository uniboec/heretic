#!/usr/bin/env python3
"""Tests for collision-safe merge logic."""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def collision_preflight(src_dir: Path, dest_dir: Path) -> int:
    conflicts = 0
    for src in sorted(src_dir.rglob("*")):
        if not src.is_file():
            continue
        rel = src.relative_to(src_dir)
        dest = dest_dir / rel
        if not dest.exists():
            continue
        if sha256_file(src) != sha256_file(dest):
            conflicts += 1
    return conflicts


def test_same_hash_ok() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        src = root / "src"
        dest = root / "dest"
        src.mkdir()
        dest.mkdir(parents=True)
        (src / "chunks").mkdir()
        (dest / "chunks").mkdir()
        content = b"same content"
        (src / "chunks" / "a.css").write_bytes(content)
        (dest / "chunks" / "a.css").write_bytes(content)
        assert collision_preflight(src, dest) == 0


def test_different_hash_abort() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        src = root / "src"
        dest = root / "dest"
        src.mkdir()
        dest.mkdir(parents=True)
        (src / "chunks").mkdir()
        (dest / "chunks").mkdir()
        (src / "chunks" / "a.css").write_bytes(b"new")
        (dest / "chunks" / "a.css").write_bytes(b"old")
        assert collision_preflight(src, dest) == 1


def test_write_metadata() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        meta = Path(tmp) / "meta.json"
        subprocess.check_call(
            [
                sys.executable,
                str(SCRIPT_DIR / "write-merge-metadata.py"),
                str(meta),
                "build1",
                "sha256:" + "c" * 64,
                "cup-survey-app:release-test",
                "chunks/a.css",
                "chunks/b.js",
            ]
        )
        import json

        data = json.loads(meta.read_text(encoding="utf-8"))
        assert data["file_count"] == 2
        assert len(data["files"]) == 2


def main() -> None:
    test_same_hash_ok()
    test_different_hash_abort()
    test_write_metadata()
    print("test_merge_collision: ALL PASSED")


if __name__ == "__main__":
    main()
