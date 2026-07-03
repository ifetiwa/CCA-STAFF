import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri expects a fixed dev-server port and its own file-watching rules.
// These settings are inert for the plain web build/deploy (Vercel etc.).
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Don't clobber Tauri's own console output during `tauri dev`.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 5183 } : undefined,
    watch: {
      // Tauri's Rust sources are watched by cargo, not Vite.
      ignored: ['**/src-tauri/**'],
    },
  },
})
