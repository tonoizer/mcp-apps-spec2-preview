#!/usr/bin/env node
/**
 * Builds the MCP App shell (ui/mcp-app.jsx) into the two artefacts the server serves:
 *   dist/mcp-app.html         self-contained (inline JS/CSS) — stdio / no shellBaseUrl
 *   dist/mcp-app-shell.html   tiny shell loading __MF_MCP_BASE__/static/{js,css}/* — HTTP mode
 *   dist/static/{js,css}/     assets for the shell
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRsbuild } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'node_modules/.cache/mcp-apps-ui');
const common = {
  root,
  plugins: [pluginReact()],
  html: { template: path.join(root, 'ui/index.html'), inject: 'body' },
  output: { filenameHash: false, cleanDistPath: true },
  performance: { buildCache: false },
  // Single-file / placeholder-prefixed output: no lazily-loaded chunks (an async chunk
  // could not be fetched from a srcdoc iframe, and the shell's JS keeps the literal
  // __MF_MCP_BASE__ placeholder that only the HTML gets rewritten for).
  tools: { rspack: { output: { asyncChunks: false } } },
};

async function build(name, config) {
  const rsbuild = await createRsbuild({ cwd: root, rsbuildConfig: config });
  await rsbuild.build();
  console.error(`[build:ui] ${name} done`);
}

await build('inline', {
  ...common,
  source: { entry: { 'mcp-app': path.join(root, 'ui/mcp-app.jsx') } },
  output: { ...common.output, distPath: { root: path.join(out, 'inline') }, inlineScripts: true, inlineStyles: true, legalComments: 'none' },
  performance: { ...common.performance, chunkSplit: { strategy: 'all-in-one' } },
});
await build('shell', {
  ...common,
  source: { entry: { 'mcp-app-shell': path.join(root, 'ui/mcp-app.jsx') } },
  output: { ...common.output, distPath: { root: path.join(out, 'shell') }, assetPrefix: '__MF_MCP_BASE__/', legalComments: 'linked' },
});

const dist = path.join(root, 'dist');
fs.copyFileSync(path.join(out, 'inline/mcp-app.html'), path.join(dist, 'mcp-app.html'));
fs.copyFileSync(path.join(out, 'shell/mcp-app-shell.html'), path.join(dist, 'mcp-app-shell.html'));
for (const sub of ['js', 'css']) {
  const target = path.join(dist, 'static', sub);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(path.join(out, 'shell/static', sub), target, { recursive: true });
}
const size = (p) => fs.statSync(path.join(dist, p)).size;
console.error(`[build:ui] dist/mcp-app.html ${size('mcp-app.html')} B, dist/mcp-app-shell.html ${size('mcp-app-shell.html')} B`);
console.error('[build:ui] dist/static:', fs.readdirSync(path.join(dist, 'static/js')).join(', '), '|', fs.readdirSync(path.join(dist, 'static/css')).join(', '));
