#!/usr/bin/env node
/**
 * MCP Apps demo server — uses only the package's public API (`createServer`,
 * `createStreamableHttpHandler`, `serveStdioServer`) on top of the official
 * MCP SDK v2 adapters. Both transports speak MCP 2026-07-28 (server/discover)
 * and 2025-11-25 (initialize) on the same endpoint.
 *
 *   node examples/demo/server.mjs          # Streamable HTTP on http://localhost:4173/mcp + demo host + MF remote
 *   node examples/demo/server.mjs --stdio  # MCP over stdio (MF remote still served on :4173 for the iframe)
 *
 * Env: DEMO_PORT (default 4173)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer } from '@module-federation/mcp-apps';
import { createStreamableHttpHandler, serveStdioServer } from '@module-federation/mcp-apps/transports';
import { createMcpExpressApp } from '@modelcontextprotocol/express';

const here = import.meta.dirname;
const port = Number(process.env.DEMO_PORT ?? 4173);
const stdio = process.argv.includes('--stdio');
const log = (...a) => console.error('[demo]', ...a); // stderr only (stdout is the stdio MCP channel)

for (const dir of ['dist/remote/remoteEntry.js', 'dist/host/index.html']) {
  if (!fs.existsSync(path.join(here, dir))) {
    log(`missing examples/demo/${dir} — run \`npm run demo:build\` first`);
    process.exit(1);
  }
}

// Point the config at the port we actually listen on.
const template = fs.readFileSync(path.join(here, 'mcp_apps.json'), 'utf8');
const configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-apps-demo-')), 'mcp_apps.json');
fs.writeFileSync(configPath, template.replaceAll('localhost:4173', `localhost:${port}`));

// No shellBaseUrl → resources/read returns the self-contained mcp-app.html, so the
// host can render it via srcDoc without serving /static assets.
const factory = () => createServer({ configPath });

// Default options = localhost-only Host validation (DNS-rebinding protection).
const app = createMcpExpressApp();
app.use('/remote', express.static(path.join(here, 'dist/remote'), {
  setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*'),
}));
app.use('/', express.static(path.join(here, 'dist/host')));

let mcpHandler;
if (!stdio) {
  mcpHandler = createStreamableHttpHandler(factory, { onerror: (e) => log('MCP error:', e) });
  app.all('/mcp', (req, res) => void mcpHandler.handle(req, res, req.body));
}

const httpServer = app.listen(port, () => {
  log(`MF remote:   http://localhost:${port}/remote/remoteEntry.js`);
  if (!stdio) {
    log(`MCP (HTTP):  http://localhost:${port}/mcp`);
    log(`Demo host:   http://localhost:${port}/`);
  }
});

let stdioHandle;
if (stdio) {
  stdioHandle = serveStdioServer(factory, { onerror: (e) => log('MCP error:', e) });
  log('MCP (stdio): ready');
}

const shutdown = async () => {
  await mcpHandler?.close?.();
  await stdioHandle?.close?.();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
