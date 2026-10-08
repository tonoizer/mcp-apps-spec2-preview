#!/usr/bin/env node
/**
 * Headless-Chrome check + screenshot of the running demo (no Playwright needed;
 * talks CDP over Node's built-in WebSocket: Node >= 22, or Node 20.10+ with
 * `node --experimental-websocket`).
 *
 *   npm run demo            # in another terminal
 *   npm run demo:screenshot # -> examples/demo/screenshot.png
 *
 * Env: DEMO_URL (default http://localhost:4173/), CHROME (default google-chrome), OUT
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.env.DEMO_URL ?? 'http://localhost:4173/';
const chrome = process.env.CHROME ?? 'google-chrome';
const out = process.env.OUT ?? path.join(import.meta.dirname, 'screenshot.png');
const debugPort = 9300 + Math.floor(Math.random() * 500);
if (typeof WebSocket === 'undefined') {
  // Node 20.10+: the global WebSocket is behind a flag — re-run ourselves with it.
  if (process.execArgv.includes('--experimental-websocket')) throw new Error('global WebSocket missing: use Node >= 22 (or Node 20.10+)');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, ['--experimental-websocket', ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-apps-demo-chrome-'));
const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`, '--window-size=1100,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!target) await sleep(200);
}
if (!target) throw new Error('Chrome did not start');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.consoleAPICalled') logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  if (msg.method === 'Runtime.exceptionThrown') logs.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
};
const send = (method, params = {}) => new Promise((r, j) => {
  const mid = ++id; pending.set(mid, (m) => (m.error ? j(new Error(`${method}: ${m.error.message}`)) : r(m.result)));
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
const waitFor = async (expression, label, timeout = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await evaluate(expression).catch(() => false)) return; await sleep(250); }
  throw new Error(`timeout waiting for ${label}\n--- page console ---\n${logs.slice(-30).join('\n')}`);
};

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  const frameText = `(() => { const f = document.querySelector('iframe'); return f?.contentDocument?.body?.innerText ?? ''; })()`;
  await waitFor(`document.body.innerText.includes('show_greeting')`, 'tools/list in host');
  await waitFor(`${frameText}.includes('Hello, Demo')`, 'MF remote rendered inside MCP App iframe');
  // Interact: click counter twice + send ui/message to host.
  const click = (match) => evaluate(`(() => { const d = document.querySelector('iframe').contentDocument; [...d.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(match)})).click(); return true; })()`);
  await click('Clicked'); await sleep(150);
  await click('Clicked'); await sleep(150);
  await waitFor(`${frameText}.includes('Clicked 2×')`, 'remote component state update (shared React)');
  await click('Send message');
  await waitFor(`document.body.innerText.includes("Hello from the MCP Apps demo (greeting: Demo, clicked 2x)")`, 'ui/message relayed to host');
  await sleep(300);
  const { cssContentSize } = await send('Page.getLayoutMetrics');
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1100, height: Math.ceil(Math.max(cssContentSize.height, 600)), scale: 1 } });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  const summary = await evaluate(`({ host: document.body.innerText.slice(0, 400), app: ${frameText}.slice(0, 300) })`);
  console.log(JSON.stringify({ ok: true, screenshot: out, ...summary }, null, 2));
} finally {
  ws.close();
  proc.kill('SIGKILL');
  fs.rmSync(profile, { recursive: true, force: true });
}
