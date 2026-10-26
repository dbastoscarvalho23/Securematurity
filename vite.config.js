import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const isPreview = process.env.BASE44_PREVIEW_MODE === '1';

export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  server: {
    host: '0.0.0.0',
    // Base44 sandbox: accept the preview proxy host (sandbox id rotates, use wildcard)
    ...(isPreview && process.env.BASE44_SANDBOX_HOST_DOMAIN
      ? { allowedHosts: [`.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`] }
      : {}),
  },
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
});