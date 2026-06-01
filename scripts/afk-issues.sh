#!/bin/bash
set -euo pipefail

ENGINE="codex"
REPO="psykeat/slopwareV1"
ISSUE_LIMIT=50
KEEP_RUNS=0
BRANCH_PREFIX="issue-"
ITERATIONS=3
DRY_RUN=0
JSON_OUTPUT=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
RUNS_DIR=".runs"
ISSUE_IDS=()

usage() {
  cat <<EOF
Usage: $0 [engine] [options] [issue-id ...]

Engines:
  codex, --codex, -x   Use Codex (default)
  agy, --agy, -a       Use agy

Options:
  --repo <owner/repo>   GitHub repository to process
  --limit <n>           Max issues to fetch when no issue IDs are given
  --branch-prefix <p>   Prefix for generated branches
  --iterations <n>      Number of agent iterations per issue
  --keep-runs           Preserve run directories on success
  --dry-run             Print planned work and exit without git/gh actions
  --json                Emit NDJSON status events for dry-run and normal runs
  -h, --help            Show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    codex|--codex|-x)
      ENGINE="codex"
      ;;
    agy|--agy|-a)
      ENGINE="agy"
      ;;
    --repo)
      REPO="${2:-}"
      if [ -z "$REPO" ] || [[ "$REPO" == -* ]]; then
        echo "Missing value for --repo" >&2
        exit 1
      fi
      shift
      ;;
    --repo=*)
      REPO="${1#*=}"
      if [ -z "$REPO" ]; then
        echo "Missing value for --repo" >&2
        exit 1
      fi
      ;;
    --limit)
      ISSUE_LIMIT="${2:-}"
      if [ -z "$ISSUE_LIMIT" ] || [[ "$ISSUE_LIMIT" == -* ]]; then
        echo "Missing value for --limit" >&2
        exit 1
      fi
      if ! [[ "$ISSUE_LIMIT" =~ ^[0-9]+$ ]]; then
        echo "Invalid value for --limit: $ISSUE_LIMIT" >&2
        exit 1
      fi
      shift
      ;;
    --limit=*)
      ISSUE_LIMIT="${1#*=}"
      if ! [[ "$ISSUE_LIMIT" =~ ^[0-9]+$ ]]; then
        echo "Invalid value for --limit: $ISSUE_LIMIT" >&2
        exit 1
      fi
      ;;
    --branch-prefix)
      BRANCH_PREFIX="${2:-}"
      if [ -z "$BRANCH_PREFIX" ] || [[ "$BRANCH_PREFIX" == -* ]]; then
        echo "Missing value for --branch-prefix" >&2
        exit 1
      fi
      shift
      ;;
    --branch-prefix=*)
      BRANCH_PREFIX="${1#*=}"
      if [ -z "$BRANCH_PREFIX" ]; then
        echo "Missing value for --branch-prefix" >&2
        exit 1
      fi
      ;;
    --iterations)
      ITERATIONS="${2:-}"
      if [ -z "$ITERATIONS" ] || [[ "$ITERATIONS" == -* ]]; then
        echo "Missing value for --iterations" >&2
        exit 1
      fi
      if ! [[ "$ITERATIONS" =~ ^[0-9]+$ ]] || [ "$ITERATIONS" -lt 1 ]; then
        echo "Invalid value for --iterations: $ITERATIONS" >&2
        exit 1
      fi
      shift
      ;;
    --iterations=*)
      ITERATIONS="${1#*=}"
      if ! [[ "$ITERATIONS" =~ ^[0-9]+$ ]] || [ "$ITERATIONS" -lt 1 ]; then
        echo "Invalid value for --iterations: $ITERATIONS" >&2
        exit 1
      fi
      ;;
    --keep-runs)
      KEEP_RUNS=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --json)
      JSON_OUTPUT=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ "${1#-}" != "$1" ] && ! [[ "$1" =~ ^[0-9]+$ ]]; then
        echo "Unknown option: $1" >&2
        usage
        exit 1
      fi
      ISSUE_IDS+=("$1")
      ;;
  esac
  shift
done

AFK_SCRIPT="afk-$ENGINE.sh"
SCRIPT_NAME="afk-issues"
ENGINE_NAME="$ENGINE"
REPO_NAME="$REPO"
TOTAL_ITERATIONS="$ITERATIONS"

echo "Using engine: $ENGINE"
echo "Using repository: $REPO"
echo "Using branch prefix: $BRANCH_PREFIX"
echo "Using iterations: $ITERATIONS"
echo "Dry run: $DRY_RUN"
echo "JSON output: $JSON_OUTPUT"

if [ "${#ISSUE_IDS[@]}" -gt 0 ]; then
  echo "Using manually provided issue IDs: ${ISSUE_IDS[*]}"
else
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Dry run requires explicit issue IDs."
    exit 1
  fi
  echo "Fetching open issues from $REPO..."
  mapfile -t ISSUE_IDS < <(gh issue list -R "$REPO" --limit "$ISSUE_LIMIT" --json number --jq '.[].number' | sort -n)
fi

if [ "${#ISSUE_IDS[@]}" -eq 0 ]; then
  echo "No open issues found."
  exit 0
fi

# Track successfully processed issues in this run to allow resolving intra-run dependencies
DECLARED_MERGED=""

if [ "$DRY_RUN" -eq 1 ]; then
  mkdir -p "$RUNS_DIR"
  for ID in "${ISSUE_IDS[@]}"; do
    BRANCH_NAME="${BRANCH_PREFIX}${ID}"
    RUN_DIR="$RUNS_DIR/issue-$ID.preview"
    if [ "$JSON_OUTPUT" -eq 1 ]; then
  emit_json_record "dry_run_issue" "$ID" "$BRANCH_NAME" "$RUN_DIR" "" "$ITERATIONS" "planned" "issue planned for dry run" "$REPO"
    else
      echo "DRY RUN: issue #$ID -> branch $BRANCH_NAME -> run dir $RUN_DIR -> iterations $ITERATIONS"
    fi
  done
  emit_json_record "dry_run_complete" "" "" "" "" "$ITERATIONS" "planned" "dry run complete" "$REPO"
  exit 0
fi

# Ensure we start on main and are clean
echo "Ensuring clean main branch..."
emit_status_json "run_start" "" "" "" "running" "starting issue run"
git checkout main
git pull origin main
mkdir -p "$RUNS_DIR"

cleanup_issue_workspace() {
  local branch_name="$1"

  git checkout main >/dev/null 2>&1 || true
  git branch -D "$branch_name" >/dev/null 2>&1 || true
  git reset --hard origin/main >/dev/null 2>&1 || true
}

for ID in "${ISSUE_IDS[@]}"; do
  echo "======= FILTERING ISSUE #$ID ======="
  emit_status_json "issue_filter" "$ID" "" "" "running" "checking issue dependencies"
  
  # Fetch body to check dependencies
  BODY=$(gh issue view "$ID" -R "$REPO" --json body --jq '.body')
  
  # Dependency parsing: Check if body contains "Depends on #<num>"
  # Extracts the dependency ID if present
  DEP_ID=$(echo "$BODY" | grep -o -E "Depends on #[0-9]+" | grep -o -E "[0-9]+" || true)
  
  if [ -n "$DEP_ID" ]; then
    echo "Issue #$ID depends on #$DEP_ID."
    
    # Check if dependency is still open in GitHub
    DEP_STATUS=$(gh issue view "$DEP_ID" -R "$REPO" --json state --jq '.state' 2>/dev/null || echo "CLOSED")
    
    if [ "$DEP_STATUS" = "OPEN" ]; then
      # If the dependency was successfully processed earlier in this session, we can proceed
      if [[ " $DECLARED_MERGED " =~ " $DEP_ID " ]]; then
        echo "Dependency #$DEP_ID was processed in this run. Proceeding."
        emit_status_json "issue_dependency_resolved" "$ID" "" "" "running" "dependency already merged in this run"
      else
        echo "⚠️ Skipping Issue #$ID: Dependency #$DEP_ID is still OPEN and not yet merged."
        emit_status_json "issue_skipped" "$ID" "" "" "skipped" "dependency still open"
        continue
      fi
    else
      echo "Dependency #$DEP_ID is already CLOSED. Proceeding."
    fi
  fi

  echo "======= PROCESSING ISSUE #$ID ======="
  emit_status_json "issue_start" "$ID" "" "" "running" "starting issue processing"
  
  TITLE=$(gh issue view "$ID" -R "$REPO" --json title --jq '.title')
  BRANCH_NAME="${BRANCH_PREFIX}${ID}"
  RUN_DIR=$(mktemp -d "$RUNS_DIR/issue-$ID.XXXXXX")
  
  echo "Creating isolated branch: $BRANCH_NAME"
  git checkout -B "$BRANCH_NAME"

  cat <<EOF > "$RUN_DIR/prompt.md"
# Task Prompt: Issue #$ID

## Title
$TITLE

## Description
$BODY

## Instructions
1. Implement the changes requested in this issue.
2. Use "RALPH: fix #$ID - $TITLE" for commit messages.
3. Run tests and lint checks (pnpm lint) to verify the fix.
4. If you have open questions or design blockers, write them clearly into a file called "$RUN_DIR/blocked.md" and exit with <promise>NO MORE TASKS</promise>.
5. When successfully completed, include <promise>NO MORE TASKS</promise>.
EOF

  executor_args=(
    --run-dir "$RUN_DIR"
    --iterations "$ITERATIONS"
    --prompt-file "$RUN_DIR/prompt.md"
  )
  if [ "$JSON_OUTPUT" -eq 1 ]; then
    executor_args+=(--json)
  fi

  # Execute the autonomous run (with configured iterations)
  if "$SCRIPT_DIR/$AFK_SCRIPT" "${executor_args[@]}"; then
    # Check if agent exited because of a blocker
    if [ -f "$RUN_DIR/blocked.md" ]; then
      BLOCKER_CONTENT=$(cat "$RUN_DIR/blocked.md")
      echo "⚠️ Issue #$ID is BLOCKED. Posting blocker details to GitHub..."
      emit_status_json "issue_blocked" "$ID" "$BRANCH_NAME" "$RUN_DIR" "blocked" "agent reported a blocker"
      gh issue comment "$ID" -R "$REPO" --body "### ⚠️ Autonomous Agent Blocked
The agent encountered the following design/technical blockers:

$BLOCKER_CONTENT"

      echo "Cleaning up workspace and discarding branch..."
      cleanup_issue_workspace "$BRANCH_NAME"
      echo "Run artifacts kept in $RUN_DIR"
    else
      echo "🎉 Issue #$ID completed successfully by $ENGINE. Creating Pull Request..."
      git add .

      if git diff --cached --quiet; then
        echo "❌ Issue #$ID produced no changes. Rolling back..."
        emit_status_json "issue_no_changes" "$ID" "$BRANCH_NAME" "$RUN_DIR" "failed" "agent produced no changes"
        git checkout main
        git branch -D "$BRANCH_NAME" || true
        git reset --hard origin/main
        echo "Run artifacts kept in $RUN_DIR"
      elif git commit -m "RALPH: fix #$ID - $TITLE"; then
        git push origin "$BRANCH_NAME"

        gh pr create -R "$REPO" \
          --title "RALPH: fix #$ID - $TITLE" \
          --body "Automatically completed by Ralph ($ENGINE)." \
          --head "$BRANCH_NAME" \
          --base main

        DECLARED_MERGED="$DECLARED_MERGED $ID"
        emit_status_json "issue_complete" "$ID" "$BRANCH_NAME" "$RUN_DIR" "completed" "pull request created"

        echo "Returning to main..."
        git checkout main
        if [ "$KEEP_RUNS" -eq 1 ]; then
          echo "Run artifacts kept in $RUN_DIR"
        else
          rm -rf "$RUN_DIR"
        fi
      else
        echo "❌ Commit failed for Issue #$ID. Rolling back..."
        emit_status_json "issue_commit_failed" "$ID" "$BRANCH_NAME" "$RUN_DIR" "failed" "commit failed"
        cleanup_issue_workspace "$BRANCH_NAME"
        echo "Run artifacts kept in $RUN_DIR"
      fi
    fi
  else
    echo "❌ Issue #$ID failed or was aborted by $ENGINE. Rolling back..."
    emit_status_json "issue_failed" "$ID" "$BRANCH_NAME" "$RUN_DIR" "failed" "agent returned failure"
    cleanup_issue_workspace "$BRANCH_NAME"
    echo "Run artifacts kept in $RUN_DIR"
  fi
done

echo "All issues processed!"
emit_status_json "run_complete" "" "" "" "done" "issue run complete"
