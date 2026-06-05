#!/bin/bash
set -euo pipefail

RUN_DIR=""
ITERATIONS=""
PROMPT_FILE=""
LOG_FILE=""
JSON_OUTPUT=0
POSITIONAL=()
CODEX_TIMEOUT_SECONDS="${CODEX_TIMEOUT_SECONDS:-3600}"
CODEX_KILL_AFTER_SECONDS="${CODEX_KILL_AFTER_SECONDS:-30}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
SCRIPT_NAME="afk-codex"
ENGINE_NAME="codex"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --run-dir <dir>      Run workspace directory
  --iterations <n>     Number of agent iterations
  --prompt-file <f>    Prompt file to read
  --log-file <f>       Log file to append to
  --json               Emit NDJSON status events
  -h, --help           Show this help
EOF
}

is_terminal_codex_failure() {
  local path="$1"

  grep -qiE 'token_invalidated|authentication token has been invalidated|Please try signing in again|workspace is out of credits|out of credits|Selected model is at capacity|model is at capacity|Please try a different model' "$path" 2>/dev/null
}

codex_failure_reason() {
  local path="$1"

  grep -Eim1 'token_invalidated|authentication token has been invalidated|Please try signing in again|workspace is out of credits|out of credits|Selected model is at capacity|model is at capacity|Please try a different model' "$path" 2>/dev/null || true
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --run-dir)
      RUN_DIR="${2:-}"
      shift
      ;;
    --run-dir=*)
      RUN_DIR="${1#*=}"
      ;;
    --iterations)
      ITERATIONS="${2:-}"
      shift
      ;;
    --iterations=*)
      ITERATIONS="${1#*=}"
      ;;
    --prompt-file)
      PROMPT_FILE="${2:-}"
      shift
      ;;
    --prompt-file=*)
      PROMPT_FILE="${1#*=}"
      ;;
    --log-file)
      LOG_FILE="${2:-}"
      shift
      ;;
    --log-file=*)
      LOG_FILE="${1#*=}"
      ;;
    --json)
      JSON_OUTPUT=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      POSITIONAL+=("$1")
      ;;
  esac
  shift
done

if [ -z "$RUN_DIR" ] && [ "${#POSITIONAL[@]}" -ge 1 ]; then
  RUN_DIR="${POSITIONAL[0]}"
fi
if [ -z "$ITERATIONS" ] && [ "${#POSITIONAL[@]}" -ge 2 ]; then
  ITERATIONS="${POSITIONAL[1]}"
fi

if [ -z "$RUN_DIR" ] || [ -z "$ITERATIONS" ]; then
  echo "Usage: $0 [options]"
  exit 1
fi

: "${PROMPT_FILE:=$RUN_DIR/prompt.md}"
: "${LOG_FILE:=$RUN_DIR/codex.log}"
TOTAL_ITERATIONS="$ITERATIONS"

mkdir -p "$RUN_DIR"
: > "$LOG_FILE"

tmpfile=""
eventfile=""
trap 'rm -f "${tmpfile:-}" "${eventfile:-}"' EXIT

i=1
while [ "$i" -le "$ITERATIONS" ]; do
  emit_iteration_json "iteration_start" "$i" "running" "starting iteration"
  tmpfile=$(mktemp "$RUN_DIR/codex.XXXXXX")
  eventfile=$(mktemp "$RUN_DIR/codex.events.XXXXXX")
  echo "  [codex] iter $i/$TOTAL_ITERATIONS..." | tee -a "$LOG_FILE"

  ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  # Prepare the full prompt by combining the plan and the commit history
  prompt_content=$(cat "$PROMPT_FILE" 2>/dev/null || echo "# Task Prompt")
  full_prompt="$prompt_content

Previous RALPH commits:
$ralph_commits"

  # Run Codex non-interactively in YOLO mode
  set +e
  if command -v timeout >/dev/null 2>&1; then
    timeout \
      --foreground \
      --signal=TERM \
      --kill-after="${CODEX_KILL_AFTER_SECONDS}s" \
      "${CODEX_TIMEOUT_SECONDS}s" \
      codex exec \
        --json \
        --dangerously-bypass-approvals-and-sandbox \
        --dangerously-bypass-hook-trust \
        -o "$tmpfile" \
        "$full_prompt" \
        > "$eventfile" \
        2>> "$LOG_FILE"
    run_status=$?
  else
    codex exec \
      --json \
      --dangerously-bypass-approvals-and-sandbox \
      --dangerously-bypass-hook-trust \
      -o "$tmpfile" \
      "$full_prompt" \
      > "$eventfile" \
      2>> "$LOG_FILE"
    run_status=$?
  fi
  set -e

  cat "$eventfile" >> "$LOG_FILE"

  if [ "$run_status" -ne 0 ]; then
    output=$(cat "$tmpfile" 2>/dev/null || echo "")
    printf '%s\n' "$output" >> "$LOG_FILE"
    reason=$(jq -r 'select(.type=="item.completed" and .item.type=="error") | .item.message' "$eventfile" 2>/dev/null | tail -n 1 || true)
    if [ -z "$reason" ] && is_terminal_codex_failure "$LOG_FILE"; then
      reason=$(codex_failure_reason "$LOG_FILE")
    fi
    if [ -z "$reason" ] && is_terminal_codex_failure "$tmpfile"; then
      reason=$(codex_failure_reason "$tmpfile")
    fi
    if [ -n "$reason" ]; then
      echo "  [codex] ✗ $reason" | tee -a "$LOG_FILE"
      emit_iteration_json "iteration_failed" "$i" "failed" "$reason"
      exit 2
    fi
    if [ "$run_status" -eq 124 ]; then
      echo "  [codex] ✗ iter $i timed out after ${CODEX_TIMEOUT_SECONDS}s" | tee -a "$LOG_FILE"
      emit_iteration_json "iteration_failed" "$i" "failed" "codex exec timed out after ${CODEX_TIMEOUT_SECONDS}s"
      exit 2
    fi
    echo "  [codex] ✗ iter $i failed with exit code $run_status" | tee -a "$LOG_FILE"
    if [ -n "$output" ]; then
      echo "  [codex] last output:" | tee -a "$LOG_FILE"
      printf '%s\n' "$output" | tail -n 40 | tee -a "$LOG_FILE"
    fi
    emit_iteration_json "iteration_failed" "$i" "failed" "codex exec exited with status $run_status"
    exit "$run_status"
  fi

  # Read the final message from Codex to inspect for stop tags
  output=$(cat "$tmpfile" 2>/dev/null || echo "")

  case "$output" in
    *"<promise>NO MORE TASKS</promise>"*)
      echo "  [codex] ✓ done after $i iterations" | tee -a "$LOG_FILE"
      emit_iteration_json "run_complete" "$i" "done" "completion marker found"
      exit 0
      ;;
    *"<promise>ABORT</promise>"*)
      echo "  [codex] ✗ aborted after $i iterations" | tee -a "$LOG_FILE"
      emit_iteration_json "run_aborted" "$i" "aborted" "abort marker found"
      exit 1
      ;;
  esac

  rm -f "$tmpfile"
  tmpfile=""
  emit_iteration_json "iteration_complete" "$i" "running" "iteration completed without completion marker"
  i=$((i + 1))
done

echo "  [codex] ✗ iteration limit reached ($ITERATIONS)" | tee -a "$LOG_FILE"
emit_iteration_json "iteration_limit" "$ITERATIONS" "failed" "iteration limit reached without completion"
exit 1
