import { defineConfig } from 'vitest/config'
import path from 'path'

// Deliberately not reusing vite.config.ts: importing it runs fileStoragePlugin's
// module-level bootstrap, which writes into data/.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
