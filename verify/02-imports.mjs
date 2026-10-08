import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

async function keysOf(spec) {
  const mod = await import(spec);
  return Object.keys(mod).sort();
}

const pkg = JSON.parse(require('fs').readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './react', './renderer', './types']);

const main = await keysOf(pathToFileURL(path.join(root, 'dist/server.js')).href);
assert.deepEqual(main, ['createServer']);

const types = await keysOf(pathToFileURL(path.join(root, 'dist/types.js')).href);
assert.deepEqual(types, []);

const react = await keysOf(pathToFileURL(path.join(root, 'dist/react/index.js')).href);
assert.deepEqual(react, ['McpAppRenderer']);

// renderer needs a CSS loader under plain Node
const r = spawnSync(process.execPath, ['--import', path.join(root, 'verify/css-stub.mjs'), '--input-type=module', '-e',
  `const m=await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/renderer.js')).href)}); console.log(JSON.stringify(Object.keys(m).sort()));`],
  { encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr);
assert.deepEqual(JSON.parse(r.stdout.trim()), ['MFContext','MFProvider','RemoteComponentContainer','useMFContext','useRemoteComponent']);

// bin module graph: resolve every top-level import from dist/index.js
for (const dep of ['@modelcontextprotocol/express','@modelcontextprotocol/node','@modelcontextprotocol/server','@modelcontextprotocol/server/stdio','cors','express']) {
  await import(dep);
}
console.log('CHECK2 PASS', { main, react, renderer: JSON.parse(r.stdout.trim()) });
