#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${NODE_BIN:-}" ]]; then export PATH="$NODE_BIN:$PATH"; fi  # optional: NODE_BIN=/path/to/node/bin to pick a Node (>=20)
cd "$(dirname "$0")"
[[ "${SKIP_INSTALL:-}" == 1 ]] || ./01-install.sh
node 02-imports.mjs
node 03-roundtrip.mjs
node 04-api-surface.mjs
node 05-react.mjs
./06-typescript.sh
node 07-demo.mjs
echo "ALL CHECKS PASS (node $(node -v))"
