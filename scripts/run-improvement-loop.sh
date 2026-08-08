#!/usr/bin/env bash
set -uo pipefail
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
REPO="$HOME/workspace/languagebuilder"
BRANCH=agent-improvements-2026-08-08
PLAN="$REPO/IMPROVEMENT_PLAN.md"
LOG_DIR="$REPO/.agent-loop-logs"
MAX_ITERATIONS=30
mkdir -p "$LOG_DIR"
cd "$REPO"
git checkout "$BRANCH"
EXEC_PROMPT="In $REPO, checkout branch $BRANCH (it should already exist - do not create it fresh, do not touch main). Read IMPROVEMENT_PLAN.md. Find the first unchecked [ ] task. Complete it fully. Verify it exactly per its Verify: line. Check its box in IMPROVEMENT_PLAN.md. Commit your change on this branch with a clear message referencing the task. Then stop - do not start another task in this session."
count_unchecked() { grep -c '^- \[ \]' "$PLAN" 2>/dev/null || echo 0; }
NODE_BIN="$HOME/.nvm/versions/node/v24.19.0/bin/node"
PRIME_CLI="$HOME/.nvm/versions/node/v24.19.0/lib/node_modules/prime-agent/dist/bundle/cli.js"
i=0
while [ "$i" -lt "$MAX_ITERATIONS" ]; do
  unchecked=$(count_unchecked)
  if [ "$unchecked" -eq 0 ]; then
    echo "No unchecked tasks remain. Done after $i iteration(s)."
    break
  fi
  i=$((i+1))
  echo "=== ITERATION $i: $unchecked unchecked task(s) remaining ==="
  "$NODE_BIN" "$PRIME_CLI" -p "$EXEC_PROMPT" --mode json --cwd "$REPO" > "$LOG_DIR/iteration-$i.log" 2>&1
  new_unchecked=$(count_unchecked)
  if [ "$new_unchecked" -ge "$unchecked" ]; then
    echo "STALL: iteration $i did not reduce the unchecked count ($unchecked -> $new_unchecked). Stopping."
    break
  fi
  echo "iteration $i done: $unchecked -> $new_unchecked unchecked"
done
echo "=== LOOP FINISHED === Iterations: $i | Unchecked remaining: $(count_unchecked)"
echo "Review with: git log main..$BRANCH --oneline && git diff main...$BRANCH"
