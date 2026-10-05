#!/usr/bin/env bash
# Core deploy library: trap, state, image identity, slots.

# shellcheck source=common.sh
source "${DEPLOY_SCRIPT_DIR}/common.sh"
# shellcheck source=slot-utils.sh
source "${DEPLOY_SCRIPT_DIR}/slot-utils.sh"

init_deploy_trap_vars() {
  CANDIDATE_IMAGE_ID="${CANDIDATE_IMAGE_ID:-}"
  CUP_RELEASE_TAG="${CUP_RELEASE_TAG:-}"
  DEPLOY_PHASE="INIT"
  ROLLBACK_IN_PROGRESS=0
  TRANSACTION_STARTED=0
  TARGET_IMAGE_REF="${TARGET_IMAGE_REF:-}"
  EXPECTED_GIT_SHA="${EXPECTED_GIT_SHA:-}"
  ACTIVE_SLOT=""
  INACTIVE_SLOT=""
  PREVIOUS_IMAGE=""
  PREVIOUS_IMAGE_ID=""
  TARGET_PORT=""
  PREVIOUS_PORT=""
  METADATA_FILE=""
}

_acquire_lock_fd=0
acquire_deploy_lock() {
  exec {_acquire_lock_fd}>"${DEPLOY_LOCK_FILE}"
  flock -n "${_acquire_lock_fd}" || abort "another deploy is running"
}

release_deploy_lock() {
  flock -u "${_acquire_lock_fd}" 2>/dev/null || true
}

journal_exists() {
  [[ -f "${JOURNAL_FILE}" ]]
}

journal_field() {
  "${PYTHON}" "${DEPLOY_SCRIPT_DIR}/state_ops.py" journal-get "${JOURNAL_FILE}" "$1"
}

get_traffic_status() {
  if [[ ! -f "${DEPLOY_STATE_FILE}" ]]; then
    echo "UNKNOWN"
    return 0
  fi
  local status
  status="$(journal_field_from_state traffic_status)"
  if [[ -z "${status}" ]]; then
    echo "UNKNOWN"
  else
    echo "${status}"
  fi
}

journal_field_from_state() {
  local field="$1"
  FIELD="${field}" "${PYTHON}" - <<'PY'
import json, os
with open(os.environ["DEPLOY_STATE_FILE"], encoding="utf-8") as f:
    data = json.load(f)
print(data.get(os.environ["FIELD"], "") or "")
PY
}

is_current_deploy_committed() {
  [[ -f "${DEPLOY_STATE_FILE}" ]] || return 1
  [[ -n "${CANDIDATE_IMAGE_ID}" ]] || return 1
  local state_image_id state_traffic
  state_traffic="$(journal_field_from_state traffic_status)"
  [[ "${state_traffic}" == "committed" ]] || return 1
  state_image_id="$(journal_field_from_state active_image_id)"
  [[ "${state_image_id}" == "${CANDIDATE_IMAGE_ID}" ]]
}

is_rollback_window_open() {
  is_current_deploy_committed && return 1
  if [[ ! -f "${DEPLOY_STATE_FILE}" ]]; then
    if journal_exists && [[ "$(journal_field previous_state_existed)" == "false" ]]; then
      return 0
    fi
    return 1
  fi
  case "$(get_traffic_status)" in
    observing) return 0 ;;
    committed) return 0 ;;
    *) return 1 ;;
  esac
}

get_public_release_id() {
  curl -fsS --max-time 15 "${PUBLIC_BASE_URL}/api/build-info" 2>/dev/null \
    | "${PYTHON}" -c 'import json,sys; print(json.load(sys.stdin).get("releaseId",""))' 2>/dev/null || true
}

recover_partial_rollback() {
  local public_release snippet_port state_image_id target_image_id previous_image previous_release
  [[ -f "${DEPLOY_STATE_FILE}" ]] || return 1
  public_release="$(get_public_release_id)"
  snippet_port="$("${PYTHON}" "${DEPLOY_SCRIPT_DIR}/state_ops.py" read-upstream-port "${UPSTREAM_SNIPPET}")"
  target_image_id="$(journal_field target_image_id)"
  state_image_id="$(journal_field_from_state active_image_id 2>/dev/null || echo "")"
  previous_image="$(journal_field previous_image)"
  previous_release="$(docker image inspect --format '{{index .Config.Labels "cup.release_id"}}' "${previous_image}" 2>/dev/null || true)"
  [[ -n "${public_release}" && -n "${previous_release}" && "${public_release}" == "${previous_release}" ]] || return 1
  [[ "${snippet_port}" == "$(journal_field previous_port)" ]] || return 1
  [[ "${state_image_id}" == "${target_image_id}" ]] || return 1
  "${PYTHON}" - <<'PY'
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import load, restore_snapshot
journal = load(os.environ["JOURNAL_FILE"])
snapshot = journal.get("previous_deploy_state_snapshot")
if not snapshot:
    raise SystemExit("partial rollback: snapshot missing")
restore_snapshot(os.environ["DEPLOY_STATE_FILE"], snapshot)
PY
  "${DEPLOY_SCRIPT_DIR}/write-compose-images-env.sh"
  close_pending_journal
  echo "recover: partial rollback state restored"
  return 0
}

read_image_identity_from_labels() {
  local ref="$1"
  EXPECTED_RELEASE_ID="$(docker image inspect --format '{{index .Config.Labels "cup.release_id"}}' "${ref}")"
  EXPECTED_GIT_SHA="$(docker image inspect --format '{{index .Config.Labels "cup.git_sha"}}' "${ref}")"
  [[ -n "${EXPECTED_RELEASE_ID}" && -n "${EXPECTED_GIT_SHA}" ]] || abort "missing OCI labels on ${ref}"
}

resolve_previous_image_ref() {
  local tag="${PREVIOUS_IMAGE}" id="${PREVIOUS_IMAGE_ID}"
  if docker image inspect "${tag}" >/dev/null 2>&1; then
    local tag_id
    tag_id="$(docker image inspect --format '{{.Id}}' "${tag}")"
    if [[ "${tag_id}" == "${id}" ]]; then
      echo "${tag}"
      return 0
    fi
  fi
  if docker image inspect "${id}" >/dev/null 2>&1; then
    local rollback_tag="cup-survey-rollback:${id#sha256:}"
    rollback_tag="${rollback_tag:0:32}"
    docker tag "${id}" "${rollback_tag}"
    echo "${rollback_tag}"
    return 0
  fi
  abort "previous image ${id} not available locally"
}

resolve_target_image_ref_from_journal() {
  local id ref ref_id tmp
  id="$(journal_field target_image_id)"
  ref="$(journal_field target_image_ref)"
  if docker image inspect "${ref}" >/dev/null 2>&1; then
    ref_id="$(docker image inspect --format '{{.Id}}' "${ref}")"
    if [[ "${ref_id}" == "${id}" ]]; then
      echo "${ref}"
      return 0
    fi
  fi
  if docker image inspect "${id}" >/dev/null 2>&1; then
    tmp="cup-survey-recovery:${id#sha256:}"
    docker tag "${id}" "${tmp}"
    echo "${tmp}"
    return 0
  fi
  abort "target image ${id} not available locally"
}

verify_journal_target_image_identity() {
  local resolved_id label_release label_sha
  local expected_id expected_release expected_sha
  expected_id="$(journal_field target_image_id)"
  expected_release="$(journal_field target_release_id)"
  expected_sha="$(journal_field target_git_sha)"
  resolved_id="$(docker image inspect --format '{{.Id}}' "${TARGET_IMAGE_REF}")"
  [[ "${resolved_id}" == "${expected_id}" ]] || abort "target_image_id mismatch on resume"
  label_release="$(docker image inspect --format '{{index .Config.Labels "cup.release_id"}}' "${TARGET_IMAGE_REF}")"
  label_sha="$(docker image inspect --format '{{index .Config.Labels "cup.git_sha"}}' "${TARGET_IMAGE_REF}")"
  [[ "${label_release}" == "${expected_release}" ]] || abort "target_release_id label mismatch"
  [[ "${label_sha}" == "${expected_sha}" ]] || abort "target_git_sha label mismatch"
}

restore_transaction_runtime_context() {
  TRANSACTION_STARTED=1
  CANDIDATE_IMAGE_ID="$(journal_field target_image_id)"
  TARGET_IMAGE_REF="$(resolve_target_image_ref_from_journal)"
  verify_journal_target_image_identity
  CUP_RELEASE_TAG="$(journal_field target_release_id)"
  EXPECTED_GIT_SHA="$(journal_field target_git_sha)"
  INACTIVE_SLOT="$(journal_field target_slot)"
  ACTIVE_SLOT="$(journal_field previous_slot)"
  TARGET_PORT="$(journal_field target_port)"
  PREVIOUS_PORT="$(journal_field previous_port)"
  DEPLOY_PHASE="$(infer_deploy_phase_from_journal)"
}

infer_deploy_phase_from_journal() {
  local phase public_port snippet_port
  phase="$(journal_field journal_phase)"
  snippet_port="$("${PYTHON}" "${DEPLOY_SCRIPT_DIR}/state_ops.py" read-upstream-port "${UPSTREAM_SNIPPET}")"
  TARGET_PORT="$(journal_field target_port)"
  case "${phase}" in
    PREPARED)
      if [[ "${snippet_port}" == "${TARGET_PORT}" ]]; then
        echo "SWITCHED"
      else
        echo "STARTED"
      fi
      ;;
    STATE_COMMITTED) echo "COMMITTED" ;;
    VERIFIED) echo "OBSERVING" ;;
    *) echo "INIT" ;;
  esac
}

print_recovery_diagnostics() {
  "${PYTHON}" "${DEPLOY_SCRIPT_DIR}/recovery_matrix.py" diagnose 2>/dev/null || true
}

delete_prepared_journal_if_exists() {
  if journal_exists && [[ "$(journal_field journal_phase)" == "PREPARED" ]]; then
    rm -f "${JOURNAL_FILE}"
  fi
}

mark_journal_cleanup_failed() {
  echo "journal cleanup failed exit=$1" >&2
}

mark_journal_rollback_failed() {
  echo "journal rollback failed exit=$1" >&2
}

mark_recovery_required() {
  echo "RECOVERY_REQUIRED exit=$1" >&2
}

mark_cleanup_failed() {
  "${PYTHON}" - <<PY
import os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import mark_cleanup_failed
mark_cleanup_failed(os.environ["DEPLOY_STATE_FILE"])
PY
}

rollback_traffic_to_previous() {
  local target_port previous_port
  target_port="$(journal_field target_port)"
  previous_port="$(journal_field previous_port)"
  INACTIVE_SLOT="$(journal_field target_slot)"
  local public_port
  public_port="$("${PYTHON}" "${DEPLOY_SCRIPT_DIR}/state_ops.py" read-upstream-port "${UPSTREAM_SNIPPET}")"
  if [[ "${public_port}" != "${previous_port}" ]]; then
    "${DEPLOY_SCRIPT_DIR}/switch-upstream.sh" "${previous_port}" || return 1
  fi
  stop_inactive_slot || return 1
  verify_inactive_slot_stopped || return 1
  if [[ "$(journal_field previous_state_existed)" == "false" ]]; then
    rm -f "${DEPLOY_STATE_FILE}" "${COMPOSE_IMAGES_ENV}"
  elif [[ -f "${JOURNAL_FILE}" ]]; then
    "${PYTHON}" - <<'PY'
import json, os, sys
sys.path.insert(0, os.environ["DEPLOY_SCRIPT_DIR"])
from state_ops import load, restore_snapshot, save
journal = load(os.environ["JOURNAL_FILE"])
snapshot = journal.get("previous_deploy_state_snapshot")
if snapshot:
    restore_snapshot(os.environ["DEPLOY_STATE_FILE"], snapshot)
PY
    "${DEPLOY_SCRIPT_DIR}/write-compose-images-env.sh"
  fi
  return 0
}

close_pending_journal() {
  rm -f "${JOURNAL_FILE}"
}

rollback_on_err() {
  local exit_code="$1"
  [[ "${ROLLBACK_IN_PROGRESS}" -eq 1 ]] && exit "${exit_code}"
  ROLLBACK_IN_PROGRESS=1
  trap - ERR INT TERM
  set +e

  if [[ "${TRANSACTION_STARTED}" -ne 1 ]]; then
    exit "${exit_code}"
  fi

  if is_current_deploy_committed; then
    mark_cleanup_failed "${exit_code}"
    exit "${exit_code}"
  fi

  if ! is_rollback_window_open; then
    mark_recovery_required "${exit_code}"
    print_recovery_diagnostics >&2
    exit "${exit_code}"
  fi

  case "${DEPLOY_PHASE}" in
    STARTED)
      INACTIVE_SLOT="${INACTIVE_SLOT:-$(journal_field target_slot 2>/dev/null || true)}"
      if stop_inactive_slot && verify_inactive_slot_stopped; then
        delete_prepared_journal_if_exists
      else
        mark_journal_cleanup_failed "${exit_code}"
      fi
      ;;
    SWITCHING|SWITCHED|COMMITTED|VERIFIED|OBSERVING)
      if rollback_traffic_to_previous; then
        close_pending_journal
      else
        mark_journal_rollback_failed "${exit_code}"
      fi
      ;;
    CLEANUP)
      mark_cleanup_failed "${exit_code}"
      ;;
  esac
  exit "${exit_code}"
}

install_deploy_traps() {
  trap 'rollback_on_err $?' ERR
  trap 'rollback_on_err 130' INT
  trap 'rollback_on_err 143' TERM
}
