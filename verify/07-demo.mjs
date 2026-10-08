#!/usr/bin/env node
/**
 * examples/demo smoke: build, then
 *  - HTTP mode: MCP roundtrip on /mcp (show_greeting + ui://mf/demo-remote), MF remoteEntry.js + host page served
 *  - stdio mode: MCP roundtrip over stdio
 *  - if Chrome is available (or CHROME is set): headless render check via examples/demo/screenshot.mjs
 *    (writes to a temp file; set SKIP_BROWSER=1 to skip)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = path.resolve(import.meta.dirname, '..');
const demo = path.join(root, 'examples/demo');
const MIME = 'text/html;profile=mcp-app';
const caps = { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [MIME] } } };

const build = spawnSync('npm', ['run', '-s', 'demo:build'], { cwd: root, encoding: 'utf8' });
assert.equal(build.status, 0, build.stdout + build.stderr);

async function exercise(client, port) {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name), ['show_greeting']);
  assert.equal(tools[0]._meta.ui.resourceUri, 'ui://mf/demo-remote');
  const call = await client.callTool({ name: 'show_greeting', arguments: { name: 'Demo' } });
  const mf = call.structuredContent.resource.moduleFederation;
  assert.equal(mf.remoteName, 'demo_remote');
  assert.equal(mf.module, './Greeting');
  assert.equal(mf.remoteEntry, `http://localhost:${port}/remote/remoteEntry.js`);
  const read = await client.readResource({ uri: 'ui://mf/demo-remote' });
  assert.equal(read.contents[0].mimeType, MIME);
  assert.ok(read.contents[0].text.length > 100_000);
  return { tool: tools[0].name, remoteEntry: mf.remoteEntry, html: read.contents[0].text.length };
}

const port = 4600 + Math.floor(Math.random() * 300);
const child = spawn(process.execPath, [path.join(demo, 'server.mjs')], { env: { ...process.env, DEMO_PORT: String(port) } });
let stderr = '';
const results = {};
try {
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('demo server start timeout\n' + stderr)), 15000);
    child.stderr.on('data', (d) => { stderr += d; if (stderr.includes('Demo host:')) { clearTimeout(t); res(); } });
    child.on('exit', (c) => rej(new Error('demo server exited ' + c + '\n' + stderr)));
  });
  const base = `http://localhost:${port}`;
  const entry = await fetch(`${base}/remote/remoteEntry.js`);
  assert.equal(entry.status, 200);
  assert.match(await entry.text(), /demo_remote/);
  const host = await fetch(`${base}/`);
  assert.equal(host.status, 200);
  assert.match(await host.text(), /MCP Apps demo host/);

  const client = new Client({ name: 'verify-demo', version: '1' }, { capabilities: caps });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  results.http = await exercise(client, port);
  await client.close();

  const chrome = process.env.CHROME ?? 'google-chrome';
  const haveChrome = spawnSync(chrome, ['--version'], { encoding: 'utf8' }).status === 0;
  // screenshot.mjs talks CDP over the global WebSocket (built in on Node >= 22; on
  // Node 20.10+ it re-runs itself with --experimental-websocket).
  if (process.env.SKIP_BROWSER === '1' || !haveChrome) {
    results.browser = 'skipped';
  } else {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'demo-shot-')), 'shot.png');
    const shot = spawnSync(process.execPath, [path.join(demo, 'screenshot.mjs')], { env: { ...process.env, DEMO_URL: `${base}/`, OUT: out }, encoding: 'utf8', timeout: 90000 });
    assert.equal(shot.status, 0, shot.stdout + shot.stderr);
    assert.ok(fs.statSync(out).size > 10_000);
    // The browser host negotiates with versionNegotiation 'auto' → must land on 2026-07-28.
    assert.match(shot.stdout, /MCP 2026-07-28/, 'demo host should negotiate MCP 2026-07-28');
    results.browser = 'rendered (Hello, Demo + ui/message relayed; browser client on MCP 2026-07-28)';
  }
} finally {
  child.kill('SIGTERM');
}

// stdio mode (the MF remote is still served over HTTP for the iframe)
const sport = port + 1;
const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(demo, 'server.mjs'), '--stdio'], env: { ...process.env, DEMO_PORT: String(sport) }, stderr: 'pipe' });
const sclient = new Client({ name: 'verify-demo-stdio', version: '1' }, { capabilities: caps });
await sclient.connect(transport);
results.stdio = await exercise(sclient, sport);
await sclient.close();

console.log('CHECK7 PASS', JSON.stringify(results));
process.exit(0);
