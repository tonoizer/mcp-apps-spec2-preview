import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'node:path';

// Builds the Module Federation remote served at /remote/remoteEntry.js.
export default defineConfig({
  root: path.join(import.meta.dirname, 'remote'),
  plugins: [pluginReact()],
  source: { entry: { index: './src/index.js' } },
  html: { inject: false, template: undefined },
  output: {
    distPath: { root: path.join(import.meta.dirname, 'dist/remote') },
    assetPrefix: 'auto',
    cleanDistPath: true,
    filenameHash: false,
  },
  tools: { htmlPlugin: false },
  moduleFederation: {
    options: {
      name: 'demo_remote',
      filename: 'remoteEntry.js',
      exposes: { './Greeting': './src/Greeting.jsx' },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    },
  },
});
