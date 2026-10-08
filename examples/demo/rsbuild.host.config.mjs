import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'node:path';

// Builds the tiny demo host page served at /.
export default defineConfig({
  root: path.join(import.meta.dirname, 'host'),
  plugins: [pluginReact()],
  source: { entry: { index: './src/index.jsx' } },
  html: { title: 'MCP Apps demo host' },
  output: {
    distPath: { root: path.join(import.meta.dirname, 'dist/host') },
    cleanDistPath: true,
  },
  performance: { chunkSplit: { strategy: 'all-in-one' } },
});
