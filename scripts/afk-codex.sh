#!/bin/bash
set -euo pipefail

RUN_DIR=""
ITERATIONS=""
PROMPT_FILE=""
LOG_FILE=""
JSON_OUTPUT=0
POSITIONAL=()
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
trap 'rm -f "${tmpfile:-}"' EXIT

i=1
while [ "$i" -le "$ITERATIONS" ]; do
  emit_iteration_json "iteration_start" "$i" "running" "starting iteration"
  tmpfile=$(mktemp "$RUN_DIR/codex.XXXXXX")
  echo "  [codex] iter $i/$TOTAL_ITERATIONS..." | tee -a "$LOG_FILE"

  ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  # Prepare the full prompt by combining the plan and the commit history
  prompt_content=$(cat "$PROMPT_FILE" 2>/dev/null || echo "# Task Prompt")
  full_prompt="$prompt_content

Previous RALPH commits:
$ralph_commits"

  # Run Codex non-interactively in YOLO mode
  codex exec \
    --dangerously-bypass-approvals-and-sandbox \
    --dangerously-bypass-hook-trust \
    -o "$tmpfile" \
    "$full_prompt" >> "$LOG_FILE" 2>&1

  # Read the final message from Codex to inspect for stop tags
  output=$(cat "$tmpfile" 2>/dev/null || echo "")
  printf '%s\n' "$output" >> "$LOG_FILE"

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
