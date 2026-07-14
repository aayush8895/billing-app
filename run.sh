#!/usr/bin/env bash
# Billing App (Beta) — updater/launcher for macOS/Linux.
# Downloads the latest build from the GitHub "main" branch into an "app"
# subfolder next to this script, keeps app/data and app/config.json
# untouched across runs, then starts the server.
#
# Re-run this script any time to pick up the latest build.
set -euo pipefail

REPO="aayush8895/billing-app"
BRANCH="main"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/app"
TMP="$(mktemp -d)"

command -v node >/dev/null 2>&1 || {
  echo "Node.js not found. Install it from https://nodejs.org/ (LTS) and re-run this script." >&2
  exit 1
}

echo "==> Downloading latest build from $REPO@$BRANCH..."
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" -o "$TMP/update.tar.gz"
tar -xzf "$TMP/update.tar.gz" -C "$TMP"
EXTRACTED="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d)"

mkdir -p "$APP"
echo "==> Syncing app files (your app/data and app/config.json are kept as-is)..."
rsync -a --delete --exclude 'data' --exclude '.git' --exclude 'config.json' "$EXTRACTED"/ "$APP"/
rm -rf "$TMP"

if [ ! -f "$APP/config.json" ]; then
  cp "$APP/config.example.json" "$APP/config.json"
  echo "==> Created app/config.json from the template (add your own Gemini API key to enable AI receipt scanning — optional)."
fi
mkdir -p "$APP/data/bills"

echo "==> Starting Billing App (Beta)..."
cd "$APP"
( sleep 1 && command -v open >/dev/null 2>&1 && open http://localhost:3000 || true ) &
node server.js
