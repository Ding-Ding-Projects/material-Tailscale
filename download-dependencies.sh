#!/usr/bin/env bash
# Fetches every dependency needed to build, run and test Material Tailscale.
set -euo pipefail
cd "$(dirname "$0")"
echo "[1/3] Checking Node.js"
command -v node >/dev/null || { echo "FAILED: Node.js 20+ is required (https://nodejs.org)"; exit 1; }
major=$(node -p "process.versions.node.split('.')[0]")
[ "$major" -ge 20 ] || { echo "FAILED: Node.js 20+ required, found $major"; exit 1; }
echo "[2/3] Installing pinned npm packages"
npm ci --no-audit --no-fund
echo "[3/3] Verifying Electron"
node -e "require('electron')"
echo "Dependencies are ready."
