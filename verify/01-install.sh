#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${NODE_BIN:-}" ]]; then export PATH="$NODE_BIN:$PATH"; fi  # optional: NODE_BIN=/path/to/node/bin to pick a Node (>=20)
cd "$(dirname "$0")/.."
echo "node=$(node -v) npm=$(npm -v)"
npm ci
npm ls --depth=0
npm ls @modelcontextprotocol/server @modelcontextprotocol/client @modelcontextprotocol/core @modelcontextprotocol/ext-apps @modelcontextprotocol/express @modelcontextprotocol/node zod
echo "CHECK1 PASS"
