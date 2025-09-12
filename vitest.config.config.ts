import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/config/**/*.test.ts'
    ],
    exclude: [
      'src/config/**/index.ts',
      'src/config/**/*.d.ts',
      'node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/config/**/*.ts'
      ],
      exclude: [
        'src/config/**/index.ts',
        'src/config/**/*.d.ts',
        'src/config/**/*.test.ts',
        'src/config/__tests__/**'
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
      '@shared': '/src/shared',
      '@domain': '/src/domain',
      '@application': '/src/application',
      '@infrastructure': '/src/infrastructure'
    }
  }
})