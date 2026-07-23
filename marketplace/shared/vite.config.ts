import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sharedDir = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = path.resolve(sharedDir, '../../core/packages/plugin-sdk');
const sdkDistReady = ['index.js', 'react.js'].every((file) => fs.existsSync(path.join(sdkDir, 'dist', file)));
const sdkEntry = (name: 'index' | 'react') =>
  path.join(sdkDir, sdkDistReady ? `dist/${name}.js` : `src/${name}${name === 'react' ? '.tsx' : '.ts'}`);

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      { find: '@devtoolbox/plugin-sdk/react', replacement: sdkEntry('react') },
      { find: '@devtoolbox/plugin-sdk', replacement: sdkEntry('index') },
    ],
  },
  build: {
    outDir: 'package',
    emptyOutDir: true,
    manifest: true,
    chunkSizeWarningLimit: 625,
  },
});
