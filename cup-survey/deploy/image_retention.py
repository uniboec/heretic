#!/usr/bin/env python3
"""Pure helpers for Cup Survey rollback image retention."""
from __future__ import annotations

import re
import sys

IMMUTABLE_RELEASE_PREFIX = "cup-survey-app:release-"
RETAINED_TAG_PREFIX = "cup-survey-app:retained-"
ANCHOR_PREFIX = "cup-survey-retain-"

_DOCKER_REF_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$")


def sanitize_deploy_id(deploy_id: str) -> str:
    normalized = deploy_id.replace(":", "-").replace("/", "-").replace(" ", "-")
    cleaned = "".join(ch if ch.isalnum() or ch in "-_." else "-" for ch in normalized)
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    return (cleaned or "unknown")[:128]


def is_immutable_release_ref(image_ref: str) -> bool:
    return image_ref.startswith(IMMUTABLE_RELEASE_PREFIX)


def retained_tag_for_deploy(deploy_id: str) -> str:
    tag = f"{RETAINED_TAG_PREFIX}{sanitize_deploy_id(deploy_id)}"
    _validate_docker_ref(tag.split(":", 1)[1])
    return tag


def anchor_name_for_deploy(deploy_id: str) -> str:
    name = f"{ANCHOR_PREFIX}{sanitize_deploy_id(deploy_id)}"
    _validate_docker_ref(name)
    return name


def resolve_previous_image_ref(image_ref: str, deploy_id: str) -> str:
    if is_immutable_release_ref(image_ref):
        return image_ref
    return retained_tag_for_deploy(deploy_id)


def _validate_docker_ref(ref: str) -> None:
    if not _DOCKER_REF_RE.match(ref):
        raise ValueError(f"invalid docker ref component: {ref}")


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: image_retention.py <command> [args...]", file=sys.stderr)
        return 2
    cmd = sys.argv[1]
    if cmd == "sanitize-deploy-id":
        print(sanitize_deploy_id(sys.argv[2]))
    elif cmd == "resolve-ref":
        print(resolve_previous_image_ref(sys.argv[2], sys.argv[3]))
    elif cmd == "anchor-name":
        print(anchor_name_for_deploy(sys.argv[2]))
    elif cmd == "retained-tag":
        print(retained_tag_for_deploy(sys.argv[2]))
    elif cmd == "is-immutable-release":
        print("yes" if is_immutable_release_ref(sys.argv[2]) else "no")
    else:
        print(f"unknown command: {cmd}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
