import { defineConfig } from 'vitest/config';
import path from 'path';

// Test config intentionally WITHOUT the base44 vite plugin — no injected
// session, no backend, no env vars needed. Tests mock AuthContext directly.
export default defineConfig({
  // Match the app's automatic JSX runtime (some components don't import React)
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.jsx'],
  },
});
