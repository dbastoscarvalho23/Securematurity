// Versão de demonstração (dados fictícios, sem backend) só para capturas de ecrã. Não é publicada.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
export default defineConfig({
  root: repo,
  logLevel: 'warn',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/api/base44Client', replacement: path.join(here, 'mockBase44.js') },
      { find: '@', replacement: path.join(repo, 'src') },
    ],
  },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, sourcemap: false },
});
// 1793066588
