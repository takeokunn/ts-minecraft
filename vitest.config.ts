import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { cpus } from 'os'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 30000,
    hookTimeout: 20000,
    include: ['src/**/__tests__/*.test.ts', 'src/**/__test__/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/docs/**'],
    maxConcurrency: Math.min(8, cpus().length),
    minWorkers: 1,
    maxWorkers: Math.min(4, cpus().length),
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'src/test'),
    },
  },
})
