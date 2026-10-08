#!/usr/bin/env bash
# tsc --noEmit (strict, skipLibCheck=false) on a consumer of every public entry, NodeNext + Bundler.
# Uses package self-reference (exports map) from the repo root.
set -euo pipefail
export PATH="${NODE24_BIN:-/workspace/node-v24.10.0-linux-x64/bin}:$PATH"
cd "$(dirname "$0")/ts"
npx --no-install tsc -p tsconfig.nodenext.json
npx --no-install tsc -p tsconfig.bundler.json
cd ../..
echo "-- leftover v1 SDK / ext-apps 1.x API scan --"
if rg -n "@modelcontextprotocol/sdk|bridge\.oninitialized" dist --glob '*.{js,d.ts}'; then echo "FOUND legacy refs"; exit 1; fi
echo "CHECK6 PASS"
