import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, 'core/main/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/main'),
            rollupOptions: {
              external: ['mqtt', 'ws', 'bufferutil', 'utf-8-validate'],
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'core/main/preload/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/preload'),
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/history',
    ],
    alias: {
      '@components': path.resolve(__dirname, 'core/renderer/components'),
      '@@components': path.resolve(__dirname, 'core/packages/ui/src'),
      '@devtoolbox/ui': path.resolve(__dirname, 'core/packages/ui/src'),
      '@devtoolbox/core': path.resolve(__dirname, 'core/packages/core/src'),
      // events polyfill: override vite-plugin-electron-renderer interception of Node.js built-ins
      events: path.resolve(__dirname, 'node_modules/events/events.js'),
    },
  },
  define: {
    'process.env': {},
    'process.stdout': 'undefined',
    'process.stderr': 'undefined',
    'process.version': '""',
  },
  root: 'core/renderer',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false,
  },
});
