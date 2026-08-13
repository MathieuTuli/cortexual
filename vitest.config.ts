import { defineConfig } from 'vitest/config'
import path from 'path'

// Deliberately not reusing vite.config.ts: it proxies /api at the running
// daemon, which a test run has no business depending on.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // react-tweet ships CSS module imports. Left external, Node tries to
    // require the .css itself and throws; inlined, Vite transforms it.
    server: { deps: { inline: ['react-tweet'] } },
  },
})
