import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
      events: path.resolve(__dirname, 'node_modules/events/events.js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./core/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
