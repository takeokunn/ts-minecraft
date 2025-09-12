import { defineConfig } from 'vitest/config'
import * as path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/unit/infrastructure/**/*.test.ts',
      'src/infrastructure/**/__tests__/**/*.test.ts'
    ],
    exclude: [
      'tests/unit/infrastructure/**/index.ts',
      'tests/unit/infrastructure/**/*.d.ts',
      'src/infrastructure/**/index.ts',
      'src/infrastructure/**/*.d.ts',
      'node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/infrastructure/**/*.ts'],
      exclude: [
        'src/infrastructure/**/index.ts',
        'src/infrastructure/**/*.d.ts',
        'src/infrastructure/**/*.md',
        'src/infrastructure/INFRASTRUCTURE_ARCHITECTURE.md',
        'src/infrastructure/workers/README.md'
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
    setupFiles: ['tests/setup/infrastructure.setup.ts'],
    // Extended timeout for infrastructure tests that may involve heavy operations
    testTimeout: 10000,
    // Allow tests to run in parallel but limit concurrency for resource-heavy tests
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
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure')
    }
  },
  // Define custom properties for infrastructure testing
  define: {
    __VITEST_INFRASTRUCTURE__: true
  }
})