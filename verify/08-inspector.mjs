#!/usr/bin/env node
/**
 * Cross-check with the official MCP Inspector CLI (@modelcontextprotocol/inspector).
 * Runs tools/list, tools/call show_greeting, resources/list, resources/read ui://mf/demo-remote and
 * an --app-info probe against examples/demo/server.mjs over Streamable HTTP (/mcp) and stdio, in BOTH
 * protocol eras: `--protocol-era legacy` (2025-11-25 initialize) and `--protocol-era modern`
 * (pinned 2026-07-28 via server/discover, no fallback). All are required to pass; `auto` must
 * negotiate 2026-07-28.
 *
 * Env: INSPECTOR_VERSION (default 2.10.1), SKIP_INSPECTOR=1 to skip (needs network for npx the first time).
 * Requires examples/demo/dist (07-demo builds it; or `npm run demo:build`).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

if (process.env.SKIP_INSPECTOR === '1') { console.log('CHECK8 SKIPPED (SKIP_INSPECTOR=1)'); process.exit(0); }

const root = path.resolve(import.meta.dirname, '..');
const server = path.join(root, 'examples/demo/server.mjs');
const version = process.env.INSPECTOR_VERSION ?? '2.10.1';
const MIME = 'text/html;profile=mcp-app';
const env = { ...process.env, NODE_NO_WARNINGS: '1', MCP_INSPECTOR_SECRET_STORE: 'memory' };

if (!fs.existsSync(path.join(root, 'examples/demo/dist/remote/remoteEntry.js'))) {
  const b = spawnSync('npm', ['run', '-s', 'demo:build'], { cwd: root, encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
}

function inspector(target, method, extra = [], era) {
  const args = ['-y', `@modelcontextprotocol/inspector@${version}`, '--cli', ...target,
    ...(era ? ['--protocol-era', era] : []), '--method', method, ...extra];
  const r = spawnSync('npx', args, { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const out = r.stdout.trim();
  let json;
  try { json = JSON.parse(out); } catch { throw new Error(`inspector ${era ?? ''} ${method}: non-JSON output (exit ${r.status})\n${out.slice(0, 500)}\n${r.stderr.slice(-1500)}`); }
  if (json.error) throw new Error(`inspector ${era ?? ''} ${method}: ${JSON.stringify(json.error)}`);
  return json;
}

const SERVER_INFO_KEY = 'io.modelcontextprotocol/serverInfo';

function runAll(target, port, era) {
  const list = inspector(target, 'tools/list', [], era);
  assert.deepEqual(list.tools.map((t) => t.name), ['show_greeting']);
  assert.equal(list.tools[0]._meta.ui.resourceUri, 'ui://mf/demo-remote');
  assert.equal(list.tools[0].inputSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  // 2026-07-28 deleted the Tool `execution` vocabulary (tasks moved to an extension); 2025-11-25 treats absence as taskSupport "forbidden".
  assert.equal(list.tools[0].execution, undefined);
  const call = inspector(target, 'tools/call', ['--tool-name', 'show_greeting', '--tool-arg', 'name=Demo'], era);
  assert.deepEqual(call.structuredContent.args, { name: 'Demo' });
  assert.equal(call.structuredContent.resource.mimeType, MIME);
  assert.equal(call.structuredContent.resource.moduleFederation.remoteEntry, `http://localhost:${port}/remote/remoteEntry.js`);
  const resources = inspector(target, 'resources/list', [], era);
  assert.deepEqual(resources.resources.map((r) => [r.uri, r.mimeType]), [['ui://mf/demo-remote', MIME]]);
  const read = inspector(target, 'resources/read', ['--uri', 'ui://mf/demo-remote'], era);
  assert.equal(read.contents[0].mimeType, MIME);
  assert.ok(read.contents[0].text.length > 100_000);
  assert.deepEqual(read.contents[0]._meta.ui.csp.connectDomains, [`http://localhost:${port}`]);
  // Era evidence: 2026-07-28 results carry the server identity in result _meta (no initialize handshake).
  const servedModern = Boolean(read._meta?.[SERVER_INFO_KEY]);
  assert.equal(servedModern, era === 'modern', `expected ${era} era, result _meta=${JSON.stringify(read._meta)}`);
  // App metadata probe (does not invoke the tool; advertises the UI extension)
  const info = inspector([...target, '--advertise-apps', '--app-info'], 'tools/call', ['--tool-name', 'show_greeting'], era);
  assert.equal(info.hasApp, true);
  assert.equal(info.resourceUri, 'ui://mf/demo-remote');
  assert.equal(info.resourceMimeType, MIME);
  return {
    era: servedModern ? `2026-07-28 (serverInfo ${read._meta[SERVER_INFO_KEY].name}@${read._meta[SERVER_INFO_KEY].version})` : '2025-11-25 (initialize)',
    'tools/list': 'ok', 'tools/call': 'ok', 'resources/list': 'ok',
    'resources/read': `ok (${read.contents[0].text.length} chars, ${MIME})`,
    appInfo: { hasApp: info.hasApp, resourceUri: info.resourceUri, resourceMimeType: info.resourceMimeType, prefersBorder: info.prefersBorder, csp: info.csp },
  };
}

const results = { inspector: version };

// Streamable HTTP
const port = 4900 + Math.floor(Math.random() * 300);
const child = spawn(process.execPath, [server], { env: { ...process.env, DEMO_PORT: String(port) } });
let stderr = '';
try {
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('demo server start timeout\n' + stderr)), 15000);
    child.stderr.on('data', (d) => { stderr += d; if (stderr.includes('Demo host:')) { clearTimeout(t); res(); } });
    child.on('exit', (c) => rej(new Error('demo server exited ' + c + '\n' + stderr)));
  });
  const http = [`http://localhost:${port}/mcp`, '--transport', 'http'];
  results.http = { legacy: runAll(http, port, 'legacy'), modern: runAll(http, port, 'modern') };
  // auto: the Inspector probes server/discover first and must land on 2026-07-28.
  const auto = inspector(http, 'resources/read', ['--uri', 'ui://mf/demo-remote'], 'auto');
  assert.ok(auto._meta?.[SERVER_INFO_KEY], 'auto era should negotiate 2026-07-28 over HTTP');
  results.http.auto = '2026-07-28';
} finally {
  child.kill('SIGTERM');
}

// stdio via a read-only Inspector config file (passing `--stdio` as a positional server
// arg is consumed by the Inspector CLI's option parser, so use --config/--server).
const sport = port + 1;
const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inspector-cfg-'));
const cfg = path.join(cfgDir, 'mcp.json');
fs.writeFileSync(cfg, JSON.stringify({ mcpServers: { demo: { command: process.execPath, args: [server, '--stdio'], env: { DEMO_PORT: String(sport) } } } }));
const stdio = ['--config', cfg, '--server', 'demo'];
results.stdio = { legacy: runAll(stdio, sport, 'legacy'), modern: runAll(stdio, sport, 'modern') };
const autoStdio = inspector(stdio, 'resources/read', ['--uri', 'ui://mf/demo-remote'], 'auto');
assert.ok(autoStdio._meta?.[SERVER_INFO_KEY], 'auto era should negotiate 2026-07-28 over stdio');
results.stdio.auto = '2026-07-28';

console.log('CHECK8 PASS', JSON.stringify(results));
