#!/usr/bin/env python3
"""Durable write: temp file → fsync → atomic replace → fsync parent dir."""
from __future__ import annotations

import os
import sys
import tempfile


def atomic_write(path: str, content: str | bytes, mode: str = "w") -> None:
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    binary = "b" in mode
    data = content.encode("utf-8") if isinstance(content, str) and binary else content
    fd, tmp_path = tempfile.mkstemp(prefix=".atomic-", dir=directory)
    try:
        with os.fdopen(fd, mode) as handle:
            handle.write(data)  # type: ignore[arg-type]
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, path)
        dir_fd = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: atomic_write.py <path> <content-file|-", file=sys.stderr)
        return 2
    dest, src = sys.argv[1], sys.argv[2]
    if src == "-":
        payload = sys.stdin.read()
    else:
        with open(src, encoding="utf-8") as handle:
            payload = handle.read()
    atomic_write(dest, payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
