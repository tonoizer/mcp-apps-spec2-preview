#!/usr/bin/env node
/**
 * Cross-check with the official MCP Inspector CLI (@modelcontextprotocol/inspector).
 * Runs tools/list, tools/call show_greeting, resources/list, resources/read ui://mf/demo-remote
 * against examples/demo/server.mjs over Streamable HTTP (/mcp) and stdio.
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

function inspector(target, method, extra = []) {
  const args = ['-y', `@modelcontextprotocol/inspector@${version}`, '--cli', ...target, '--method', method, ...extra];
  const r = spawnSync('npx', args, { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const out = r.stdout.trim();
  let json;
  try { json = JSON.parse(out); } catch { throw new Error(`inspector ${method}: non-JSON output (exit ${r.status})\n${out.slice(0, 500)}\n${r.stderr.slice(-1500)}`); }
  if (json.error) throw new Error(`inspector ${method}: ${JSON.stringify(json.error)}`);
  return json;
}

function runAll(target, port) {
  const list = inspector(target, 'tools/list');
  assert.deepEqual(list.tools.map((t) => t.name), ['show_greeting']);
  assert.equal(list.tools[0]._meta.ui.resourceUri, 'ui://mf/demo-remote');
  const call = inspector(target, 'tools/call', ['--tool-name', 'show_greeting', '--tool-arg', 'name=Demo']);
  assert.deepEqual(call.structuredContent.args, { name: 'Demo' });
  assert.equal(call.structuredContent.resource.mimeType, MIME);
  assert.equal(call.structuredContent.resource.moduleFederation.remoteEntry, `http://localhost:${port}/remote/remoteEntry.js`);
  const resources = inspector(target, 'resources/list');
  assert.deepEqual(resources.resources.map((r) => [r.uri, r.mimeType]), [['ui://mf/demo-remote', MIME]]);
  const read = inspector(target, 'resources/read', ['--uri', 'ui://mf/demo-remote']);
  assert.equal(read.contents[0].mimeType, MIME);
  assert.ok(read.contents[0].text.length > 100_000);
  assert.deepEqual(read.contents[0]._meta.ui.csp.connectDomains, [`http://localhost:${port}`]);
  return { 'tools/list': 'ok', 'tools/call': 'ok', 'resources/list': 'ok', 'resources/read': `ok (${read.contents[0].text.length} chars, ${MIME})` };
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
  results.http = runAll([`http://localhost:${port}/mcp`, '--transport', 'http'], port);
  // App metadata probe (does not invoke the tool; advertises the UI extension)
  const info = inspector([`http://localhost:${port}/mcp`, '--transport', 'http', '--advertise-apps', '--app-info'],
    'tools/call', ['--tool-name', 'show_greeting']);
  assert.equal(info.hasApp, true);
  assert.equal(info.resourceUri, 'ui://mf/demo-remote');
  assert.equal(info.resourceMimeType, MIME);
  results.appInfo = { hasApp: info.hasApp, resourceUri: info.resourceUri, resourceMimeType: info.resourceMimeType, prefersBorder: info.prefersBorder, csp: info.csp };
} finally {
  child.kill('SIGTERM');
}

// stdio via a read-only Inspector config file (passing `--stdio` as a positional server
// arg is consumed by the Inspector CLI's option parser, so use --config/--server).
const sport = port + 1;
const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inspector-cfg-'));
const cfg = path.join(cfgDir, 'mcp.json');
fs.writeFileSync(cfg, JSON.stringify({ mcpServers: { demo: { command: process.execPath, args: [server, '--stdio'], env: { DEMO_PORT: String(sport) } } } }));
results.stdio = runAll(['--config', cfg, '--server', 'demo'], sport);

// Modern-era pin (2026-07-28) is expected to fail: this package's default handshake is the
// legacy 2025 path. Record honestly rather than forcing a pass.
const modern = spawnSync('npx', ['-y', `@modelcontextprotocol/inspector@${version}`, '--cli',
  '--config', cfg, '--server', 'demo', '--protocol-era', 'modern', '--method', 'tools/list'],
  { cwd: root, env, encoding: 'utf8', timeout: 90000 });
const modernText = (modern.stdout || '') + '\n' + (modern.stderr || '');
  const modernJsonLine = modernText.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{')).at(-1);
  let modernJson = null; try { modernJson = modernJsonLine ? JSON.parse(modernJsonLine) : null; } catch {}
  results.modernEra = {
    exit: modern.status,
    expected: 'fail',
    note: 'server negotiates legacy (LATEST=2025-11-25); Inspector --protocol-era modern pins 2026-07-28 and refuses to fall back',
    error: modernJson?.error?.message ?? modernText.replace(/\[demo\][^\n]*\n?/g, '').trim().slice(0, 280),
  };

console.log('CHECK8 PASS', JSON.stringify(results));
