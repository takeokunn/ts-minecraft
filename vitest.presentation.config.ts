import { defineConfig } from 'vitest/config'
import * as path from 'path'

export default defineConfig({
  test: {
    name: 'presentation',
    environment: 'jsdom',
    include: ['src/presentation/**/*.test.ts'],
    exclude: [
      'src/presentation/**/index.ts',
      'src/presentation/**/*.d.ts',
      'node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/presentation/**/*.ts'],
      exclude: [
        'src/presentation/**/index.ts',
        'src/presentation/**/*.d.ts',
        'src/presentation/**/*.md'
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      },
      all: true,
      skipFull: false
    },
    globals: true,
    setupFiles: ['./src/presentation/__tests__/setup.ts'],
    // Extended timeout for presentation tests that may involve rendering
    testTimeout: 10000,
    // Allow tests to run in parallel
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    }
  },
  resolve: {
    alias: {
      '@presentation': path.resolve(__dirname, 'src/presentation'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  // Define custom properties for presentation testing
  define: {
    __VITEST_PRESENTATION__: true
  }
})