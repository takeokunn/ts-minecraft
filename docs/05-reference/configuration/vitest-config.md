---
title: "Vitest設定 - テスト環境完全ガイド"
description: "Vitest 2.xでのTypeScript Minecraftテスト環境設定。Effect-TS最適化、高速テスト実行、包括的カバレッジ。"
category: "reference"
difficulty: "intermediate"
tags: ["vitest", "testing", "configuration", "effect-ts", "coverage", "performance"]
prerequisites: ["basic-typescript", "testing-fundamentals"]
estimated_reading_time: "12分"
dependencies: ["./typescript-config.md"]
status: "complete"
---

# Vitest Configuration

> **Vitest設定**: テスト実行環境の完全リファレンス

## 概要

TypeScript MinecraftプロジェクトのVitest 2.x設定について詳しく解説します。Effect-TS専用最適化、高速テスト実行、包括的カバレッジ設定など、実用的な設定例を豊富に提供します。

## 基本設定

### 完全なvitest.config.ts設定例

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // テスト環境設定
    environment: 'node', // node | jsdom | happy-dom | edge-runtime

    // タイムアウト設定（安定性重視）
    testTimeout: 10000, // 個別テスト：10秒
    hookTimeout: 10000, // setup/teardown：10秒
    teardownTimeout: 10000, // クリーンアップ：10秒

    // グローバル設定
    globals: true, // describe, it, expect をグローバルに

    // 並行実行制御（パフォーマンス最適化）
    pool: 'forks', // threads | forks | vmThreads | vmForks
    poolOptions: {
      forks: {
        maxForks: '50%', // CPU使用率最適化
        minForks: 1,
        isolate: true, // テスト間の分離
        singleFork: false // 単一プロセス使用無効
      }
    },

    // ファイル探索設定
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '**/test/**/*.?(c|m)[jt]s?(x)'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.next/**'
    ],

    // セットアップファイル
    setupFiles: [
      './test/setup.ts',
      './test/effect-setup.ts'
    ],

    // コード変換設定
    transformMode: {
      web: [/\.[jt]sx?$/], // web環境での変換対象
      ssr: [/\.ts$/] // SSR環境での変換対象
    },

    // カバレッジ設定（詳細レポート）
    coverage: {
      provider: 'v8', // v8 | istanbul | custom
      enabled: false, // デフォルト無効（--coverage で有効化）

      // 対象ファイル
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts'
      ],
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/test/**',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}'
      ],

      // レポート設定
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // カバレッジ閾値（品質保証）
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        perFile: true // ファイル単位でチェック
      },

      // クリーンアップ
      clean: true,
      cleanOnRerun: true,

      // 失敗時もレポート生成
      reportOnFailure: true,

      // 100%カバレッジファイルを非表示
      skipFull: false,

      // プロジェクト外ファイルも対象
      allowExternal: false
    },

    // テストの並び順制御
    sequence: {
      shuffle: false, // ランダム実行無効
      concurrent: false, // 並行実行無効（安定性重視）
      seed: Date.now(), // シード値
      hooks: 'stack' // フック実行順序
    },

    // 最大同時実行数（メモリ使用量制御）
    maxConcurrency: 5,

    // 遅いテストの閾値
    slowTestThreshold: 300, // 300ms以上で警告

    // ファイル並列実行
    fileParallelism: true,

    // ワーカー数制御
    maxWorkers: '50%',
    minWorkers: 1,

    // レポート設定
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml'
    },

    // Chai設定（アサーション調整）
    chaiConfig: {
      includeStack: false, // スタックトレース簡略化
      showDiff: true, // 差分表示有効
      truncateThreshold: 100 // 切り詰め閾値
    },

    // 差分表示設定
    diff: {
      aIndicator: '--',
      bIndicator: '++',
      omitAnnotationLines: true
    },

    // CSS処理設定
    css: {
      include: [], // CSS処理対象
      exclude: [], // CSS処理除外
      modules: {
        classNameStrategy: 'stable' // クラス名戦略
      }
    },

    // 依存関係最適化
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            'effect',
            'three'
          ]
        }
      },
      // 外部化設定
      external: [
        /node_modules/
      ],
      // インライン化設定
      inline: [
        'effect',
        'three'
      ]
    },

    // サーバー設定
    server: {
      sourcemap: 'inline', // ソースマップ
      debug: {
        dumpModules: false,
        loadDumppedModules: false
      }
    },

    // 型チェック設定
    typecheck: {
      enabled: false, // 型チェック無効（別途実行）
      only: false,
      checker: 'tsc',
      include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
      exclude: ['**/node_modules/**'],
      allowJs: false,
      ignoreSourceErrors: false,
      tsconfig: './tsconfig.json'
    }
  },

  // パス解決設定（テスト用）
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'test')
    }
  },

  // プラグイン設定
  plugins: [
    // テスト用プラグインがここに追加される
  ],

  // 定義済み変数（テスト環境用）
  define: {
    __TEST__: true,
    __DEV__: true
  }
})
```

## 🚀 環境別設定

### 開発環境用設定（高速実行重視）

```typescript
// vitest.config.dev.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 高速実行設定
    pool: 'threads', // threadsが最速
    poolOptions: {
      threads: {
        maxThreads: '100%', // 全CPU使用
        minThreads: 2,
        isolate: false, // 分離無効で高速化
        singleThread: false
      }
    },

    // タイムアウト短縮（開発効率化）
    testTimeout: 5000,
    hookTimeout: 5000,

    // 詳細レポート
    reporters: ['verbose'],

    // ウォッチモード最適化
    watch: true,

    // カバレッジ無効（高速化）
    coverage: {
      enabled: false
    },

    // 並行実行有効
    sequence: {
      concurrent: true
    },

    // ファイル変更時の再実行範囲制限
    forceRerunTriggers: [
      '**/test/**',
      '**/*.config.*'
    ]
  }
})
```

### CI/CD環境用設定（安定性重視）

```typescript
// vitest.config.ci.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 安定性重視の設定
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4, // CI環境のリソース制限
        minForks: 1,
        isolate: true, // 完全分離
        singleFork: false
      }
    },

    // 長めのタイムアウト（安定性確保）
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,

    // 包括的カバレッジ
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],

      // 厳格な閾値
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        perFile: true
      },

      // 失敗時もレポート
      reportOnFailure: true
    },

    // 順次実行（安定性重視）
    sequence: {
      concurrent: false,
      shuffle: false
    },

    // リトライ設定
    retry: 3,

    // レポート設定（CI用）
    reporters: ['default', 'junit', 'github-actions'],
    outputFile: {
      junit: './test-results/junit.xml'
    },

    // ログ詳細化
    logHeapUsage: true,

    // 環境変数
    env: {
      NODE_ENV: 'test',
      CI: 'true'
    }
  }
})
```

### Effect-TS専用最適化設定

```typescript
// vitest.config.effect.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Effect-TS用環境設定
    environment: 'node',

    // Effect-TS用セットアップ
    setupFiles: [
      './test/effect-setup.ts'
    ],

    // 依存関係最適化（Effect-TS特化）
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            // Effect-TSコアモジュール
            'effect',
            'effect/Effect',
            'effect/Context',
            'effect/Layer',
            'effect/Schema',
            'effect/Match',
            'effect/Chunk',
            'effect/Array',
            'effect/Option',
            'effect/Either',

            // Effect-TSプラットフォーム
            '@effect/platform',
            '@effect/platform/HttpClient',
            '@effect/platform/FileSystem',
            '@effect/schema'
          ]
        }
      },

      // Effect-TSインライン化
      inline: [
        /^effect/,
        /^@effect/
      ]
    },

    // Effect-TS用変換設定
    transformMode: {
      ssr: [/\.ts$/, /\.tsx$/]
    },

    // タイムアウト調整（Effect実行時間考慮）
    testTimeout: 15000,

    // 型チェック設定（Effect-TS型対応）
    typecheck: {
      enabled: true,
      checker: 'tsc',
      tsconfig: './tsconfig.test.json'
    }
  },

  // Effect-TS用エイリアス
  resolve: {
    alias: {
      '@effect-test': resolve(__dirname, 'test/effect-helpers')
    }
  },

  // Effect-TS用定義
  define: {
    __EFFECT_DEBUG__: true
  }
})
```

## ⚡ パフォーマンス最適化

### 高速テスト実行設定

```typescript
// 最高速度設定
export default defineConfig({
  test: {
    // 最速プール設定
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: '100%',
        minThreads: 4,
        isolate: false, // 分離無効で最速
        singleThread: false
      }
    },

    // 並行実行最大化
    sequence: {
      concurrent: true,
      shuffle: false
    },

    fileParallelism: true,
    maxConcurrency: 10,

    // タイムアウト最小化
    testTimeout: 3000,
    hookTimeout: 2000,

    // カバレッジ無効
    coverage: {
      enabled: false
    },

    // レポート最小化
    reporters: ['dot'],

    // キャッシュ最適化
    cache: {
      dir: 'node_modules/.vitest'
    },

    // 依存関係最適化
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['effect', 'three']
        }
      }
    }
  }
})
```

### メモリ使用量最適化

```typescript
// メモリ効率重視設定
export default defineConfig({
  test: {
    // プロセス制限
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2, // プロセス数制限
        minForks: 1,
        isolate: true
      }
    },

    // 同時実行数制限
    maxConcurrency: 3,

    // ファイル並列化無効
    fileParallelism: false,

    // メモリ使用量監視
    logHeapUsage: true,

    // ガベージコレクション強制実行
    sequence: {
      hooks: 'list' // メモリ効率的なフック実行
    }
  }
})
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. テストが遅い・タイムアウトする

**問題**: テスト実行が遅い、タイムアウトエラーが発生

**解決策**:
```typescript
export default defineConfig({
  test: {
    // タイムアウト延長
    testTimeout: 30000,
    hookTimeout: 20000,

    // 並行実行無効（安定性重視）
    sequence: {
      concurrent: false
    },

    // プール設定最適化
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1, // 単一プロセス
        isolate: true
      }
    },

    // デバッグ用詳細ログ
    reporters: ['verbose'],
    logHeapUsage: true
  }
})
```

#### 2. Effect-TSテストでエラー

**問題**: Effect types not resolved, runtime errors

**解決策**:
```typescript
export default defineConfig({
  test: {
    // Effect-TS専用セットアップ
    setupFiles: ['./test/effect-setup.ts'],

    // 依存関係の明示的インライン化
    deps: {
      inline: [
        'effect',
        '@effect/platform',
        '@effect/schema'
      ]
    },

    // 変換モード調整
    transformMode: {
      ssr: [/\.ts$/]
    },

    // 型チェック有効化
    typecheck: {
      enabled: true,
      allowJs: false
    }
  }
})
```

#### 3. カバレッジが正確に取得できない

**問題**: Coverage reports are inaccurate or missing

**解決策**:
```typescript
export default defineConfig({
  test: {
    coverage: {
      // プロバイダー変更
      provider: 'istanbul', // v8から変更

      // 詳細な除外設定
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.test.{js,ts}',
        '**/test/**',
        // 具体的なパターン追加
        '**/src/types/**',
        '**/src/**/*.config.ts'
      ],

      // ソースマップ対応
      excludeAfterRemap: true,

      // すべてのファイルを対象
      all: true,

      // 外部ファイル許可
      allowExternal: true
    }
  }
})
```

#### 4. メモリ不足エラー

**問題**: JavaScript heap out of memory

**解決策**:
```typescript
// package.json
{
  "scripts": {
    "test": "node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs"
  }
}

// vitest.config.ts
export default defineConfig({
  test: {
    // プロセス数制限
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2
      }
    },

    // 並行実行制限
    maxConcurrency: 2,
    fileParallelism: false,

    // メモリ監視
    logHeapUsage: true
  }
})
```

## 🔧 高度な設定例

### ブラウザテスト設定（Playwright統合）

```typescript
export default defineConfig({
  test: {
    // ブラウザ環境有効化
    browser: {
      enabled: true,
      provider: 'playwright',

      // ブラウザインスタンス設定
      instances: [
        {
          browser: 'chromium',
          headless: process.env.CI ? true : false,
          setupFile: './test/browser-setup.ts'
        },
        {
          browser: 'firefox',
          headless: true
        }
      ],

      // ビューポート設定
      viewport: {
        width: 1280,
        height: 720
      },

      // スクリーンショット設定
      screenshotFailures: true,
      screenshotDirectory: './test-screenshots',

      // UI設定
      ui: !process.env.CI,

      // API設定
      api: {
        port: 63315,
        host: '0.0.0.0'
      }
    }
  }
})
```

### マルチプロジェクト設定

```typescript
export default defineConfig({
  test: {
    projects: [
      // ユニットテスト
      {
        name: 'unit',
        test: {
          include: ['src/**/*.test.ts'],
          environment: 'node'
        }
      },

      // 統合テスト
      {
        name: 'integration',
        test: {
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          timeout: 30000
        }
      },

      // ブラウザテスト
      {
        name: 'browser',
        test: {
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: 'playwright'
          }
        }
      },

      // E2Eテスト
      {
        name: 'e2e',
        test: {
          include: ['tests/e2e/**/*.test.ts'],
          testTimeout: 60000,
          retry: 2
        }
      }
    ]
  }
})
```

## 📚 関連ドキュメント

### 設定ファイル関連
- [Vite設定](./vite-config.md) - ベースとなるVite設定
- [TypeScript設定](./typescript-config.md) - 型定義とコンパイル設定
- [開発設定](./development-config.md) - 開発効率化ツール
- [Project設定](./project-config.md) - プロジェクト全体設定

### 外部リファレンス
- [Vitest公式ドキュメント](https://vitest.dev/)
- [Coverage設定](https://vitest.dev/config/#coverage)
- [Browser Testing](https://vitest.dev/guide/browser.html)
- [Playwright Integration](https://playwright.dev/docs/test-runners)

### プロジェクト固有
- [Effect-TSテストパターン](../../03-guides/07-effect-ts-testing-patterns.md)
- [テスト戦略ガイド](../../03-guides/02-testing-guide.md)
- [パフォーマンステスト](../troubleshooting/performance-issues.md)