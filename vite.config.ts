import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Storage, media and content fetching live in server/ and run as their own
// process, so the built app works without a bundler and the extension has a
// stable endpoint. Dev just proxies through to it.
const API_PORT = process.env.API_PORT || '3001'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },
})
