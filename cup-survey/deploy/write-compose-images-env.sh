#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT_DIR="${SCRIPT_DIR}"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

"${PYTHON}" - <<'PY'
import json
import os
import subprocess
import sys

sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from atomic_write import atomic_write

app_dir = os.environ["APP_DIR"]
compose_file = os.environ["COMPOSE_FILE"]
env_file = os.environ["PRODUCTION_ENV_FILE"]
images_env = os.environ["COMPOSE_IMAGES_ENV"]
state_path = os.environ["DEPLOY_STATE_FILE"]

blue = green = None
state = None
if os.path.isfile(state_path):
    with open(state_path, encoding="utf-8") as handle:
        state = json.load(handle)
    active = state.get("active_slot", "blue")
    inactive = "green" if active == "blue" else "blue"
    active_image = state.get("active_image", "")
    previous_image = state.get("previous_image", active_image)
    if active == "blue":
        blue, green = active_image, previous_image if inactive == "green" else active_image
    else:
        green, blue = active_image, previous_image if inactive == "blue" else active_image

def inspect_running(slot: str) -> str | None:
    cmd = [
        "docker", "compose",
        "--env-file", env_file,
        "-f", compose_file,
        "ps", "-q", f"app-{slot}",
    ]
    if os.path.isfile(images_env):
        cmd = [
            "docker", "compose",
            "--env-file", env_file,
            "--env-file", images_env,
            "-f", compose_file,
            "ps", "-q", f"app-{slot}",
        ]
    try:
        cid = subprocess.check_output(cmd, text=True).strip().splitlines()
    except subprocess.CalledProcessError:
        return None
    if not cid:
        return None
    ref = subprocess.check_output(
        ["docker", "inspect", "--format", "{{.Config.Image}}", cid[0]], text=True
    ).strip()
    return ref or None

for slot, var in (("blue", "blue"), ("green", "green")):
    running = inspect_running(slot)
    if slot == "blue" and blue is None and running:
        blue = running
    if slot == "green" and green is None and running:
        green = running

target_slot = os.environ.get("DEPLOY_TARGET_SLOT")
target_image = os.environ.get("DEPLOY_TARGET_IMAGE")
if target_slot == "blue" and target_image:
    blue = target_image
elif target_slot == "green" and target_image:
    green = target_image

if not blue:
    blue = os.environ.get("CUP_BLUE_IMAGE", "cup-survey-app:current")
if not green:
    green = os.environ.get("CUP_GREEN_IMAGE", blue)

content = f"CUP_BLUE_IMAGE={blue}\nCUP_GREEN_IMAGE={green}\n"
atomic_write(images_env, content)
print(f"compose-images.env written blue={blue} green={green}")
PY
