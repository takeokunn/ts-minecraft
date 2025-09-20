import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // テスト環境設定
    globals: true,
    environment: 'node',

    // テストファイルパターン（__test__/*.spec.ts and *.test.ts）
    include: [
      'src/**/__test__/*.spec.?(c|m)[jt]s?(x)',
      'src/**/*.test.?(c|m)[jt]s?(x)'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**',
      '**/docs/**'
    ],

    // タイムアウト設定（無限ループ防止）
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 10000,

    // セットアップファイル
    setupFiles: [
      './src/test/setup.ts'
    ],

    // 並行実行制御（安定性重視）
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
        isolate: true
      }
    },

    // Effect-TS最適化
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            'effect',
            '@effect/platform',
            '@effect/schema',
            '@effect/vitest'
          ]
        }
      }
    },

    // カバレッジ設定
    coverage: {
      enabled: false, // デフォルト無効（--coverageで有効化）
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts'
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'docs/**',
        '*.config.ts',
        '*.config.js',
        '**/*.d.ts',
        'src/**/__test__/**',
        'src/test/**'
      ],

      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        perFile: true
      },

      clean: true,
      reportOnFailure: true
    },

    // レポート設定
    reporters: ['default'],

    // 並列実行設定
    sequence: {
      concurrent: false,
      shuffle: false
    },

    // 最大同時実行数
    maxConcurrency: 5,

    // 遅いテストの閾値
    slowTestThreshold: 300
  },

  // パス解決
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'src/test')
    }
  }
})