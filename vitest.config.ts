import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 30000,
    hookTimeout: 20000,
    include: ['src/shared/**/__test__/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/docs/**'],
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'src/test'),
    },
  },
})
