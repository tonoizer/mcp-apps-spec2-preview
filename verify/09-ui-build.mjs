#!/usr/bin/env node
/**
 * The embedded MCP App (dist/mcp-app.html + dist/mcp-app-shell.html + dist/static) is
 * rebuilt from ui/mcp-app.jsx with @modelcontextprotocol/ext-apps 2.x. This check:
 *   1. rebuilds it (`npm run build:ui`) and asserts the committed artefacts are byte-identical
 *      (reproducible build, nothing stale checked in);
 *   2. asserts the bundle carries the ext-apps 2.x App (addEventListener-based) and no
 *      async chunks / unreplaced asset paths that a srcdoc iframe could not load;
 *   3. asserts the shell HTML only references files that exist under dist/static.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const artefacts = () => [
  'mcp-app.html', 'mcp-app-shell.html',
  ...fs.readdirSync(path.join(dist, 'static/js')).map((f) => `static/js/${f}`),
  ...fs.readdirSync(path.join(dist, 'static/css')).map((f) => `static/css/${f}`),
].sort();
const hashes = () => Object.fromEntries(artefacts().map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, f))).digest('hex')]));

const before = hashes();
const b = spawnSync('npm', ['run', '-s', 'build:ui'], { cwd: root, encoding: 'utf8' });
assert.equal(b.status, 0, b.stderr);
const after = hashes();
assert.deepEqual(after, before, 'committed UI artefacts differ from a fresh `npm run build:ui`');

const inline = fs.readFileSync(path.join(dist, 'mcp-app.html'), 'utf8');
assert.ok(!/<script[^>]+src=/.test(inline), 'mcp-app.html must be self-contained');
assert.ok(!inline.includes('/static/js/async/'), 'no async chunks in the inline build');
assert.ok(inline.includes('addEventListener("toolresult"'), 'shell subscribes via App.addEventListener (ext-apps 2.x)');
assert.ok(inline.includes('called before connect()'), 'ext-apps 2.x App bundled');
const extAppsVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@modelcontextprotocol/ext-apps/package.json'), 'utf8')).version;
assert.match(extAppsVersion, /^2\./);

const shell = fs.readFileSync(path.join(dist, 'mcp-app-shell.html'), 'utf8');
const refs = [...shell.matchAll(/__MF_MCP_BASE__\/(static\/[^"]+)/g)].map((m) => m[1]);
assert.ok(refs.length >= 2, 'shell references its assets via __MF_MCP_BASE__');
for (const r of refs) assert.ok(fs.existsSync(path.join(dist, r)), `missing ${r}`);
for (const f of fs.readdirSync(path.join(dist, 'static/js')).filter((f) => f.endsWith('.js'))) {
  assert.ok(!fs.readFileSync(path.join(dist, 'static/js', f), 'utf8').includes('static/js/async/'), `${f} must not lazy-load chunks`);
}
console.log('CHECK9 PASS', JSON.stringify({ extApps: extAppsVersion, reproducible: true, inlineBytes: inline.length, shellRefs: refs }));
