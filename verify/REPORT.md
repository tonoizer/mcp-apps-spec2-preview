# Verification report — `codex/mcp-apps-spec-upgrade` (`0.1.0-preview`)

**Date:** 2026-10-08 (Europe/Berlin)  
**Repo:** tonoizer/mcp-apps-spec2-preview (unofficial; seeded from npm `@module-federation/mcp-apps@0.0.6`; upstream `module-federation/mcp-apps` is private)  
**Stack:** `@modelcontextprotocol/{server,client,core}` 2.3.1, `@modelcontextprotocol/ext-apps` 2.0.3, MCP Inspector 2.10.1  
**Node:** 24.10.0 and 20.19.2: the full suite (checks 1–9, including headless Chrome and the Inspector) passes on both  
**Verdict:** **PASS**. MCP **2026-07-28** (`server/discover`) and **2025-11-25** (`initialize`) are both served over stdio and Streamable HTTP, and the official Inspector passes in `--protocol-era modern` and `legacy`.

## How to re-run

```bash
./verify/run-all.sh                                # uses `node` on PATH (>=20)
NODE_BIN=/path/to/node20/bin ./verify/run-all.sh   # pick a specific Node
SKIP_INSTALL=1 ./verify/run-all.sh                 # skip npm ci
SKIP_BROWSER=1 / SKIP_INSPECTOR=1                  # opt out of Chrome / Inspector steps
```

## Per-check results

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `npm ci` + resolved deps | **PASS** | `npm ls` exit 0 for server/client/core/ext-apps/express/node 2.x. |
| 2 | ESM entrypoints via exports | **PASS** | `.` → `createServer`; `./react` → `McpAppRenderer`; `./types` → []; `./renderer` → MF exports (CSS stub under plain Node, pre-existing); **new** `./transports` → `createStreamableHttpHandler`, `serveStdioServer`. |
| 3 | Official client roundtrip, **both eras** | **PASS** | `@modelcontextprotocol/client` 2.3.1 with `versionNegotiation` **legacy** → `2025-11-25`, **`{pin:'2026-07-28'}`** → `2026-07-28`, **`auto`** → `2026-07-28`. Covered over **stdio** (bin `--stdio` → `serveStdio`) and **Streamable HTTP** (bin → `/mcp`). In-memory runs legacy and pinned (`serveStdioServer({transport})`). Each run does tools/list, tools/call, resources/list and resources/read `ui://` (MIME `text/html;profile=mcp-app`, CSP, `prefersBorder`). It also asserts `serverInfo.version` = package version, `inputSchema.$schema` = 2020-12 and no `execution`. HTTP legacy: an `Mcp-Session-Id` is issued, the UI capability from `initialize` is known on later `tools/call`, DELETE returns 404 afterwards, and a session-less stateless JSON-RPC caller is still answered. A modern client without the UI extension is logged per request as "not supported". `/mcp-rpc`: legacy JSON-RPC, plus 2026-07-28 `server/discover` + `tools/list` with an envelope (plain JSON). |
| 4 | API surface vs npm 0.0.6 | **PASS** | Runtime exports are identical for every 0.0.6 entry, and the CLI flags are identical (`--config`, `--dev`, `--stdio`). Stdio behavioral metadata (uri, visibility, mime, CSP, prefersBorder) is identical. HTML size differs on purpose (MCP App rebuilt with ext-apps 2.x: 701,707 → 526,676 chars). The only addition is `./transports`. |
| 5 | React renderer | **PASS** | AppBridge 2.0.3 API present. jsdom mounts the iframe and the missing-HTML fallback. Host/view handshake works with App **1.7.5** (third-party views built on 1.x) and App **2.0.3**. |
| 6 | TypeScript consumer | **PASS** | `tsc --noEmit` strict NodeNext + Bundler (`skipLibCheck:false`) on every public entry, incl. `./transports`. `createServer()`'s `Promise<McpServer>` is assignable to the SDK's `McpServerFactory`. No leftover `@modelcontextprotocol/sdk` imports. |
| 7 | `examples/demo` | **PASS** | Demo build, HTTP + stdio roundtrip. Headless Chrome on **Node 24 and Node 20** (Node 20: `screenshot.mjs` re-runs itself with `--experimental-websocket`). The MF remote renders inside the rebuilt MCP App, the `ui/message` reaches the host, and the browser host negotiates **MCP 2026-07-28** (`versionNegotiation: 'auto'`). |
| 8 | Official **MCP Inspector 2.10.1** CLI | **PASS** (legacy **and modern**, required) | Against `examples/demo` over **Streamable HTTP** and **stdio** (via `--config/--server`), with `--protocol-era legacy` and `--protocol-era modern` (pins 2026-07-28 via `server/discover`, no fallback). Calls: `tools/list`, `tools/call show_greeting`, `resources/list`, `resources/read ui://mf/demo-remote`, and an `--advertise-apps --app-info` probe (`hasApp:true`, `text/html;profile=mcp-app`, `prefersBorder:true`, CSP). The era is asserted from result `_meta["io.modelcontextprotocol/serverInfo"]`, which is only present on 2026-07-28. `--protocol-era auto` lands on 2026-07-28 on both transports. |
| 9 | Embedded MCP App build | **PASS** | `npm run build:ui` (ui/build.mjs, rsbuild) reproduces the committed `dist/mcp-app.html`, `dist/mcp-app-shell.html` and `dist/static/*` byte-for-byte. The bundle uses the ext-apps **2.0.3** `App` (`addEventListener("toolresult")`) and has no async chunks. Every shell asset reference exists. |

Inspector web UI (`--web --transport http --server-url http://localhost:4173/mcp --protocol-era modern`): the Messages panel shows the **MODERN** badge, `server/discover` and `subscriptions/listen`. The Apps tab renders the MF greeting from the rebuilt MCP App inside the Inspector sandbox, which enforces the resource's `_meta.ui.csp`. The screenshot is outside the repo: `/workspace/mcp-inspector.png`.

## Changes in this round (gap fixes)

1. **MCP 2026-07-28 support.**
   - stdio now uses the SDK's `serveStdio(factory)`; the opening message selects the era.
   - HTTP routes with the SDK's `isLegacyRequest`:
     - modern requests go to `createMcpHandler(factory, { legacy: 'reject' })`;
     - legacy requests go to sessionful Streamable HTTP (`NodeStreamableHTTPServerTransport`, one server per session, idle sweep, `maxSessions`), with the SDK's `legacyStatelessFallback` for session-less callers.
   - `/mcp-rpc` answers 2026-07-28 envelopes through `createMcpHandler({ responseMode: 'json' })`.
   - The wiring lives in `dist/transports.js` (exported as `./transports`). `dist/index.js` and the demo use it.
2. **UI capability detection** is per request: the 2026-07-28 `_meta` envelope first, otherwise the `initialize` state. Legacy HTTP is now sessionful, so `initialize` capabilities are known. The old misleading `Host UI capability: not supported` on every HTTP request is gone. A request with no capability info is logged as `unknown`, not as `not supported`.
3. **`execution.taskSupport`:** intentionally not emitted. SDK 2.3.1 `registerTool` has no `execution` option, and its 2026-07-28 codec strips the field: tasks were removed from core and the vocabulary was deleted. In 2025-11-25 an absent `execution` means `taskSupport: "forbidden"`, so this is wire-equivalent to 0.0.6's explicit `forbidden`. Asserted in checks 3 and 8.
4. **`$schema`:** inputs carry `https://json-schema.org/draft/2020-12/schema`. This is the default dialect of MCP 2025-11-25 and 2026-07-28, and the 2026 Tool schema allows `$schema`. 0.0.6's draft-07 came from SDK 1.x, so no change is needed. Asserted in checks 3 and 8.
5. **Embedded MCP App rebuilt on ext-apps 2.0.3.** `ui/mcp-app.jsx` is a source reconstruction of the 0.0.6 shell component (the only part not in `dist/` as modules). It reuses the compiled `dist/` components and switches to `useApp`/`App` 2.x with `addEventListener`. `npm run build:ui` builds the inline HTML plus the shell assets reproducibly.
6. **Version** `0.1.0-preview` (name unchanged). It is reported as `serverInfo.version`.
7. **Scripts:** all `package.json` scripts use npm (the repo ships `package-lock.json`). `build:ui` now works (`node ui/build.mjs`). The broken `watch:ui` was removed. `build`/`dev`/`typecheck` still need the upstream `src/` (documented).
8. **Node 20:** the browser step no longer skips (`--experimental-websocket` re-exec).
9. **Demo host** negotiates `auto` (shows `MCP 2026-07-28`; `?era=legacy` forces the 2025 handshake).
10. **Types:** `dist/transports.d.ts` added. The `createServer` docs were updated (HTML size).

## Remaining caveats (not fixable here, or by design)

- **No upstream `src/`/tests** in this tree. `dist/` is edited directly and `verify/` is the regression harness. `npm run build` (tsc over `src/`) cannot run here.
- **`ui/mcp-app.jsx` is a reconstruction** from the published minified bundle (behaviour, markup and class names match). The original TypeScript source is private.
- **`server/discover` lists only `2026-07-28`.** That is SDK behaviour: discover is modern-only, and 2025-era clients use `initialize` on the same endpoint.
- **2026-07-28 results carry SDK default cache hints** (`ttlMs: 0`, `cacheScope: "private"`). They are conservative and left unchanged.
- **The `./renderer` CSS imports need a bundler.** Plain Node needs a loader (pre-existing, identical on 0.0.6).
- **The bin listens on `0.0.0.0`** (`createMcpExpressApp({ host: "0.0.0.0" })`, as in 0.0.6), so there is no automatic DNS-rebinding Host check. The demo server uses the localhost-protected default.
- **`npm audit`** reports transitive vulnerabilities in dev/build deps (not exercised by these checks).

## Last suite output (summarised)

Node 24.10.0 and Node 20.19.2 (identical apart from ports):
```
CHECK1 PASS
CHECK2 PASS
CHECK3 PASS {"stdio":{"legacy":"2025-11-25","pin":"2026-07-28","auto":"2026-07-28"},"http":{"legacy":"2025-11-25","pin":"2026-07-28","auto":"2026-07-28","legacySession":"issued + DELETE → 404","perRequestUiCaps":true,"statelessLegacyCaller":true,"mcpRpc":{"legacy":true,"modern":["2026-07-28"]}},"inmemory":{"legacy":"2025-11-25","pin":"2026-07-28"}}
CHECK4 PASS
CHECK5 PASS {"mount":"ok","fallback":"ok","interop":{"App 1.7.5":"ok","App 2.0.3":"ok"}}
CHECK6 PASS
CHECK7 PASS {"browser":"rendered (Hello, Demo + ui/message relayed; browser client on MCP 2026-07-28)", ...}
CHECK8 PASS {"inspector":"2.10.1","http":{"legacy":{"era":"2025-11-25 (initialize)",...},"modern":{"era":"2026-07-28 (serverInfo module-federation@0.1.0-preview)",...},"auto":"2026-07-28"},"stdio":{"legacy":{...},"modern":{"era":"2026-07-28 ...",...},"auto":"2026-07-28"}}
CHECK9 PASS {"extApps":"2.0.3","reproducible":true,"inlineBytes":526676}
ALL CHECKS PASS
```
