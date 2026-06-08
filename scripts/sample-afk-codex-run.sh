#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AFK_CODEX="$SCRIPT_DIR/afk-codex.sh"
SKILL_FILE="$REPO_ROOT/.agents/skills/tdd/SKILL.md"

if [ ! -x "$AFK_CODEX" ]; then
  echo "Missing executable: $AFK_CODEX" >&2
  exit 1
fi

if [ ! -r "$SKILL_FILE" ]; then
  echo "Missing readable skill file: $SKILL_FILE" >&2
  exit 1
fi

tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/afk-codex-sample.XXXXXX")"
worktree="$tmp_root/worktree"
run_dir="$tmp_root/run"
prompt_file="$run_dir/prompt.md"

cleanup() {
  cd "$REPO_ROOT"
  if [ -d "$worktree" ] && git -C "$REPO_ROOT" worktree list --porcelain | grep -q "worktree $worktree"; then
    git -C "$REPO_ROOT" worktree remove --force "$worktree" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_root"
}

trap cleanup EXIT

git -C "$REPO_ROOT" worktree add --detach "$worktree" HEAD >/dev/null
mkdir -p "$run_dir"

cat > "$prompt_file" <<'EOF'
This is a non-destructive smoke test for afk-codex.

Rules:
- Do not modify any files.
- Do not add commits.
- Finish by outputting <promise>NO MORE TASKS</promise>.
EOF

echo "Running sample afk-codex session in: $worktree"
echo "Run dir: $run_dir"
echo "Prompt: $prompt_file"

cd "$worktree"
"$AFK_CODEX" \
  --run-dir "$run_dir" \
  --iterations 1 \
  --prompt-file "$prompt_file" \
  --skill-file "$SKILL_FILE" \
  --verify-command 'git diff --quiet && git diff --cached --quiet' \
  --final-review \
  --json
