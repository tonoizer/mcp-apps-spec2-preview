#!/usr/bin/env node
/**
 * End-to-end: stdio + Streamable HTTP + /mcp-rpc + InMemoryTransport.
 * Uses the package under test (repo root) and @modelcontextprotocol/client 2.3.1.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { createServer } from '../dist/server.js';

const root = path.resolve(import.meta.dirname, '..');
const bin = path.join(root, 'dist/index.js');
const fixture = path.join(root, 'verify/fixture.json');
const MIME = RESOURCE_MIME_TYPE;
assert.equal(MIME, 'text/html;profile=mcp-app');

const caps = { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [MIME] } } };

async function exercise(client, label) {
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 1, label + ' tools');
  assert.equal(tools.tools[0].name, 'deploy_wizard_step1');
  assert.equal(tools.tools[0]._meta.ui.resourceUri, 'ui://mf/demo-provider');
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
  return { tools: tools.tools.length, html: read.contents[0].text.length, mime: MIME };
}

async function stdio() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [bin, '--config', fixture, '--stdio'], stderr: 'pipe' });
  let stderr = ''; transport.stderr?.on('data', d => stderr += d);
  const client = new Client({ name: 'verify', version: '1' }, { capabilities: caps });
  await client.connect(transport);
  const out = await exercise(client, 'stdio');
  await client.close();
  assert.match(stderr, /Host UI capability: supported/);
  return { ...out, ui: 'supported' };
}

async function http() {
  const port = 39200 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [bin, '--config', fixture], { env: { ...process.env, PORT: String(port) } });
  let stderr = '';
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('HTTP start timeout\n' + stderr)), 15000);
    child.stderr.on('data', d => { stderr += d; if (String(d).includes('listening')) { clearTimeout(t); res(); } });
    child.on('exit', c => rej(new Error('server exited ' + c + '\n' + stderr)));
  });
  try {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
    const client = new Client({ name: 'verify', version: '1' }, { capabilities: caps });
    await client.connect(transport);
    const out = await exercise(client, 'http');
    await client.close();

    // /mcp-rpc
    const rpc = async (body) => {
      const r = await fetch(`http://127.0.0.1:${port}/mcp-rpc`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, json: r.status === 202 ? null : await r.json() };
    };
    const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: caps, clientInfo: { name: 'rpc', version: '1' } } });
    assert.equal(init.status, 200);
    const notif = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    assert.equal(notif.status, 202);
    const tools = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    assert.equal(tools.json.result.tools[0]._meta.ui.resourceUri, 'ui://mf/demo-provider');
    return { ...out, mcpRpc: true, port };
  } finally {
    child.kill('SIGTERM');
  }
}

async function inmemory() {
  const server = await createServer({ configPath: fixture });
  const [cT, sT] = InMemoryTransport.createLinkedPair();
  await server.connect(sT);
  const client = new Client({ name: 'mem', version: '1' }, { capabilities: caps });
  await client.connect(cT);
  const out = await exercise(client, 'inmemory');
  await client.close();
  await server.close();
  return out;
}

const results = {
  stdio: await stdio(),
  http: await http(),
  inmemory: await inmemory(),
};
console.log('CHECK3 PASS', JSON.stringify(results));
