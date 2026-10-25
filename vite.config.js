import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const selfHosted = (process.env.VITE_BACKEND_MODE || env.VITE_BACKEND_MODE) === 'selfhosted'

  if (selfHosted) {
    // Servidor próprio: sem o plugin Base44; /api é encaminhado para o backend em server/.
    const target = process.env.VITE_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || 'http://localhost:3001'
    return {
      logLevel: 'error',
      plugins: [react()],
      resolve: { alias: { '@': path.resolve(rootDir, 'src') } },
      server: {
        host: true,
        port: 5173,
        watch: { usePolling: true },
        proxy: { '/api': { target, changeOrigin: true } },
      },
    }
  }

  return {
    logLevel: 'error', // Suppress warnings, only show errors
    plugins: [
      base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      }),
      react(),
    ],
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,
      },
    },
  }
});
