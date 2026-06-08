#!/bin/bash
set -euo pipefail

RUN_DIR=""
ITERATIONS=""
PROMPT_FILE=""
LOG_FILE=""
SKILL_FILE=""
VERIFY_COMMAND=""
FINAL_REVIEW=0
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
  --skill-file <f>     Optional SKILL.md to prepend to the prompt
  --verify-command <c> Command to run before completion is accepted
  --final-review       Run a final Codex review pass before exiting
  --no-final-review    Skip the final Codex review pass
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

run_verify_command() {
  local command_text="$1"
  local output=""
  local status=0

  echo "  [codex] verifying with: $command_text" | tee -a "$LOG_FILE"
  set +e
  output=$(bash -lc "$command_text" 2>&1)
  status=$?
  set -e
  printf '%s\n' "$output" >> "$LOG_FILE"

  if [ "$status" -ne 0 ]; then
    echo "  [codex] ✗ verification failed with exit code $status" | tee -a "$LOG_FILE"
    emit_simple_json "verification_failed" "failed" "verification command exited with status $status"
    exit "$status"
  fi

  echo "  [codex] ✓ verification passed" | tee -a "$LOG_FILE"
  emit_simple_json "verification_passed" "passed" "verification command succeeded"
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
    --skill-file)
      SKILL_FILE="${2:-}"
      shift
      ;;
    --skill-file=*)
      SKILL_FILE="${1#*=}"
      ;;
    --verify-command)
      VERIFY_COMMAND="${2:-}"
      shift
      ;;
    --verify-command=*)
      VERIFY_COMMAND="${1#*=}"
      ;;
    --final-review)
      FINAL_REVIEW=1
      ;;
    --no-final-review)
      FINAL_REVIEW=0
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
: "${SKILL_FILE:=${AFK_CODEX_SKILL_FILE:-}}"
: "${VERIFY_COMMAND:=${AFK_CODEX_VERIFY_COMMAND:-}}"
if [ "${AFK_CODEX_FINAL_REVIEW:-}" = "1" ]; then
  FINAL_REVIEW=1
fi
if [ -n "$SKILL_FILE" ] && [ "${AFK_CODEX_FINAL_REVIEW:-}" != "0" ]; then
  FINAL_REVIEW=1
fi
TOTAL_ITERATIONS="$ITERATIONS"

if [ -n "$SKILL_FILE" ] && [ ! -r "$SKILL_FILE" ]; then
  echo "Skill file not readable: $SKILL_FILE" >&2
  exit 1
fi

mkdir -p "$RUN_DIR"
: > "$LOG_FILE"

tmpfile=""
eventfile=""
review_tmpfile=""
review_eventfile=""
trap 'rm -f "${tmpfile:-}" "${eventfile:-}" "${review_tmpfile:-}" "${review_eventfile:-}"' EXIT

i=1
while [ "$i" -le "$ITERATIONS" ]; do
  emit_iteration_json "iteration_start" "$i" "running" "starting iteration"
  tmpfile=$(mktemp "$RUN_DIR/codex.XXXXXX")
  eventfile=$(mktemp "$RUN_DIR/codex.events.XXXXXX")
  echo "  [codex] iter $i/$TOTAL_ITERATIONS..." | tee -a "$LOG_FILE"

  ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  # Prepare the full prompt by combining the plan and the commit history
  prompt_content=$(cat "$PROMPT_FILE" 2>/dev/null || echo "# Task Prompt")
  if [ -n "$SKILL_FILE" ]; then
    skill_content=$(cat "$SKILL_FILE")
    full_prompt="Active skill instructions from $SKILL_FILE:
$skill_content

Task prompt:
$prompt_content

Previous RALPH commits:
$ralph_commits"
  else
    full_prompt="$prompt_content

Previous RALPH commits:
$ralph_commits"
  fi

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
      if [ -n "$VERIFY_COMMAND" ]; then
        run_verify_command "$VERIFY_COMMAND"
      fi

      if [ "$FINAL_REVIEW" -eq 1 ]; then
        review_tmpfile=$(mktemp "$RUN_DIR/codex.review.XXXXXX")
        review_eventfile=$(mktemp "$RUN_DIR/codex.review.events.XXXXXX")
        review_diffstat=$(git diff --stat 2>/dev/null || echo "No diff available")
        review_status=$(git status --short 2>/dev/null || echo "No status available")
        review_prompt=$(cat <<EOF
You are performing a final TDD compliance review for this run.

Skill instructions:
$(cat "$SKILL_FILE" 2>/dev/null || echo "No skill file provided.")

Current task prompt:
$(cat "$PROMPT_FILE" 2>/dev/null || echo "# Task Prompt")

Working tree status:
$review_status

Diff stat:
$review_diffstat

Requirements:
- Check whether the implementation followed the TDD skill.
- Check that tests were added or updated for the behavior changes.
- Check for implementation-before-test violations where observable.
- Check for obvious unrefactored duplication or missing coverage.
- If anything important is missing, output <promise>ABORT</promise> and summarize the issue.
- If the result is acceptable, output <promise>NO MORE TASKS</promise>.
EOF
)

        echo "  [codex] running final TDD review..." | tee -a "$LOG_FILE"
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
              -o "$review_tmpfile" \
              "$review_prompt" \
              > "$review_eventfile" \
              2>> "$LOG_FILE"
          review_status_code=$?
        else
          codex exec \
            --json \
            --dangerously-bypass-approvals-and-sandbox \
            --dangerously-bypass-hook-trust \
            -o "$review_tmpfile" \
            "$review_prompt" \
            > "$review_eventfile" \
            2>> "$LOG_FILE"
          review_status_code=$?
        fi
        set -e

        cat "$review_eventfile" >> "$LOG_FILE"
        review_output=$(cat "$review_tmpfile" 2>/dev/null || echo "")

        if [ "$review_status_code" -ne 0 ]; then
            echo "  [codex] ✗ final review failed with exit code $review_status_code" | tee -a "$LOG_FILE"
            printf '%s\n' "$review_output" >> "$LOG_FILE"
            rm -f "$review_tmpfile" "$review_eventfile"
            review_tmpfile=""
            review_eventfile=""
            exit "$review_status_code"
          fi

        case "$review_output" in
          *"<promise>ABORT</promise>"*)
            echo "  [codex] ✗ final TDD review rejected the run" | tee -a "$LOG_FILE"
            printf '%s\n' "$review_output" >> "$LOG_FILE"
            emit_simple_json "final_review_failed" "failed" "final TDD review rejected the run"
            rm -f "$review_tmpfile" "$review_eventfile"
            review_tmpfile=""
            review_eventfile=""
            exit 1
            ;;
          *"<promise>NO MORE TASKS</promise>"*)
            echo "  [codex] ✓ final TDD review passed" | tee -a "$LOG_FILE"
            emit_simple_json "final_review_passed" "passed" "final TDD review accepted the run"
            ;;
          *)
            echo "  [codex] ✗ final TDD review did not return a completion marker" | tee -a "$LOG_FILE"
            printf '%s\n' "$review_output" >> "$LOG_FILE"
            emit_simple_json "final_review_failed" "failed" "final TDD review did not return a completion marker"
            rm -f "$review_tmpfile" "$review_eventfile"
            review_tmpfile=""
            review_eventfile=""
            exit 1
            ;;
        esac
        rm -f "$review_tmpfile" "$review_eventfile"
        review_tmpfile=""
        review_eventfile=""
      fi

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
