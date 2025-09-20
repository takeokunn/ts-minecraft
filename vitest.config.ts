import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // テスト環境設定
    globals: true,
    environment: 'node',

    // テストファイルパターン（__test__/*.spec.ts and *.test.ts）
    include: ['src/**/__test__/*.spec.?(c|m)[jt]s?(x)', 'src/**/*.test.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/docs/**'],

    // タイムアウト設定（無限ループ防止）
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 10000,

    // セットアップファイル
    setupFiles: ['./src/test/setup.ts'],

    // 並行実行制御（安定性重視）
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
        isolate: true,
      },
    },

    // Effect-TS最適化
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['effect', '@effect/platform', '@effect/schema', '@effect/vitest'],
        },
      },
    },

    // カバレッジ設定 - 高品質カバレッジを維持
    coverage: {
      enabled: false, // デフォルト無効（--coverageで有効化）
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      reportsDirectory: './coverage',
      all: true, // 全ファイルを解析対象に含める

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

      // 高品質カバレッジを維持（残り3%は防御的エラーハンドリング）
      thresholds: {
        branches: 92,
        functions: 95,
        lines: 97,
        statements: 97,
      },

      // カバレッジ未達成の閾値設定（警告レベル）
      watermarks: {
        statements: [95, 100],
        functions: [95, 100],
        branches: [95, 100],
        lines: [95, 100],
      },

      clean: true,
      reportOnFailure: true,
      skipFull: false, // 高カバレッジのファイルもレポートに含める

      // istanbul ignore comments を無効化（高品質カバレッジ維持のため）
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
