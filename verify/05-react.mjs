#!/usr/bin/env node
/**
 * React renderer: import + AppBridge 2.0.3 API presence + jsdom mount +
 * host/view handshake interop (AppBridge 2.0.3 host vs App 1.x and App 2.0.3 views).
 * jsdom + ext-apps@1 are installed into a temp dir so repo deps stay unchanged.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-apps-react-'));
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tmp', private: true, type: 'module' }));
const r = spawnSync('npm', ['i', 'jsdom@26', '@modelcontextprotocol/ext-apps@1'], { cwd: tmp, encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr);
const tmpMod = (p) => pathToFileURL(path.join(tmp, 'node_modules', p)).href;

// 1. AppBridge API used by dist/react/McpAppRenderer.js exists in 2.0.3
const { AppBridge, PostMessageTransport } = await import('@modelcontextprotocol/ext-apps/app-bridge');
for (const k of ['addEventListener', 'sendToolInput', 'sendToolResult', 'connect', 'close']) {
  assert.equal(typeof AppBridge.prototype[k], 'function', `AppBridge.${k}`);
}
for (const k of ['onsizechange', 'onmessage', 'onopenlink']) {
  assert.ok(Object.getOwnPropertyDescriptor(AppBridge.prototype, k)?.set, `AppBridge.${k} setter`);
}
assert.equal(typeof PostMessageTransport, 'function');

// 2. jsdom mount
const { JSDOM } = await import(tmpMod('jsdom/lib/api.js'));
const dom = new JSDOM('<!doctype html><div id=root></div>', { pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;
for (const k of ['window', 'document', 'HTMLElement', 'HTMLIFrameElement', 'Node', 'Element', 'Event', 'MessageEvent', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) {
  Object.defineProperty(globalThis, k, { value: k === 'window' ? window : k === 'document' ? window.document : window[k], configurable: true, writable: true });
}
// Node 20 has no global navigator (Node 21+ does); react-dom dev build reads it at load.
if (!('navigator' in globalThis)) Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
window.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { McpAppRenderer } = await import(pathToFileURL(path.join(root, 'dist/react/index.js')).href);
const errors = [];
process.on('unhandledRejection', (e) => errors.push(String(e)));
const mount = document.getElementById('root');
const rootEl = createRoot(mount);
await React.act(async () => {
  rootEl.render(React.createElement(McpAppRenderer, { uiResource: { html: '<!doctype html><p>hi</p>', callToolResult: { content: [] } }, messageId: 'm1' }));
});
await React.act(async () => { await new Promise((res) => setTimeout(res, 200)); });
const iframe = document.querySelector('iframe');
assert.ok(iframe, 'iframe rendered');
assert.equal(iframe.getAttribute('title'), 'mcp-ui-m1');
assert.ok(iframe.getAttribute('srcdoc').includes('<p>hi</p>'));
const mount2 = document.body.appendChild(document.createElement('div'));
const root2 = createRoot(mount2);
const ow = console.warn; console.warn = () => {};
await React.act(async () => { root2.render(React.createElement(McpAppRenderer, { uiResource: {} })); });
console.warn = ow;
assert.match(mount2.textContent, /missing HTML content/);
await React.act(async () => { rootEl.unmount(); root2.unmount(); });
assert.deepEqual(errors, []);

// 3. Handshake interop with the exact bridge config used by McpAppRenderer
const { InMemoryTransport } = await import('@modelcontextprotocol/server');
async function interop(label, AppCtor) {
  const bridge = new AppBridge(null, { name: 'mcp-app-host', version: '1.0.0' }, { openLinks: {} }, {
    hostContext: { theme: 'light', platform: 'web', containerDimensions: { maxHeight: 6000 }, displayMode: 'inline', availableDisplayModes: ['inline'] },
  });
  const got = {};
  bridge.onmessage = async (p) => { got.msg = p; return {}; };
  bridge.onsizechange = ({ height }) => { got.size = height; };
  const initialized = new Promise((res) => bridge.addEventListener('initialized', () => res()));
  const [hostT, viewT] = InMemoryTransport.createLinkedPair();
  const app = new AppCtor({ name: 'view', version: '1.0.0' }, {}, { autoResize: false });
  const inP = new Promise((res) => { app.ontoolinput = (p) => { got.input = p; res(); }; });
  const outP = new Promise((res) => { app.ontoolresult = (p) => { got.result = p; res(); }; });
  await bridge.connect(hostT);
  await app.connect(viewT);
  await initialized;
  await bridge.sendToolInput({ arguments: { appId: 'a1' } });
  await bridge.sendToolResult({ content: [{ type: 'text', text: 'ok' }], structuredContent: { ok: true } });
  await Promise.race([Promise.all([inP, outP]), new Promise((_, j) => setTimeout(() => j(new Error(label + ': timeout')), 5000))]);
  await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'next' }] });
  assert.deepEqual(got.input.arguments, { appId: 'a1' });
  assert.deepEqual(got.result.structuredContent, { ok: true });
  assert.equal(got.msg.content[0].text, 'next');
  await app.close?.(); await bridge.close?.();
  return 'ok';
}
const { App: App2 } = await import('@modelcontextprotocol/ext-apps');
const { App: App1 } = await import(tmpMod('@modelcontextprotocol/ext-apps/dist/src/app.js'));
const v1 = JSON.parse(fs.readFileSync(path.join(tmp, 'node_modules/@modelcontextprotocol/ext-apps/package.json'), 'utf8')).version;
const interopRes = { [`App ${v1}`]: await interop('v1', App1), 'App 2.0.3': await interop('v2', App2) };
console.log('CHECK5 PASS', JSON.stringify({ mount: 'ok', fallback: 'ok', interop: interopRes }));
process.exit(0);
