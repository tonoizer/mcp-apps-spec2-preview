#!/usr/bin/env node
/**
 * Compare public API surface vs npm @module-federation/mcp-apps@0.0.6.
 * Packs both, installs into temp consumers, diffs runtime exports + CLI flags +
 * tools/list / resources/read metadata (stdio roundtrip).
 */
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-apps-surface-'));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r;
}

// Both tarballs are named module-federation-mcp-apps-0.0.6.tgz, so pack into separate dirs.
fs.mkdirSync(path.join(tmp, 'pack-new')); fs.mkdirSync(path.join(tmp, 'pack-old'));
const newPack = path.join('pack-new', run('npm', ['pack', '--pack-destination', path.join(tmp, 'pack-new')], { cwd: root }).stdout.trim().split('\n').pop());
const oldPack = path.join('pack-old', run('npm', ['pack', '@module-federation/mcp-apps@0.0.6', '--pack-destination', path.join(tmp, 'pack-old')]).stdout.trim().split('\n').pop());

function setup(name, tgz, extraDeps) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, type: 'module', private: true }));
  run('npm', ['i', path.join(tmp, tgz), 'react@18.3.1', 'react-dom@18.3.1', ...extraDeps], { cwd: dir });
  return dir;
}

const newDir = setup('new', newPack, ['@modelcontextprotocol/client@2.3.1']);
const oldDir = setup('old', oldPack, ['@modelcontextprotocol/sdk@1']);

const cssStub = path.join(root, 'verify/css-stub.mjs');
function exportKeys(dir, entry, withCss = false) {
  const args = withCss
    ? ['--import', cssStub, '--input-type=module', '-e', `const m=await import(${JSON.stringify(entry)}); console.log(JSON.stringify(Object.keys(m).sort()));`]
    : ['--input-type=module', '-e', `const m=await import(${JSON.stringify(entry)}); console.log(JSON.stringify(Object.keys(m).sort()));`];
  const r = run(process.execPath, args, { cwd: dir });
  return JSON.parse(r.stdout.trim());
}

const entries = {
  '.': '@module-federation/mcp-apps',
  './types': '@module-federation/mcp-apps/types',
  './react': '@module-federation/mcp-apps/react',
  './renderer': '@module-federation/mcp-apps/renderer',
};
const surface = {};
for (const [k, spec] of Object.entries(entries)) {
  const n = exportKeys(newDir, spec, k === './renderer');
  const o = exportKeys(oldDir, spec, k === './renderer');
  assert.deepEqual(n, o, `export mismatch for ${k}`);
  surface[k] = n;
}

function cliFlags(dir) {
  const src = fs.readFileSync(path.join(dir, 'node_modules/@module-federation/mcp-apps/dist/index.js'), 'utf8');
  return [...src.matchAll(/--[a-zA-Z0-9-]+/g)].map(m => m[0]).sort();
}
assert.deepEqual([...new Set(cliFlags(newDir))], [...new Set(cliFlags(oldDir))]);

// runtime metadata parity (stdio)
async function meta(dir, flavor) {
  const script = `
import { spawn } from 'node:child_process';
import path from 'node:path';
${flavor === 'v2'
  ? `import { Client } from '@modelcontextprotocol/client';
     import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';`
  : `import { Client } from '@modelcontextprotocol/sdk/client/index.js';
     import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';`}
const bin = path.resolve('node_modules/@module-federation/mcp-apps/dist/index.js');
const fixture = ${JSON.stringify(path.join(root, 'verify/fixture.json'))};
const transport = new StdioClientTransport({ command: process.execPath, args: [bin, '--config', fixture, '--stdio'], stderr: 'pipe' });
const client = new Client({ name: 's', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } });
await client.connect(transport);
const tools = await client.listTools();
const call = await client.callTool({ name: 'deploy_wizard_step1', arguments: { appId: 'x' } });
const read = await client.readResource({ uri: 'ui://mf/demo-provider' });
const pick = {
  name: tools.tools[0].name,
  uri: tools.tools[0]._meta.ui.resourceUri,
  visibility: tools.tools[0]._meta.ui.visibility,
  callMime: call.structuredContent.resource.mimeType,
  readMime: read.contents[0].mimeType,
  csp: read.contents[0]._meta.ui.csp,
  prefersBorder: read.contents[0]._meta.ui.prefersBorder,
  htmlLen: read.contents[0].text.length,
};
console.log(JSON.stringify(pick));
await client.close();
`;
  const r = run(process.execPath, ['--input-type=module', '-e', script], { cwd: dir });
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
const newMeta = await meta(newDir, 'v2');
const oldMeta = await meta(oldDir, 'v1');
assert.deepEqual(newMeta, oldMeta, 'behavioral metadata diverged from 0.0.6');

console.log('CHECK4 PASS', { surface, cliFlags: [...new Set(cliFlags(newDir))], meta: newMeta });
