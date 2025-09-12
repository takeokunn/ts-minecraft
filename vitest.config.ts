import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'tests/unit/**/*.test.ts',
      '!tests/unit/shared/**/*.test.ts', // Exclude shared tests (they have their own config)
      '!tests/unit/infrastructure/**/*.test.ts' // Exclude infrastructure tests (they have their own config)
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
        'src/**/*.ts',
        '!src/shared/**/*.ts', // Exclude shared (covered by shared config)
        '!src/infrastructure/**/*.ts' // Exclude infrastructure (covered by infrastructure config)
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
      '@': '/src',
      '@shared': '/src/shared',
      '@domain': '/src/domain',
      '@application': '/src/application',
      '@infrastructure': '/src/infrastructure',
      '@config': '/src/config',
      '@presentation': '/src/presentation'
    }
  }
})