---
title: "プロジェクト設定 - 統合プロジェクト管理ガイド"
description: "プロジェクトレベルの設定管理。環境変数、ワークフロー、エディター統合、Git設定の完全ガイド。"
category: "reference"
difficulty: "intermediate"
tags: ["project-management", "environment-variables", "workflow", "git", "editor-integration"]
prerequisites: ["basic-git", "environment-setup"]
estimated_reading_time: "12分"
dependencies: []
status: "complete"
---

# Project Configuration

> **プロジェクト設定**: プロジェクト全体の設定管理とワークフロー構築

## 概要

TypeScript Minecraftプロジェクトのプロジェクトレベル設定について詳しく解説します。環境変数管理、ワークフロー設定、エディター統合、Git設定など、開発効率を最大化する実用的な設定例を豊富に提供します。

## 基本プロジェクト構成

### プロジェクト構造とメタデータ

```json
// package.json（基本設定）
{
  "name": "ts-minecraft",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "TypeScript implementation of Minecraft using Three.js and Effect-TS",
  "homepage": "https://github.com/your-org/ts-minecraft#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/your-org/ts-minecraft.git"
  },
  "bugs": {
    "url": "https://github.com/your-org/ts-minecraft/issues"
  },
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",

  // Node.js/npm設定
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0",

  // モジュール設定
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },

  // ファイル配布設定
  "files": [
    "dist",
    "public",
    "src",
    "README.md",
    "LICENSE"
  ],

  // キーワード（検索性向上）
  "keywords": [
    "minecraft",
    "typescript",
    "three.js",
    "effect-ts",
    "voxel",
    "game",
    "webgl"
  ]
}
```

## 📋 環境変数管理

### 完全な.env設定例

```bash
# .env.local（ローカル開発用）
# 🔥 機密情報 - Gitには含めない

# 開発サーバー設定
VITE_PORT=3000
VITE_HOST=localhost
VITE_OPEN=true

# API設定
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:3002

# 機能フラグ
VITE_ENABLE_DEBUG_MODE=true
VITE_ENABLE_PROFILING=true
VITE_ENABLE_EXPERIMENTAL_FEATURES=true

# 外部サービス（開発用ダミー）
VITE_ANALYTICS_ID=dev-analytics
VITE_SENTRY_DSN=dev-sentry-dsn

# パフォーマンス設定
VITE_MAX_CHUNKS=16
VITE_PRELOAD_CHUNKS=true

# セキュリティ設定（開発用）
VITE_CSP_ENABLED=false
VITE_CORS_ORIGIN=*
```

```bash
# .env.production（本番環境用）
# 🚀 本番設定 - セキュリティ重視

# 本番API
VITE_API_BASE_URL=https://api.minecraft-ts.example.com
VITE_WS_URL=wss://ws.minecraft-ts.example.com

# 機能フラグ（本番）
VITE_ENABLE_DEBUG_MODE=false
VITE_ENABLE_PROFILING=false
VITE_ENABLE_EXPERIMENTAL_FEATURES=false

# 外部サービス（本番）
VITE_ANALYTICS_ID=prod-ga4-measurement-id
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# パフォーマンス最適化
VITE_MAX_CHUNKS=8
VITE_PRELOAD_CHUNKS=false
VITE_CDN_URL=https://cdn.minecraft-ts.example.com

# セキュリティ強化
VITE_CSP_ENABLED=true
VITE_CORS_ORIGIN=https://minecraft-ts.example.com
VITE_RATE_LIMIT_ENABLED=true
```

```bash
# .env.test（テスト環境用）
# 🧪 テスト専用設定

# テストサーバー
VITE_API_BASE_URL=http://localhost:8081
VITE_WS_URL=ws://localhost:3003

# テスト用機能
VITE_ENABLE_TEST_UTILS=true
VITE_ENABLE_MOCKS=true
VITE_ENABLE_COVERAGE=true

# テストパフォーマンス
VITE_TEST_TIMEOUT=30000
VITE_MAX_WORKERS=4

# テスト用外部サービス
VITE_ANALYTICS_ID=test-analytics
VITE_SENTRY_DSN=test-sentry-dsn
```

### TypeScript環境変数型定義

```typescript
// src/types/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // サーバー設定
  readonly VITE_PORT: string
  readonly VITE_HOST: string
  readonly VITE_OPEN: string

  // API設定
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_CDN_URL?: string

  // 機能フラグ
  readonly VITE_ENABLE_DEBUG_MODE: string
  readonly VITE_ENABLE_PROFILING: string
  readonly VITE_ENABLE_EXPERIMENTAL_FEATURES: string
  readonly VITE_ENABLE_TEST_UTILS?: string
  readonly VITE_ENABLE_MOCKS?: string

  // 外部サービス
  readonly VITE_ANALYTICS_ID: string
  readonly VITE_SENTRY_DSN: string

  // パフォーマンス
  readonly VITE_MAX_CHUNKS: string
  readonly VITE_PRELOAD_CHUNKS: string
  readonly VITE_TEST_TIMEOUT?: string
  readonly VITE_MAX_WORKERS?: string

  // セキュリティ
  readonly VITE_CSP_ENABLED: string
  readonly VITE_CORS_ORIGIN: string
  readonly VITE_RATE_LIMIT_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 実行時設定アクセスヘルパー
declare global {
  interface Window {
    __APP_CONFIG__: {
      apiBaseUrl: string
      wsUrl: string
      debugMode: boolean
      version: string
    }
  }
}
```

### 環境別設定管理

```typescript
// src/config/env.ts
import { Effect, Layer, Context } from 'effect'
import { Schema } from '@effect/schema'

// 環境変数スキーマ定義
const EnvConfigSchema = Schema.Struct({
  // サーバー設定
  port: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
  host: Schema.String,

  // API設定
  apiBaseUrl: Schema.String.pipe(Schema.startsWith('http')),
  wsUrl: Schema.String.pipe(Schema.startsWith('ws')),
  cdnUrl: Schema.optional(Schema.String),

  // 機能フラグ
  debugMode: Schema.transform(
    Schema.String,
    Schema.Boolean,
    {
      strict: true,
      decode: (s) => s === 'true',
      encode: (b) => String(b)
    }
  ),
  profilingEnabled: Schema.BooleanFromString,
  experimentalFeatures: Schema.BooleanFromString,

  // 外部サービス
  analyticsId: Schema.String,
  sentryDsn: Schema.String,

  // パフォーマンス設定
  maxChunks: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
  preloadChunks: Schema.BooleanFromString,

  // セキュリティ設定
  cspEnabled: Schema.BooleanFromString,
  corsOrigin: Schema.String,
  rateLimitEnabled: Schema.optional(Schema.BooleanFromString)
})

type EnvConfig = Schema.Schema.Type<typeof EnvConfigSchema>

// 環境設定Context
export class EnvConfigService extends Context.Tag('EnvConfigService')<
  EnvConfigService,
  EnvConfig
>() {}

// 環境変数の読み込みと検証
const loadEnvConfig = (): Effect.Effect<EnvConfig, Error> =>
  Effect.try(() => ({
    port: import.meta.env.VITE_PORT || '3000',
    host: import.meta.env.VITE_HOST || 'localhost',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    wsUrl: import.meta.env.VITE_WS_URL,
    cdnUrl: import.meta.env.VITE_CDN_URL,
    debugMode: import.meta.env.VITE_ENABLE_DEBUG_MODE || 'false',
    profilingEnabled: import.meta.env.VITE_ENABLE_PROFILING || 'false',
    experimentalFeatures: import.meta.env.VITE_ENABLE_EXPERIMENTAL_FEATURES || 'false',
    analyticsId: import.meta.env.VITE_ANALYTICS_ID,
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
    maxChunks: import.meta.env.VITE_MAX_CHUNKS || '16',
    preloadChunks: import.meta.env.VITE_PRELOAD_CHUNKS || 'true',
    cspEnabled: import.meta.env.VITE_CSP_ENABLED || 'false',
    corsOrigin: import.meta.env.VITE_CORS_ORIGIN || '*',
    rateLimitEnabled: import.meta.env.VITE_RATE_LIMIT_ENABLED
  })).pipe(
    Effect.flatMap(Schema.decodeUnknown(EnvConfigSchema))
  )

// 環境設定Layer
export const EnvConfigLive = Layer.effect(
  EnvConfigService,
  loadEnvConfig()
)

// 使用例
export const useEnvConfig = () =>
  Effect.gen(function* () {
    const config = yield* EnvConfigService

    // デバッグモードの確認
    if (config.debugMode) {
      console.log('Debug mode enabled')
    }

    // API URL構築
    const apiUrl = config.cdnUrl
      ? `${config.cdnUrl}/api`
      : `${config.apiBaseUrl}/api`

    return { ...config, apiUrl }
  })
```

## 🔧 開発ワークフロー設定

### Git設定とフック

```bash
# .gitignore（完全版）
# 依存関係
node_modules/
.pnpm-store/
.npm/

# ビルド成果物
dist/
build/
.vite/
.turbo/

# ログ
*.log
logs/
.pnpm-debug.log*

# 環境設定
.env.local
.env.production.local
.env.test.local

# エディタ設定
.vscode/
.idea/
*.swp
*.swo

# OS生成ファイル
.DS_Store
Thumbs.db

# テスト
coverage/
.nyc_output/
junit.xml

# 一時ファイル
tmp/
temp/
*.tmp
*.temp

# キャッシュ
.cache/
.parcel-cache/

# バックアップ
*.bak
*.backup
```

```json
# .husky/pre-commit（品質チェック）
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# ステージングファイルのリント
npx lint-staged

# 型チェック
pnpm type-check

# テスト実行（変更ファイルのみ）
pnpm test:related
```

```json
# .husky/commit-msg（コミットメッセージ検証）
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Conventional Commits準拠チェック
npx commitlint --edit "$1"
```

```json
# .lintstagedrc.json（段階的品質チェック）
{
  "*.{ts,tsx}": [
    "oxlint --fix",
    "prettier --write",
    "pnpm type-check:file"
  ],
  "*.{js,jsx}": [
    "oxlint --fix",
    "prettier --write"
  ],
  "*.{css,scss,sass}": [
    "prettier --write",
    "stylelint --fix"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "package.json": [
    "sort-package-json"
  ]
}
```

### EditorConfig設定

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.{js,ts,tsx,vue}]
indent_size = 2

[*.{json,yml,yaml}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.{py,go}]
indent_size = 4

[Makefile]
indent_style = tab
```

## 🚀 環境別プロジェクト設定

### 開発環境設定

```typescript
// config/development.ts
export const developmentConfig = {
  // デバッグ設定
  debug: {
    enabled: true,
    level: 'verbose',
    showWarnings: true,
    enableSourceMaps: true
  },

  // ホットリロード設定
  hotReload: {
    enabled: true,
    overlay: true,
    liveReload: false // HMRを優先
  },

  // パフォーマンス設定（開発用）
  performance: {
    bundleAnalyzer: false,
    memoryLimit: '2048mb',
    optimizeChunks: false // 開発速度を優先
  },

  // Three.js開発設定
  threejs: {
    enableStats: true,
    enableAxesHelper: true,
    enableGridHelper: true,
    shadowMapType: 'BasicShadowMap' // 軽量版
  },

  // Effect-TS開発設定
  effectTS: {
    enableTracing: true,
    logLevel: 'Debug',
    enableFiberDump: true
  },

  // Mock設定
  mocks: {
    enabled: true,
    apiDelay: 500, // レスポンス遅延シミュレーション
    errorRate: 0.1 // 10%でエラー発生
  }
}
```

### 本番環境設定

```typescript
// config/production.ts
export const productionConfig = {
  // 最適化設定
  optimization: {
    minify: true,
    treeshaking: true,
    codesplitting: true,
    compression: 'gzip'
  },

  // セキュリティ設定
  security: {
    csp: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'"], // Three.js用
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:']
      }
    },
    hsts: true,
    noSniff: true
  },

  // パフォーマンス設定
  performance: {
    maxAssetSize: 512000, // 500KB
    maxEntrypointSize: 512000,
    assetOptimization: true,
    preloadCriticalChunks: true
  },

  // Three.js本番設定
  threejs: {
    enableStats: false,
    shadowMapType: 'PCFSoftShadowMap', // 高品質版
    powerPreference: 'high-performance',
    antialias: true
  },

  // Effect-TS本番設定
  effectTS: {
    enableTracing: false,
    logLevel: 'Error',
    enableFiberDump: false
  },

  // 監視設定
  monitoring: {
    sentry: {
      enabled: true,
      sampleRate: 0.1,
      tracesSampleRate: 0.01
    },
    analytics: {
      enabled: true,
      anonymizeIp: true
    }
  }
}
```

### CI/CD設定

```typescript
// config/ci.ts
export const ciConfig = {
  // テスト設定
  testing: {
    coverage: {
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    timeout: 60000,
    retries: 3
  },

  // ビルド設定
  build: {
    parallel: true,
    cacheEnabled: true,
    nodeOptions: '--max-old-space-size=4096'
  },

  // 品質ゲート
  qualityGates: {
    typeCheck: true,
    lint: true,
    formatCheck: true,
    securityScan: true
  }
}
```

## 🎯 パフォーマンス設定

### バンドルサイズ最適化

```typescript
// config/bundle-optimization.ts
export const bundleOptimization = {
  // チャンク分割戦略
  chunks: {
    // ライブラリ別分割
    vendor: {
      'effect-core': ['effect', '@effect/schema'],
      'three-core': ['three'],
      'three-extras': ['three/examples/jsm'],
      'utils': ['lodash-es', 'date-fns']
    },

    // 機能別分割
    features: {
      'game-core': ['./src/domain', './src/application/core'],
      'game-systems': ['./src/application/systems'],
      'game-ui': ['./src/presentation/components'],
      'game-renderer': ['./src/infrastructure/rendering']
    },

    // 動的インポート対象
    dynamic: [
      './src/workers/*',
      './src/assets/models/*',
      './src/locales/*'
    ]
  },

  // Tree shaking設定
  treeShaking: {
    sideEffects: false,
    usedExports: true,
    providedExports: true,
    concatenateModules: true
  }
}
```

### メモリ管理設定

```typescript
// config/memory-management.ts
export const memoryManagement = {
  // Three.js メモリ設定
  threejs: {
    textureDisposal: {
      enabled: true,
      interval: 30000, // 30秒間隔
      maxUnusedTime: 120000 // 2分未使用で破棄
    },
    geometryPooling: {
      enabled: true,
      maxPoolSize: 100
    },
    materialCaching: {
      enabled: true,
      maxCacheSize: 50
    }
  },

  // Effect-TS メモリ設定
  effectTS: {
    fiberCleaning: {
      enabled: true,
      interval: 60000
    },
    contextPooling: {
      enabled: true,
      maxPoolSize: 20
    }
  },

  // ワーカー設定
  workers: {
    maxWorkers: navigator.hardwareConcurrency || 4,
    workerTerminationTimeout: 10000
  }
}
```

## 🧪 テスト環境設定

### テスト設定パターン

```typescript
// config/test-environments.ts
export const testEnvironments = {
  // ユニットテスト環境
  unit: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testMatch: ['**/*.test.ts', '**/*.spec.ts'],
    collectCoverageFrom: [
      'src/**/*.ts',
      '!src/**/*.d.ts',
      '!src/test/**/*'
    ]
  },

  // 統合テスト環境
  integration: {
    environment: 'jsdom',
    setupFiles: ['./src/test/integration-setup.ts'],
    testMatch: ['**/*.integration.test.ts'],
    timeout: 30000
  },

  // E2Eテスト環境
  e2e: {
    baseURL: 'http://localhost:3000',
    browsers: ['chromium', 'firefox'],
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  // Effect-TSテスト設定
  effectTS: {
    testLayer: 'TestLayer',
    mockServices: true,
    timeoutMultiplier: 2
  }
}
```

## 🔍 監視・ログ設定

### 包括的ログ設定

```typescript
// config/logging.ts
export const loggingConfig = {
  // 環境別ログレベル
  levels: {
    development: 'debug',
    test: 'warn',
    staging: 'info',
    production: 'error'
  },

  // ログフォーマット
  format: {
    timestamp: true,
    colorize: true,
    errors: { stack: true }
  },

  // ログ出力先
  transports: {
    console: {
      enabled: true,
      level: 'debug'
    },
    file: {
      enabled: false, // ブラウザでは無効
      filename: 'app.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    },
    remote: {
      enabled: true,
      endpoint: '/api/logs',
      batchSize: 10,
      flushInterval: 5000
    }
  },

  // Effect-TS ログ統合
  effectTS: {
    enableFiberTracing: false,
    logSpans: true,
    logLevel: 'Info'
  }
}
```

## 🛠️ トラブルシューティング

### よくある設定問題と解決法

#### 1. 環境変数が読み込まれない

**症状**: `import.meta.env.VITE_*` が undefined

**解決策**:
```bash
# 1. 環境変数ファイルの確認
ls -la .env*

# 2. ファイル名の確認（ピリオド忘れ注意）
# ❌ 間違い: env.local
# ✅ 正解: .env.local

# 3. 変数名プレフィックス確認
# ❌ 間違い: API_URL=...
# ✅ 正解: VITE_API_URL=...
```

#### 2. Git hooksが動作しない

**症状**: pre-commit、commit-msgが実行されない

**解決策**:
```bash
# Huskyの再インストール
pnpm husky install

# フック権限の確認・修正
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg

# Git設定の確認
git config core.hooksPath
```

#### 3. パフォーマンス問題

**症状**: 開発サーバーが遅い、メモリ不足

**解決策**:
```bash
# Node.jsメモリ制限増加
NODE_OPTIONS="--max-old-space-size=8192" pnpm dev

# 依存関係の最適化
pnpm rebuild
rm -rf node_modules/.vite
pnpm dev
```

#### 4. 型エラーが解決しない

**症状**: TypeScript型エラーが環境間で異なる

**解決策**:
```bash
# TypeScriptキャッシュクリア
pnpm tsc --build --clean

# Node.js/npm環境統一確認
node --version  # 推奨: v20.x
pnpm --version  # 推奨: v8.x

# 型定義の再インストール
pnpm add -D @types/node@latest
```

## 📊 設定の依存関係

### 設定ファイル間の依存関係マップ

```mermaid
graph TD
    A[project-config] --> B[vite-config]
    A --> C[typescript-config]
    A --> D[vitest-config]

    B --> E[環境変数]
    C --> E
    D --> E

    F[package.json] --> A
    F --> G[.editorconfig]
    F --> H[.gitignore]

    I[.env.*] --> E

    J[tsconfig.json] --> K[tsconfig paths]
    K --> B
```

### 設定変更時のチェックリスト

1. **環境変数変更時**:
   - [ ] 型定義更新 (`src/types/env.d.ts`)
   - [ ] 全環境の.envファイル更新
   - [ ] CI/CD環境変数設定

2. **依存関係変更時**:
   - [ ] package.jsonバージョン更新
   - [ ] 型定義パッケージ確認
   - [ ] Vite最適化設定確認

3. **ビルド設定変更時**:
   - [ ] 開発環境での動作確認
   - [ ] 本番ビルドテスト
   - [ ] パフォーマンス影響測定

## 📚 関連ドキュメント

### 設定ファイル関連
- [Package.json設定](./package-json.md) - npm/pnpmパッケージ管理
- [TypeScript設定](./typescript-config.md) - TypeScript compilerOptions
- [Vite設定](./vite-config.md) - Vite開発・ビルド設定
- [Vitest設定](./vitest-config.md) - テスト実行環境
- [Build設定](./build-config.md) - ビルドパイプライン
- [Development設定](./development-config.md) - 開発環境最適化

### 外部リファレンス
- [Node.js環境変数](https://nodejs.org/api/process.html#process_process_env)
- [Vite環境変数](https://vitejs.dev/guide/env-and-mode.html)
- [Git Hooks](https://git-scm.com/docs/githooks)
- [EditorConfig](https://editorconfig.org/)

### プロジェクト固有
- [開発ガイド](../../03-guides/01-development-setup.md)
- [デプロイガイド](../../03-guides/02-deployment.md)
- [トラブルシューティング](../troubleshooting/README.md)