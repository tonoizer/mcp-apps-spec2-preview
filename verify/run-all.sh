#!/usr/bin/env bash
set -euo pipefail
export PATH="${NODE24_BIN:-/workspace/node-v24.10.0-linux-x64/bin}:$PATH"  # set NODE24_BIN=/usr/bin (or any node dir) to test another Node
cd "$(dirname "$0")"
[[ "${SKIP_INSTALL:-}" == 1 ]] || ./01-install.sh
node 02-imports.mjs
node 03-roundtrip.mjs
node 04-api-surface.mjs
node 05-react.mjs
./06-typescript.sh
echo "ALL CHECKS PASS (node $(node -v))"
