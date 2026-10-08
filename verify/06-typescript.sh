#!/usr/bin/env bash
# tsc --noEmit (strict, skipLibCheck=false) on a consumer of every public entry, NodeNext + Bundler.
# Uses package self-reference (exports map) from the repo root.
set -euo pipefail
if [[ -n "${NODE_BIN:-}" ]]; then export PATH="$NODE_BIN:$PATH"; fi  # optional: NODE_BIN=/path/to/node/bin to pick a Node (>=20)
cd "$(dirname "$0")/ts"
npx --no-install tsc -p tsconfig.nodenext.json
npx --no-install tsc -p tsconfig.bundler.json
cd ../..
echo "-- leftover v1 SDK / ext-apps 1.x API scan --"
if rg -n "@modelcontextprotocol/sdk|bridge\.oninitialized" dist --glob '*.{js,d.ts}'; then echo "FOUND legacy refs"; exit 1; fi
echo "CHECK6 PASS"
