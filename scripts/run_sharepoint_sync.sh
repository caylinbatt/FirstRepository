#!/bin/zsh
# Pull Updated 4Miler Tracking.xlsx from SharePoint, rebuild data.json,
# and push to main when standings change (triggers Azure SWA deploy).
set -uo pipefail

ROOT="/Users/caylinbatt/Projects/4miler-swa"
# Prefer the real clone path if this script lives inside the repo.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -d "$SCRIPT_DIR/.." && -f "$SCRIPT_DIR/../data.json" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/sharepoint-sync.log"

if [[ -x /opt/homebrew/bin/python3 ]]; then
  PYTHON=/opt/homebrew/bin/python3
elif [[ -x /usr/local/bin/python3 ]]; then
  PYTHON=/usr/local/bin/python3
else
  PYTHON="$(command -v python3)"
fi

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') starting SharePoint -> leaderboard sync ====="
  echo "root=$ROOT"
  echo "python=$PYTHON"

  cd "$ROOT" || exit 1

  # Ensure latest main before writing data.json
  git fetch origin main 2>&1 || true
  git checkout main 2>&1 || true
  git pull --ff-only origin main 2>&1 || true

  before_hash="$(git rev-parse HEAD 2>/dev/null || echo none)"
  before_data="$(git hash-object data.json 2>/dev/null || echo missing)"

  "$PYTHON" "$ROOT/scripts/sync_from_sharepoint.py"
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo "sync_from_sharepoint.py failed rc=$rc"
    echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') finished (failed) ====="
    echo
    exit $rc
  fi

  after_data="$(git hash-object data.json 2>/dev/null || echo missing)"
  if [[ "$before_data" == "$after_data" ]]; then
    echo "data.json unchanged; no commit"
    echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') finished (no changes) ====="
    echo
    exit 0
  fi

  git add data.json
  if git diff --cached --quiet; then
    echo "No staged changes after sync"
    echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') finished (no staged changes) ====="
    echo
    exit 0
  fi

  git -c user.useConfigOnly=true commit -m "$(cat <<'EOF'
Sync 4Miler leaderboard data from SharePoint tracking workbook

Co-Authored-By: Oz <oz-agent@warp.dev>
EOF
)"
  commit_rc=$?
  if [[ $commit_rc -ne 0 ]]; then
    echo "git commit failed rc=$commit_rc"
    echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') finished (commit failed) ====="
    echo
    exit $commit_rc
  fi

  git push origin main
  push_rc=$?
  echo "push_rc=$push_rc head_before=$before_hash head_after=$(git rev-parse HEAD)"
  echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') finished ====="
  echo
  exit $push_rc
} >>"$LOG_FILE" 2>&1
