import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // テスト環境設定
    globals: true,
    environment: 'happy-dom',

    // テストファイルパターン（__test__/*.spec.ts）
    include: ['src/**/__test__/*.spec.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/docs/**', "src/test/__test__/**"],

    // タイムアウト設定（無限ループ防止）
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 10000,

    // セットアップファイル
    setupFiles: ['./src/test/setup.ts'],

    // 並行実行制御（Effect-TSテスト最適化）
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4, // Effect-TSの並行性を活用
        minThreads: 1,
        isolate: true,
      },
    },

    // Effect-TS最適化設定
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['effect', '@effect/platform', '@effect/schema', '@effect/vitest'],
        },
      },
    },

    // Effect-TS用環境変数
    env: {
      NODE_ENV: 'test',
      EFFECT_LOG_LEVEL: 'Error', // テスト時はエラーレベルのみ
      VITEST_ENVIRONMENT: 'effect',
    },

    // カバレッジ設定 - 100%カバレッジ達成に最適化
    coverage: {
      enabled: false, // デフォルト無効（--coverageで有効化）
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
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
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/test/**',
        'src/**/index.ts', // 単純なre-exportのみのindexファイル
      ],

      // 100%カバレッジ目標設定
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
        // perFile: true,
      },

      // カバレッジ品質設定
      watermarks: {
        statements: [90, 100],
        functions: [90, 100],
        branches: [90, 100],
        lines: [90, 100],
      },

      clean: true,
      cleanOnRerun: true,
      reportOnFailure: true,
      skipFull: false,
      allowExternal: false,
      excludeAfterRemap: true, // ソースマップ後の除外を適用
      ignoreEmptyLines: false,
    },

    // レポート設定
    reporters: ['default'],

    // 並列実行設定
    sequence: {
      concurrent: false,
      shuffle: false,
    },

    // 最大同時実行数
    maxConcurrency: 5,

    // 遅いテストの閾値
    slowTestThreshold: 300,
  },

  // パス解決
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'src/test'),
    },
  },
})
