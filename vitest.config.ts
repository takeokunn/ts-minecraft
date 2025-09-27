import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { cpus } from 'os'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30秒（パフォーマンステスト対応）
    hookTimeout: 20000, // フックのタイムアウト

    include: ['src/**/__tests__/*.test.ts', 'src/**/__test__/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/docs/**'],

    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'docs/**',
        'coverage/**',
        '*.config.ts',
        '*.config.js',
        '**/*.d.ts',
        'src/**/__test__/**',
        'src/**/*.{test,spec}.ts',
        'src/test/**',
        'src/**/index.ts',
      ],

      // thresholds: {
      //   branches: 90,
      //   functions: 90,
      //   lines: 90,
      //   statements: 90,
      //   perFile: true,
      // },
      //
      // watermarks: {
      //   statements: [90, 100],
      //   functions: [90, 100],
      //   branches: [90, 100],
      //   lines: [90, 100],
      // },

      clean: true,
      cleanOnRerun: true,
      reportOnFailure: true,
      skipFull: false,
      allowExternal: false,
      excludeAfterRemap: true,
      ignoreEmptyLines: true,
    },

    reporters: process.env.CI
      ? ['default']
      : [
          'default',
          ['html', { outputFile: './test-results/index.html' }],
          ['json', { outputFile: './test-results/results.json' }],
        ],

    sequence: {
      concurrent: true,
      shuffle: false,
      hooks: 'stack',
    },

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
