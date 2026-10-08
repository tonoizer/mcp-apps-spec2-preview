#!/usr/bin/env node
/**
 * End-to-end with the official client (@modelcontextprotocol/client 2.3.1) against the
 * package under test (repo root), in BOTH protocol eras:
 *   - legacy  : 2025-11-25 `initialize` handshake (client default)
 *   - pin     : versionNegotiation { pin: '2026-07-28' } — server/discover, no fallback
 *   - auto    : versionNegotiation 'auto' — must land on 2026-07-28
 * over stdio (bin --stdio → serveStdio), Streamable HTTP (bin → /mcp), plain JSON /mcp-rpc
 * and in-memory (createServer + InMemoryTransport; modern via serveStdioServer({ transport })).
 * Also checks HTTP legacy session semantics and per-request UI-capability detection.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { createServer } from '../dist/server.js';
import { serveStdioServer } from '../dist/transports.js';

const root = path.resolve(import.meta.dirname, '..');
const bin = path.join(root, 'dist/index.js');
const fixture = path.join(root, 'verify/fixture.json');
const pkg = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(path.join(root, 'package.json'), 'utf8')));
const MIME = RESOURCE_MIME_TYPE;
const MODERN = '2026-07-28';
const LEGACY = '2025-11-25';
assert.equal(MIME, 'text/html;profile=mcp-app');

const uiCaps = { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [MIME] } } };
const ERAS = { legacy: 'legacy', pin: { pin: MODERN }, auto: 'auto' };
const expectedVersion = (era) => (era === 'legacy' ? LEGACY : MODERN);
const newClient = (era, capabilities = uiCaps) =>
  new Client({ name: 'verify', version: '1' }, { capabilities, versionNegotiation: { mode: ERAS[era] } });

async function exercise(client, label) {
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 1, label + ' tools');
  const tool = tools.tools[0];
  assert.equal(tool.name, 'deploy_wizard_step1');
  assert.equal(tool._meta.ui.resourceUri, 'ui://mf/demo-provider');
  assert.equal(tool.inputSchema.$schema, 'https://json-schema.org/draft/2020-12/schema', label + ' $schema');
  assert.equal(tool.execution, undefined, label + ' execution (absent = taskSupport forbidden; deleted in 2026-07-28)');
  assert.deepEqual(tool.annotations, { readOnlyHint: true });
  const call = await client.callTool({ name: 'deploy_wizard_step1', arguments: { appId: 'app-42', count: 3 } });
  assert.equal(call.structuredContent.tool, 'deploy_wizard_step1');
  assert.deepEqual(call.structuredContent.args, { appId: 'app-42', count: 3 });
  assert.equal(call.structuredContent.resource.mimeType, MIME);
  const res = await client.listResources();
  assert.equal(res.resources[0].uri, 'ui://mf/demo-provider');
  assert.equal(res.resources[0].mimeType, MIME);
  const read = await client.readResource({ uri: 'ui://mf/demo-provider' });
  assert.equal(read.contents[0].mimeType, MIME);
  assert.ok(read.contents[0].text.length > 500 && /<!doctype html/i.test(read.contents[0].text));
  assert.deepEqual(read.contents[0]._meta.ui.csp.connectDomains, ['http://localhost:8080']);
  assert.equal(read.contents[0]._meta.ui.prefersBorder, true);
  assert.deepEqual(client.getServerVersion(), { name: 'module-federation', version: pkg.version });
  return { version: client.getNegotiatedProtocolVersion(), html: read.contents[0].text.length };
}

async function connectAndExercise(era, transport, label) {
  const client = newClient(era);
  await client.connect(transport);
  const out = await exercise(client, `${label}:${era}`);
  assert.equal(out.version, expectedVersion(era), `${label}:${era} negotiated version`);
  await client.close();
  return out.version;
}

async function stdio() {
  const out = {};
  for (const era of Object.keys(ERAS)) {
    const transport = new StdioClientTransport({ command: process.execPath, args: [bin, '--config', fixture, '--stdio'], stderr: 'pipe' });
    let stderr = ''; transport.stderr?.on('data', (d) => (stderr += d));
    out[era] = await connectAndExercise(era, transport, 'stdio');
    // legacy: capabilities from initialize; modern: from the per-request envelope
    if (era === 'legacy') assert.match(stderr, /Host UI capability \(initialize\): supported/);
    assert.match(stderr, /host UI capability: supported/, `stdio:${era} per-call UI capability`);
  }
  return out;
}

async function startHttp() {
  const port = 39200 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [bin, '--config', fixture], { env: { ...process.env, PORT: String(port) } });
  const state = { stderr: '' };
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('HTTP start timeout\n' + state.stderr)), 15000);
    child.stderr.on('data', (d) => { state.stderr += d; if (String(d).includes('listening')) { clearTimeout(t); res(); } });
    child.on('exit', (c) => rej(new Error('server exited ' + c + '\n' + state.stderr)));
  });
  return { port, child, state };
}

async function http() {
  const { port, child, state } = await startHttp();
  const base = `http://127.0.0.1:${port}`;
  try {
    const out = {};
    for (const era of Object.keys(ERAS)) {
      out[era] = await connectAndExercise(era, new StreamableHTTPClientTransport(new URL(`${base}/mcp`)), 'http');
    }

    // Legacy over HTTP is sessionful: Mcp-Session-Id issued, initialize capabilities known
    // for later calls (no more "UI capability not supported" on every request), DELETE ends it.
    const lt = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
    const lc = newClient('legacy');
    await lc.connect(lt);
    assert.ok(lt.sessionId, 'legacy HTTP session id');
    const before = state.stderr.length;
    await lc.callTool({ name: 'deploy_wizard_step1', arguments: { appId: 'x', count: 1 } });
    assert.match(state.stderr.slice(before), /host UI capability: supported/);
    const sid = lt.sessionId;
    await lt.terminateSession();
    await lc.close();
    const gone = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-session-id': sid, 'mcp-protocol-version': LEGACY }, body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} }) });
    assert.equal(gone.status, 404, 'terminated session → 404');

    // Modern client WITHOUT the UI extension → detected per request (no handshake state needed).
    const nc = newClient('pin', {});
    await nc.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    const mark = state.stderr.length;
    await nc.callTool({ name: 'deploy_wizard_step1', arguments: { appId: 'y', count: 2 } });
    assert.match(state.stderr.slice(mark), /host UI capability: not supported/);
    await nc.close();

    // 0.0.x-style stateless legacy caller (no initialize, no session) still answered.
    const sl = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }) });
    assert.equal(sl.status, 200);
    assert.match(await sl.text(), /deploy_wizard_step1/);

    // /mcp-rpc (plain JSON) — legacy and 2026-07-28 envelope requests
    const rpc = async (body, headers = {}) => {
      const r = await fetch(`${base}/mcp-rpc`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
      return { status: r.status, type: r.headers.get('content-type'), json: r.status === 202 ? null : await r.json() };
    };
    const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: LEGACY, capabilities: uiCaps, clientInfo: { name: 'rpc', version: '1' } } });
    assert.equal(init.status, 200);
    const notif = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    assert.equal(notif.status, 202);
    const tools = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    assert.equal(tools.json.result.tools[0]._meta.ui.resourceUri, 'ui://mf/demo-provider');
    const envelope = {
      'io.modelcontextprotocol/protocolVersion': MODERN,
      'io.modelcontextprotocol/clientInfo': { name: 'rpc', version: '1' },
      'io.modelcontextprotocol/clientCapabilities': uiCaps,
    };
    const discover = await rpc({ jsonrpc: '2.0', id: 4, method: 'server/discover', params: { _meta: envelope } }, { 'mcp-protocol-version': MODERN, 'mcp-method': 'server/discover' });
    assert.equal(discover.status, 200, JSON.stringify(discover.json));
    assert.ok(discover.json.result.supportedVersions.includes(MODERN), JSON.stringify(discover.json.result));
    // (server/discover advertises the modern revisions only — 2025-era clients use initialize.)
    const mtools = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: { _meta: envelope } }, { 'mcp-protocol-version': MODERN, 'mcp-method': 'tools/list' });
    assert.match(mtools.type, /application\/json/);
    assert.equal(mtools.json.result.tools[0]._meta.ui.resourceUri, 'ui://mf/demo-provider');
    return { ...out, legacySession: 'issued + DELETE → 404', perRequestUiCaps: true, statelessLegacyCaller: true, mcpRpc: { legacy: true, modern: discover.json.result.supportedVersions }, port };
  } finally {
    child.kill('SIGTERM');
  }
}

async function inmemory() {
  // legacy: classic server.connect
  const server = await createServer({ configPath: fixture });
  const [cT, sT] = InMemoryTransport.createLinkedPair();
  await server.connect(sT);
  const client = newClient('legacy');
  await client.connect(cT);
  const legacy = (await exercise(client, 'inmemory:legacy')).version;
  await client.close();
  await server.close();
  // modern: the stdio era-selecting entry over an in-memory transport
  const [mc, ms] = InMemoryTransport.createLinkedPair();
  const handle = serveStdioServer(() => createServer({ configPath: fixture }), { transport: ms });
  const mclient = newClient('pin');
  await mclient.connect(mc);
  const modern = (await exercise(mclient, 'inmemory:pin')).version;
  assert.equal(modern, MODERN);
  await mclient.close();
  await handle.close();
  return { legacy, pin: modern };
}

const results = {
  stdio: await stdio(),
  http: await http(),
  inmemory: await inmemory(),
};
console.log('CHECK3 PASS', JSON.stringify(results));
