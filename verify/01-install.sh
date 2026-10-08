#!/usr/bin/env bash
set -euo pipefail
export PATH="${NODE24_BIN:-/workspace/node-v24.10.0-linux-x64/bin}:$PATH"
cd "$(dirname "$0")/.."
echo "node=$(node -v) npm=$(npm -v)"
npm ci
npm ls --depth=0
npm ls @modelcontextprotocol/server @modelcontextprotocol/client @modelcontextprotocol/core @modelcontextprotocol/ext-apps @modelcontextprotocol/express @modelcontextprotocol/node zod
echo "CHECK1 PASS"
