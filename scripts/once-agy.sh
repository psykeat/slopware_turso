#!/bin/bash
set -euo pipefail

RUN_DIR=""
PROMPT_FILE=""
LOG_FILE=""
JSON_OUTPUT=0
POSITIONAL=()
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
SCRIPT_NAME="once-agy"
ENGINE_NAME="agy"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --run-dir <dir>      Run workspace directory
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

if [ -z "$RUN_DIR" ]; then
  echo "Usage: $0 [options]"
  exit 1
fi

# Fetches recent commits to provide context and runs agy once in print mode
ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

# Run agy once
emit_simple_json "run_start" "running" "starting single run"
: "${PROMPT_FILE:=$RUN_DIR/prompt.md}"
: "${LOG_FILE:=$RUN_DIR/agy.log}"
mkdir -p "$RUN_DIR"
: > "$LOG_FILE"
prompt_content=$(cat "$PROMPT_FILE" 2>/dev/null || echo "# Task Prompt")
output=$(agy --print --dangerously-skip-permissions "$prompt_content

Previous RALPH commits:
$ralph_commits" 2>&1)
printf '%s\n' "$output" | tee -a "$LOG_FILE"
emit_simple_json "run_complete" "done" "single run complete"
