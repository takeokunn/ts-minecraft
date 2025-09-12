import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'tests/unit/root/**/*.test.ts' // Tests for src/*.ts files
    ],
    exclude: [
      'tests/unit/**/index.ts',
      'tests/unit/**/*.d.ts',
      'node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/*.ts' // Only include files directly in src/
      ],
      exclude: [
        'src/**/index.ts',
        'src/**/*.d.ts',
        'src/**/*.md'
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
    setupFiles: ['tests/setup/main.setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@application': path.resolve(__dirname, './src/application'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@config': path.resolve(__dirname, './src/config'),
      '@presentation': path.resolve(__dirname, './src/presentation')
    }
  }
})