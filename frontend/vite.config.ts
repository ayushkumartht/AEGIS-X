import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import cesiumImport from 'vite-plugin-cesium-next'

// The package ships one .d.ts for both its CJS and ESM builds. TypeScript (nodenext) types the
// default import as the CJS namespace, while Vite loads the ESM build where it is the plugin
// function itself, so accept either shape.
const cesium = ((cesiumImport as unknown as { default?: unknown }).default ?? cesiumImport) as unknown as () => Plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cesium()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
