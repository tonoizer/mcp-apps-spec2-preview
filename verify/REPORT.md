# Verification report — `codex/mcp-apps-spec-upgrade` @ `d3159bd` (+ follow-up)

**Date:** 2026-10-08 (Europe/Berlin)  
**Repo:** tonoizer/mcp-apps-spec2-preview (unofficial; seeded from npm `@module-federation/mcp-apps@0.0.6`; upstream `module-federation/mcp-apps` is private)  
**Node:** 24.10.0 and 20.19.2 — full suite passes on both (`NODE_BIN=/path/to/node20/bin ./verify/run-all.sh`)  
**Verdict:** **PASS** (functional upgrade verified; one README wording fix)

## How to re-run

```bash
./verify/run-all.sh                     # uses `node` on PATH (>=20)
NODE_BIN=/path/to/node20/bin ./verify/run-all.sh   # pick a specific Node
# skip reinstall: SKIP_INSTALL=1 ./verify/run-all.sh
```

## Per-check results

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `npm ci` + resolved deps | **PASS** | 265 packages; `npm ls` exit 0 for server/client/core/ext-apps/express/node 2.x. No unmet required deps (only optional vue-tsc / ws peer optionals). |
| 2 | ESM entrypoints via exports | **PASS** | `.` → `createServer`; `./react` → `McpAppRenderer`; `./types` → []; `./renderer` → `MFProvider, RemoteComponentContainer, useRemoteComponent, MFContext, useMFContext` (CSS stub needed under plain Node — pre-existing). Bin imports (`@modelcontextprotocol/{express,node,server,server/stdio}`) resolve. |
| 3 | stdio + Streamable HTTP + `/mcp-rpc` + InMemory | **PASS** | initialize / tools/list / tools/call / resources/list / resources/read. MIME `text/html;profile=mcp-app` (= `RESOURCE_MIME_TYPE` from ext-apps 2.0.3). Tool `_meta.ui.resourceUri=ui://mf/demo-provider`. CSP + `prefersBorder` present. stdio HTML ~701707 bytes; HTTP shell HTML ~561 bytes. `/mcp-rpc` notifications → 202. |
| 4 | API surface vs npm 0.0.6 | **PASS** | Runtime exports identical for every entry. CLI flags identical (`--config`, `--dev`, `--stdio`). Behavioral metadata (uri, visibility, mime, CSP, prefersBorder, htmlLen) identical on stdio. Expected SDK-surface deltas only: tools/list `$schema` draft-07→2020-12; old listed `execution.taskSupport=forbidden` (sdk 1.x), new does not. |
| 5 | React renderer | **PASS** | Import OK; AppBridge 2.0.3 has `addEventListener('initialized')`, `sendToolInput/Result`, `connect`, `PostMessageTransport`, size/message/openlink setters. jsdom mounts iframe + missing-HTML fallback. Host/view handshake works with App **1.7.5** (what the prebuilt `dist/mcp-app.html` was built against) **and** App **2.0.3**. |
| 6 | TypeScript consumer | **PASS** | `tsc --noEmit` strict NodeNext + Bundler (`skipLibCheck:false`) on `verify/ts/consumer.tsx` importing every public entry. No leftover `@modelcontextprotocol/sdk` imports in `dist/`. `server.server.oninitialized` property assignment still works on server 2.3.1 (observed UI-capability log). |
| 7 | `examples/demo` smoke | **PASS** | `npm run demo:build`. HTTP: `/mcp` roundtrip (`show_greeting` → `ui://mf/demo-remote`, moduleFederation points at the served `remoteEntry.js`), remote + host assets served. stdio roundtrip. Headless Chrome (Node ≥22 + Chrome; skipped otherwise): the MF remote renders inside the MCP App iframe and the `ui/message` reaches the host. |
| 8 | Official MCP Inspector CLI | **PASS** (legacy) | `@modelcontextprotocol/inspector@2.10.1` against `examples/demo` over Streamable HTTP and stdio: `tools/list`, `tools/call show_greeting`, `resources/list`, `resources/read ui://mf/demo-remote`. `--app-info` reports `hasApp:true`, `resourceMimeType=text/html;profile=mcp-app`. `--protocol-era modern` fails as expected (server uses legacy 2025 handshake; no `server/discover` for 2026-07-28). Inspector web UI (Apps tab) also renders the MF greeting via its sandbox iframe — see `/workspace/mcp-inspector.png` (not committed). |

## Fixes applied during verification

1. **README** — the upgrade claimed “MCP Core **2026-07-28** stack”. In `@modelcontextprotocol/client@2.3.1`, `2026-07-28` is the *modern wire revision* (`MODERN_WIRE_REVISION` / `FIRST_MODERN_PROTOCOL_VERSION`); default negotiation remains the legacy 2025 handshake (`LATEST_PROTOCOL_VERSION=2025-11-25`). README wording updated so consumers aren’t told the wrong default.

No functional bugs found in the upgrade itself. No production code changes beyond README.

(Harness note: Node 20 lacks a global `navigator`; `05-react.mjs` sets it from jsdom. Test-only.)

## Caveats

- Dist-only seed: **no upstream `src/` or tests** exist in this tree; verify/ is the regression harness.
- Prebuilt `dist/mcp-app.html` / `dist/static/js/mcp-app-shell.js` still embed **ext-apps 1.x** UI protocol versions (`2025-11-21` / `2026-01-26`). Interop check confirms AppBridge 2.0.3 host still talks to App 1.x views. Rebuilding UI against ext-apps 2.x would need the private upstream `src/` + rsbuild pipeline.
- `./renderer` CSS imports fail under plain Node without a loader (pre-existing; identical on 0.0.6). Bundlers (Vite/Rsbuild/webpack) handle this.
- HTTP Streamable path is stateless (a fresh `McpServer` per request), so the `notifications/initialized` request lands on a server instance that never saw `initialize` and logs `Host UI capability: not supported`. Same on 0.0.6; log-only — tools/resources and `_meta.ui` are served unconditionally. stdio + InMemory report `supported`.
- `npm audit` reports transitive high/moderate vulns in the lockfile (not introduced specifically by the MCP 2.x bump; not exercised by these checks).

## Demo (added after initial verification)

`examples/demo/` + `npm run demo` / `demo:stdio` / `demo:screenshot`. Screenshot: `examples/demo/screenshot.png`. Covered by check 7.

## Last suite output

Node 24.10.0:
```
CHECK2 PASS {
CHECK3 PASS {"stdio":{"tools":1,"html":701707,"mime":"text/html;profile=mcp-app","ui":"supported"},"http":{"tools":1,"html":561,"mime":"text/html;profile=mcp-app","mcpRpc":true,"port":39562},"inmemory":{"tools":1,"html":
CHECK4 PASS {
CHECK5 PASS {"mount":"ok","fallback":"ok","interop":{"App 1.7.5":"ok","App 2.0.3":"ok"}}
CHECK6 PASS
ALL CHECKS PASS (node v24.10.0)
```

Node 20.19.2:
```
CHECK2 PASS {
CHECK3 PASS {"stdio":{"tools":1,"html":701707,"mime":"text/html;profile=mcp-app","ui":"supported"},"http":{"tools":1,"html":561,"mime":"text/html;profile=mcp-app","mcpRpc":true,"port":39228},"inmemory":{"tools":1,"html":
CHECK4 PASS {
CHECK5 PASS {"mount":"ok","fallback":"ok","interop":{"App 1.7.5":"ok","App 2.0.3":"ok"}}
CHECK6 PASS
ALL CHECKS PASS (node v20.19.2)
```
