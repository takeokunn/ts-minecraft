import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'shared-layer',
    environment: 'node',
    include: ['tests/unit/shared/**/*.test.ts'],
    exclude: [
      'tests/unit/shared/**/index.ts',
      'tests/unit/shared/**/*.d.ts',
      'node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/shared',
      include: ['src/shared/**/*.ts'],
      exclude: [
        'src/shared/**/*.d.ts',
        'src/shared/**/index.ts',
        'src/shared/types/external.d.ts',
        'src/shared/REFACTORING_SUMMARY.md'
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      },
      all: true,
      clean: true,
      skipFull: false
    },
    globals: true,
    setupFiles: ['tests/setup/shared.setup.ts'],
    testTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@application': path.resolve(__dirname, './src/application'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"'
  }
})