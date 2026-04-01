import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Keep a stable origin so localStorage/sessionStorage don't reset
    // when restarting the dev server.
    port: 5173,
    strictPort: true,
  },
})
