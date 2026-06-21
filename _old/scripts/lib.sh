#!/bin/bash

json_escape() {
  printf '%s' "$1" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' \
    -e 's/\r/\\r/g' \
    -e 's/\t/\\t/g' \
    -e ':a;N;$!ba;s/\n/\\n/g'
}

json_string_or_null() {
  if [ -n "${1:-}" ]; then
    printf '"%s"' "$(json_escape "$1")"
  else
    printf 'null'
  fi
}

json_number_or_null() {
  if [ -n "${1:-}" ]; then
    printf '%s' "$1"
  else
    printf 'null'
  fi
}

emit_json_record() {
  [ "${JSON_OUTPUT:-0}" -eq 1 ] || return 0

  local event="${1:-}"
  local issue_id="${2:-}"
  local branch_name="${3:-}"
  local run_dir="${4:-}"
  local iteration="${5:-}"
  local iterations="${6:-${TOTAL_ITERATIONS:-}}"
  local status="${7:-}"
  local message="${8:-}"
  local repo="${9:-${REPO_NAME:-}}"

  printf '{"event":%s' "$(json_string_or_null "$event")"
  printf ',"script":%s' "$(json_string_or_null "${SCRIPT_NAME:-}")"
  printf ',"engine":%s' "$(json_string_or_null "${ENGINE_NAME:-}")"
  printf ',"issue_id":%s' "$(json_number_or_null "$issue_id")"
  printf ',"branch":%s' "$(json_string_or_null "$branch_name")"
  printf ',"run_dir":%s' "$(json_string_or_null "$run_dir")"
  printf ',"iteration":%s' "$(json_number_or_null "$iteration")"
  printf ',"iterations":%s' "$(json_number_or_null "$iterations")"
  printf ',"status":%s' "$(json_string_or_null "$status")"
  printf ',"message":%s' "$(json_string_or_null "$message")"
  printf ',"repo":%s' "$(json_string_or_null "$repo")"
  printf '}\n'
}

emit_status_json() {
  emit_json_record "$1" "$2" "$3" "$4" "" "" "$5" "$6"
}

emit_iteration_json() {
  emit_json_record "$1" "" "" "" "$2" "" "$3" "$4"
}

emit_simple_json() {
  emit_json_record "$1" "" "" "" "" "" "$2" "$3"
}
