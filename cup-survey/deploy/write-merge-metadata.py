#!/usr/bin/env python3
"""Write validated merge metadata JSON for static asset retention."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 5:
        sys.exit("usage: write-merge-metadata.py METADATA_FILE BUILD_ID IMAGE_ID IMAGE_REF [files...]")

    metadata_file = sys.argv[1]
    build_id = sys.argv[2]
    image_id = sys.argv[3]
    image_ref = sys.argv[4]
    files = sys.argv[5:]

    if not build_id:
        sys.exit("build_id empty")
    if not image_id.startswith("sha256:"):
        sys.exit("invalid image_id")
    if not image_ref:
        sys.exit("image_ref empty")
    if not files:
        sys.exit("files empty")
    for rel in files:
        if rel.startswith("/") or ".." in Path(rel).parts:
            sys.exit(f"unsafe path: {rel}")

    meta = {
        "build_id": build_id,
        "image_id": image_id,
        "image_ref": image_ref,
        "file_count": len(files),
        "files": files,
    }

    out_dir = os.path.dirname(metadata_file) or "/tmp"
    fd, tmp = tempfile.mkstemp(dir=out_dir, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, metadata_file)
    except Exception:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise

    with open(metadata_file, encoding="utf-8") as f:
        loaded = json.load(f)
    if loaded != meta:
        sys.exit("metadata re-read mismatch")

    print(f"metadata written: {metadata_file} ({len(files)} files)")


if __name__ == "__main__":
    main()
