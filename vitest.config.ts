import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { cpus } from 'os'

export default defineConfig({
  test: {
    // テスト環境設定 - Effect-TS最適化
    globals: true,
    environment: 'happy-dom',

    // テストファイルパターン（現代的パターン）
    include: ['src/**/__test__/*.{test,spec}.?(c|m)[jt]s?(x)', 'src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**',
      '**/docs/**',
      'src/test/**', // ヘルパーファイルは除外
    ],

    // タイムアウト設定 - Effect-TS適合
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 10000,

    // セットアップファイル
    setupFiles: ['./src/test/setup.ts'],

    // 並行実行制御 - パフォーマンス最適化
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: Math.min(4, cpus().length),
        minThreads: 1,
        isolate: true,
        useAtomics: true,
      },
    },

    // Effect-TS deps 最適化
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['effect', '@effect/platform', '@effect/schema', '@effect/vitest'],
        },
      },
    },

    // 環境変数 - Effect-TS専用
    env: {
      NODE_ENV: 'test',
      EFFECT_LOG_LEVEL: 'Error',
      VITEST: 'true',
    },

    // カバレッジ設定 - 100%目標
    coverage: {
      enabled: false, // CLI --coverage で有効化
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
        'src/**/index.ts', // re-export only
      ],

      // 100%カバレッジ閾値
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
        perFile: true,
      },

      // 高品質カバレッジ設定
      watermarks: {
        statements: [95, 100],
        functions: [95, 100],
        branches: [95, 100],
        lines: [95, 100],
      },

      clean: true,
      cleanOnRerun: true,
      reportOnFailure: true,
      skipFull: false,
      allowExternal: false,
      excludeAfterRemap: true,
      ignoreEmptyLines: true,
    },

    // レポート設定
    reporters: [
      'default',
      ['html', { outputFile: './test-results/index.html' }],
      ['json', { outputFile: './test-results/results.json' }],
    ],

    // テスト実行制御 - 現代的設定
    sequence: {
      concurrent: true,
      shuffle: true,
      hooks: 'parallel',
    },

    // 並行性制御
    maxConcurrency: Math.min(8, cpus().length),
    minWorkers: 1,
    maxWorkers: Math.min(4, cpus().length),

    // パフォーマンス設定
    slowTestThreshold: 500,
    logHeapUsage: process.env['NODE_ENV'] === 'development',

    // Effect-TS it.effect() サポート強化
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
  },

  // パス解決
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'src/test'),
    },
  },

  // ビルド最適化
  esbuild: {
    target: 'node16',
  },
})
