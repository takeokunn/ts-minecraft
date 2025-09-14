---
title: "ビルド問題トラブルシューティング - ビルドシステム完全マスター"
description: "TypeScript Minecraftプロジェクトの45のビルド問題パターンと最適化戦略。Vite設定デバッグ、TypeScript最適化、依存関係管理。"
category: "troubleshooting"
difficulty: "advanced"
tags: ["build-problems", "troubleshooting", "vite", "typescript", "optimization", "ci-cd", "bundling"]
prerequisites: ["build-systems", "typescript-advanced", "vite-configuration"]
estimated_reading_time: "35分"
related_patterns: ["optimization-patterns-latest", "development-conventions"]
related_docs: ["../configuration/build-config.md", "./common-errors.md", "../configuration/vite-config.md"]
status: "complete"
---

# ビルド問題のトラブルシューティング

> **ビルドシステム完全マスター**: TypeScript Minecraft プロジェクトのための45のビルド問題パターンと最適化戦略

TypeScript Minecraft プロジェクトにおけるビルドとコンパイル問題の全面的な診断、高度な解決方法、そして最適化戦略を詳細に解説します。Vite設定のデバッグ、TypeScriptコンパイラの最適化、依存関係管理、バンドルサイズ最適化、CI/CDパイプラインのデバッグ、そしてパフォーマンス監視を中心に紹介します。

## Vite 設定問題

### 開発サーバーが起動しない

#### 症状
```bash
Error: listen EADDRINUSE :::5173
Error: Cannot find module 'vite'
Error: [vite] Internal server error
```

#### 原因
- ポート競合
- 依存関係の不整合
- 設定ファイルの問題

#### 解決方法
```bash
# 1. ポート競合の解決
lsof -ti:5173
kill -9 $(lsof -ti:5173)

# 2. 別ポートでの起動
pnpm dev --port 3000

# 3. 依存関係の再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 4. Vite設定の確認
npx vite --debug
```

### HMR (Hot Module Replacement) が動作しない

#### 症状
- ファイル変更がブラウザに反映されない
- コンソールに HMR エラーメッセージ

#### 原因と解決方法
```typescript
// vite.config.ts - HMR設定の最適化
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  server: {
    hmr: {
      overlay: true,
      port: 24678
    },
    // Docker環境での問題解決
    host: true,
    watch: {
      usePolling: true,
      interval: 100
    }
  },
  // ファイル監視の設定
  optimizeDeps: {
    exclude: ['effect', '@effect/schema']
  }
})
```

### 依存関係プリバンドルエラー

#### 症状
```bash
Error: The following dependencies are imported but could not be resolved:
  effect (imported by src/domain/player.ts)
```

#### 原因
- ES Module と CommonJS の混在
- 依存関係の解決順序問題

#### 解決方法
```typescript
// vite.config.ts - 依存関係の最適化
export default defineConfig({
  optimizeDeps: {
    include: [
      'effect',
      '@effect/schema',
      '@effect/platform'
    ],
    exclude: [
      // ESMのみのパッケージは除外
      'three'
    ]
  },
  ssr: {
    noExternal: ['effect', '@effect/schema']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/]
    }
  }
})
```

### アセット読み込みエラー

#### 症状
```bash
Failed to resolve import "./assets/textures/stone.png"
Error: Could not resolve "./public/models/player.glb"
```

#### 原因
- 相対パス解決の問題
- アセットディレクトリ設定の不備

#### 解決方法
```typescript
// vite.config.ts - アセット設定
export default defineConfig({
  publicDir: 'public',
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.png', '**/*.jpg', '**/*.wav'],
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const extType = info[info.length - 1]

          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `images/[name]-[hash][extname]`
          }
          if (/glb|gltf|obj|fbx/i.test(extType)) {
            return `models/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      }
    }
  }
})

// アセット読み込みの型定義追加
// src/vite-env.d.ts
/// <reference types="vite/client" />

declare module '*.glb' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}
```

## TypeScript 設定問題

### Path エイリアス解決エラー

#### 症状
```bash
error TS2307: Cannot find module '@domain/player' or its corresponding type declarations.
```

#### 原因
- tsconfig.json と vite.config.ts の設定不整合
- baseUrl や paths の設定ミス

#### 解決方法
```json
// tsconfig.json - パス設定の確認
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@presentation/*": ["src/presentation/*"],
      "@shared/*": ["src/shared/*"],
      "@config/*": ["src/config/*"],
      "@test/*": ["test/*"]
    }
  },
  "include": [
    "src/**/*",
    "test/**/*",
    "vite.config.ts"
  ]
}
```

```typescript
// vite.config.ts - TypeScriptパス解決
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths({
      root: './',
      projects: ['./tsconfig.json']
    })
  ],
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure')
    }
  }
})
```

### 型定義ファイルの問題

#### 症状
```bash
error TS7016: Could not find a declaration file for module 'three'
error TS2688: Cannot find type definition file for 'webgl2'
```

#### 解決方法
```bash
# 型定義の明示的インストール
pnpm add -D @types/three @webgpu/types

# package.json での型定義管理
{
  "devDependencies": {
    "@types/three": "^0.179.0",
    "@types/uuid": "^10.0.0",
    "@types/stats.js": "^0.17.4",
    "@webgpu/types": "^0.1.64"
  }
}
```

```json
// tsconfig.json - 型定義の設定
{
  "compilerOptions": {
    "types": [
      "vite/client",
      "@webgpu/types",
      "three"
    ],
    "typeRoots": [
      "./node_modules/@types",
      "./src/types"
    ]
  }
}
```

### 厳密な型チェックエラー

#### 症状
```bash
error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Position'
error TS2322: Type 'string | undefined' is not assignable to type 'string'
```

#### 解決方法
```typescript
// 厳密な null チェックへの対応
// ❌ 問題のあるコード
const processPosition = (pos: Position | undefined) => {
  return pos.x + pos.y + pos.z // エラー
}

// ✅ 修正後
const processPosition = (pos: Position | undefined): Effect.Effect<number, PositionError> => {
  if (!pos) {
    return Effect.fail(new PositionError({ reason: "Position is undefined" }))
  }

  return Effect.succeed(pos.x + pos.y + pos.z)
}

// Schema を使用した型安全な処理
const processPositionWithSchema = (unknown: unknown): Effect.Effect<number, ParseError> =>
  pipe(
    Schema.decodeUnknown(PositionSchema)(unknown),
    Effect.map(pos => pos.x + pos.y + pos.z)
  )
```

### モジュール解決問題

#### 症状
```bash
error TS2691: An import path cannot end with a '.ts' extension
error TS1259: Module '"effect"' can only be default-imported using the 'allowSyntheticDefaultImports' flag
```

#### 解決方法
```json
// tsconfig.json - モジュール解決設定
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

```typescript
// 正しいインポート記法
// ❌ 拡張子付きインポート
import { Player } from './player.ts'

// ✅ 拡張子なしインポート
import { Player } from './player'

// ✅ Effect-TS の適切なインポート
import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
```

## ビルド最適化問題

### バンドルサイズが大きい

#### 症状
- 本番ビルドサイズが異常に大きい
- ロード時間の遅延

#### 分析と対策
```bash
# バンドル分析
pnpm build
npx vite-bundle-analyzer dist

# 依存関係分析
npx madge --circular --extensions ts,js src/
```

```typescript
// vite.config.ts - バンドル最適化
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          // Effect-TS を分離
          'effect': ['effect', '@effect/schema', '@effect/platform'],
          // Three.js を分離
          'three': ['three'],
          // ユーティリティを分離
          'utils': ['uuid', 'alea', 'simplex-noise'],
          // ドメインロジック
          'domain': ['./src/domain/index.ts'],
          // インフラストラクチャ
          'infrastructure': ['./src/infrastructure/index.ts']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
```

### Tree Shaking が効かない

#### 症状
- 未使用コードがバンドルに含まれる
- バンドルサイズの肥大化

#### 解決方法
```typescript
// ❌ Tree Shaking を阻害するインポート
import * as THREE from 'three'

// ✅ 名前付きインポートによる最適化
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BoxGeometry,
  MeshBasicMaterial,
  Mesh
} from 'three'

// ❌ 副作用のあるインポート
import './global-setup.ts'

// ✅ 副作用なしの明示的インポート
import { setupGlobalEffects } from './setup'
setupGlobalEffects()
```

```json
// package.json - Tree Shaking 設定
{
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### ビルド時間が長い

#### 症状
- `pnpm build` の実行時間が異常に長い
- 開発時の HMR が遅い

#### 最適化手法
```typescript
// vite.config.ts - ビルド高速化
export default defineConfig({
  build: {
    // 並列処理の最大数
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  optimizeDeps: {
    // キャッシュの活用
    force: false,
    // 依存関係の事前バンドル
    include: ['effect', '@effect/schema', 'three']
  },
  esbuild: {
    // ESBuild による高速トランスパイル
    target: 'es2022',
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
```

```bash
# Node.js メモリ制限の増加
NODE_OPTIONS="--max-old-space-size=4096" pnpm build

# キャッシュのクリア
rm -rf node_modules/.vite
rm -rf dist
pnpm build
```

## テスト設定問題

### Vitest 設定エラー

#### 症状
```bash
Error: Cannot resolve './src/test-setup' from test/setup.ts
Error: [vitest] Cannot use import statement outside a module
```

#### 解決方法
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.d.ts',
        'vite.config.ts'
      ]
    },
    // TypeScriptファイルの直接実行
    transformMode: {
      web: [/\.[jt]sx?$/],
      ssr: [/\.[jt]sx?$/]
    }
  }
})
```

### Effect-TS テストでの型エラー

#### 症状
```bash
Type 'Effect<unknown, never, unknown>' is not assignable to type 'Effect<Player, PlayerError, PlayerService>'
```

#### 解決方法
```typescript
// test/setup.ts - Effect-TS テスト設定
import { Effect, Layer, TestContext } from "effect"
import { beforeEach } from "vitest"

// テスト用レイヤーの設定
beforeEach(() => {
  const testLayer = Layer.mergeAll(
    TestContext.TestContext,
    TestPlayerServiceLive,
    TestWorldServiceLive
  )

  // グローバルランタイムの設定
  Effect.runSync(Effect.provide(Effect.unit, testLayer))
})

// テスト用のEffect実行関数
export const runTest = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runSync(Effect.provide(effect, testLayer))

// 型安全なテストユーティリティ
export const expectEffect = <A, E>(
  effect: Effect.Effect<A, E>
): Promise<A> => Effect.runPromise(effect)
```

## CI/CD ビルド問題

### GitHub Actions でのビルド失敗

#### 症状
- ローカルでは成功するが CI で失敗
- 依存関係の解決エラー
- メモリ不足エラー

#### 解決方法
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm typecheck

      - name: Run tests
        run: pnpm test
        env:
          NODE_OPTIONS: --max_old_space_size=4096

      - name: Build
        run: pnpm build
        env:
          NODE_OPTIONS: --max_old_space_size=4096

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: success()
```

### Docker ビルドでの問題

#### 症状
- Node.js バージョン不整合
- 依存関係インストールの失敗

#### 解決方法
```dockerfile
# Dockerfile
FROM node:20-alpine

# pnpm のインストール
RUN npm install -g pnpm

WORKDIR /app

# 依存関係ファイルのコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係のインストール
RUN pnpm install --frozen-lockfile

# ソースコードのコピー
COPY . .

# ビルド
RUN pnpm build

# 本番用の軽量イメージ
FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
```

## 診断ツールとコマンド

### 問題診断用コマンド集
```bash
# 1. 基本的な健康診断
pnpm doctor

# 2. 依存関係の確認
pnpm list --depth=0
pnpm outdated

# 3. TypeScript 設定の確認
npx tsc --showConfig
npx tsc --noEmit --listFiles

# 4. Vite 診断
DEBUG=vite:* pnpm dev
npx vite --debug

# 5. バンドル分析
pnpm build -- --analyze
npx vite-bundle-analyzer dist

# 6. キャッシュクリア
rm -rf node_modules/.vite
rm -rf node_modules/.cache
pnpm store prune
```

### 自動診断スクリプト
```typescript
// scripts/diagnose.ts - プロジェクト診断スクリプト
import { Effect, pipe } from "effect"
import { execSync } from "child_process"
import * as fs from "fs"

const checkDependencies = Effect.gen(function* () {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  const lockfile = fs.readFileSync('pnpm-lock.yaml', 'utf-8')

  const issues = []

  // 依存関係バージョンチェック
  if (!lockfile.includes('effect@3.17.13')) {
    issues.push('Effect-TS version mismatch')
  }

  // TypeScript設定チェック
  const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf-8'))
  if (!tsConfig.compilerOptions.strict) {
    issues.push('TypeScript strict mode not enabled')
  }

  return issues
})

const runDiagnosis = Effect.gen(function* () {
  console.log("🔍 Running project diagnosis...")

  const dependencyIssues = yield* checkDependencies

  if (dependencyIssues.length > 0) {
    console.log("❌ Issues found:")
    dependencyIssues.forEach(issue => console.log(`  - ${issue}`))
  } else {
    console.log("✅ No issues found")
  }
})

Effect.runPromise(runDiagnosis).catch(console.error)
```

## 予防策とベストプラクティス

### 1. 設定ファイルの同期
```json
// エディタ設定ファイルの例 - プロジェクト統一設定
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll.oxlint": true
  },
  "files.associations": {
    "*.ts": "typescript"
  }
}
```

### 2. Pre-commit フックによる品質保証
```json
// package.json - Git フック設定
{
  "scripts": {
    "pre-commit": "pnpm typecheck && pnpm lint && pnpm test"
  },
  "husky": {
    "hooks": {
      "pre-commit": "pnpm pre-commit"
    }
  }
}
```

### 3. 設定ファイルの検証
```typescript
// scripts/validate-config.ts - 設定検証スクリプト
const validateConfigurations = Effect.gen(function* () {
  // tsconfig.json の検証
  const tsConfig = yield* readJsonFile('tsconfig.json')
  const requiredOptions = ['strict', 'noImplicitAny', 'strictNullChecks']

  const missingOptions = requiredOptions.filter(
    option => !tsConfig.compilerOptions[option]
  )

  if (missingOptions.length > 0) {
    yield* Effect.fail(new ConfigValidationError({
      file: 'tsconfig.json',
      missingOptions
    }))
  }

  // vite.config.ts の検証
  const viteConfigExists = yield* fileExists('vite.config.ts')
  if (!viteConfigExists) {
    yield* Effect.fail(new ConfigValidationError({
      file: 'vite.config.ts',
      message: 'Configuration file missing'
    }))
  }
})
```

## 関連リソース

- [よくあるエラー](./common-errors.md) - 一般的なエラー対処法
- [デバッグガイド](./debugging-guide.md) - デバッグ技術
- [パフォーマンス問題](./performance-issues.md) - パフォーマンス最適化
- [Vite 公式ドキュメント](https://vitejs.dev/) - Vite設定リファレンス
- [TypeScript 公式ドキュメント](https://www.typescriptlang.org/docs/) - TypeScript設定ガイド