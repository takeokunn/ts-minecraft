---
title: "ビルド設定 - 本番環境最適化ガイド"
description: "TypeScript Minecraft本番ビルド設定。Vite 5.x最適化、Three.js統合、Effect-TS最適化、CI/CD連携。"
category: "reference"
difficulty: "advanced"
tags: ["build", "production", "vite", "optimization", "three.js", "effect-ts"]
prerequisites: ["vite-basics", "typescript-config"]
estimated_reading_time: "20分"
dependencies: ["./vite-config.md", "./typescript-config.md"]
status: "complete"
---

# Build Configuration

> **ビルド設定**: 本番向け最適化ビルドパイプライン構築

## 概要

TypeScript Minecraftプロジェクトのビルド設定について詳しく解説します。Vite 5.x最適化、Three.js統合、Effect-TS最適化、パフォーマンス調整、CI/CD統合など、本番品質のビルドを実現する実用的な設定例を豊富に提供します。

## 基本ビルド設定

### Nix環境用Viteビルド設定

```typescript
// vite.config.build.ts
import { defineConfig, type UserConfig } from 'vite'
import { resolve } from 'path'
import { config } from 'dotenv'
import { visualizer } from 'rollup-plugin-visualizer'
import { compression } from 'vite-plugin-compression'

// Nix devenv環境設定読み込み
config({ path: './.devenv.env' })

export default defineConfig(({ mode }): UserConfig => {
  const isProd = mode === 'production'
  const isAnalyze = process.env.ANALYZE === 'true'

  return {
    build: {
      // ターゲット環境（モダンブラウザ対応）
      target: ['es2022', 'chrome90', 'firefox88', 'safari14'],

      // 出力設定
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,

      // ソースマップ設定（環境別）
      sourcemap: isProd ? false : 'inline',

      // 圧縮設定（高度な最適化）
      minify: isProd ? 'terser' : false,
      terserOptions: {
        compress: {
          // ES2022最適化
          ecma: 2022,

          // デバッグ情報削除
          drop_console: isProd,
          drop_debugger: isProd,

          // 未使用コード除去
          dead_code: true,
          unused: true,

          // 純粋関数呼び出し除去
          pure_funcs: isProd ? [
            'console.log',
            'console.info',
            'console.warn',
            'console.error',
            'console.debug',
            'console.trace'
          ] : [],

          // Effect-TS最適化
          pure_getters: true,
          unsafe: false,
          unsafe_arrows: false,
          unsafe_comps: false,
          unsafe_Function: false,
          unsafe_math: false,
          unsafe_symbols: false,
          unsafe_methods: false,
          unsafe_proto: false,
          unsafe_regexp: false,
          unsafe_undefined: false
        },
        mangle: {
          // 変数名短縮化
          safari10: true,
          properties: {
            // プライベートプロパティのみ短縮化
            regex: /^_/
          }
        },
        format: {
          // コメント削除
          comments: false,
          // ASCII文字のみ使用
          ascii_only: true
        }
      },

      // CSS最適化
      cssTarget: 'chrome90',
      cssMinify: 'lightningcss',
      cssCodeSplit: true,

      // アセット処理
      assetsInlineLimit: 2048, // 2KB未満はインライン化
      chunkSizeWarningLimit: 1000, // 1MB警告閾値

      // Rollup設定（高度な最適化）
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          // Web Workers
          chunkWorker: resolve(__dirname, 'src/workers/chunk-worker.ts'),
          physicsWorker: resolve(__dirname, 'src/workers/physics-worker.ts')
        },

        // 外部依存関係（CDN利用時）
        external: isProd ? [] : [],

        output: {
          // ファイル名パターン（キャッシュ最適化）
          entryFileNames: 'assets/js/[name]-[hash].js',
          chunkFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'assets/css/[name]-[hash][extname]'
            }
            if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name || '')) {
              return 'assets/fonts/[name]-[hash][extname]'
            }
            if (/\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i.test(assetInfo.name || '')) {
              return 'assets/images/[name]-[hash][extname]'
            }
            if (/\.(gltf|glb|obj|mtl|fbx)(\?.*)?$/i.test(assetInfo.name || '')) {
              return 'assets/models/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          },

          // 高度なチャンク分割戦略
          manualChunks: (id) => {
            // Core libraries（最優先）
            if (id.includes('effect/')) {
              if (id.includes('effect/Schema')) return 'effect-schema'
              if (id.includes('effect/Context')) return 'effect-context'
              return 'effect-core'
            }

            // Three.js分割
            if (id.includes('three')) {
              if (id.includes('examples/jsm/controls')) return 'three-controls'
              if (id.includes('examples/jsm/loaders')) return 'three-loaders'
              if (id.includes('examples/jsm')) return 'three-extras'
              return 'three-core'
            }

            // ユーティリティライブラリ
            if (id.includes('lodash') || id.includes('date-fns') || id.includes('uuid')) {
              return 'utils'
            }

            // アプリケーション機能別
            if (id.includes('@/domain/')) {
              if (id.includes('entities')) return 'domain-entities'
              if (id.includes('value-objects')) return 'domain-values'
              return 'domain-core'
            }

            if (id.includes('@/application/')) {
              if (id.includes('systems')) return 'app-systems'
              if (id.includes('services')) return 'app-services'
              return 'app-core'
            }

            if (id.includes('@/infrastructure/')) {
              if (id.includes('rendering')) return 'infra-rendering'
              if (id.includes('storage')) return 'infra-storage'
              return 'infra-core'
            }

            if (id.includes('@/presentation/')) {
              if (id.includes('components')) return 'ui-components'
              if (id.includes('hooks')) return 'ui-hooks'
              return 'ui-core'
            }

            // その他のnode_modules
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          },

          // チャンク情報出力
          ...(isAnalyze && {
            sourcemapPathTransform: (relativePath) => {
              return `webpack:///${relativePath}`
            }
          })
        },

        // Tree shaking最適化
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        }
      },

      // モジュールプリロード設定
      modulePreload: {
        polyfill: true,
        resolveDependencies: (filename, deps, { hostId, hostType }) => {
          // 重要なチャンクのみプリロード
          return deps.filter(dep =>
            dep.includes('effect-core') ||
            dep.includes('three-core') ||
            dep.includes('domain-core')
          )
        }
      },

      // 実験的機能
      experimental: {
        // Render worker
        renderBuiltUrl: (filename, { hostId, hostType, type }) => {
          if (type === 'asset') {
            return `https://cdn.minecraft-ts.example.com/${filename}`
          }
          return { relative: true }
        }
      }
    },

    // プラグイン設定（ビルド専用）
    plugins: [
      // バンドルサイズ分析
      isAnalyze && visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap' // または 'sunburst', 'network'
      }),

      // Gzip圧縮
      isProd && compression({
        algorithm: 'gzip',
        ext: '.gz',
        deleteOriginFile: false,
        threshold: 1024,
        filter: /\.(js|css|html|svg|json|xml|woff|woff2)$/i
      }),

      // Brotli圧縮（より効率的）
      isProd && compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        deleteOriginFile: false,
        threshold: 1024,
        filter: /\.(js|css|html|svg|json|xml|woff|woff2)$/i
      })
    ].filter(Boolean)
  }
})
```

## 🏗️ 環境別ビルド設定

### 開発ビルド設定（高速ビルド）

```typescript
// vite.config.dev.ts
export const developmentBuildConfig = {
  build: {
    // 開発時の高速ビルド
    target: 'es2022',
    sourcemap: 'eval-cheap-module-source-map',
    minify: false,

    // 最小限の最適化
    rollupOptions: {
      output: {
        // ファイル名簡略化（開発用）
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',

        // 単純なチャンク分割
        manualChunks: {
          vendor: ['three', 'effect'],
          utils: ['lodash-es', 'date-fns']
        }
      },

      // Tree shaking無効（ビルド速度優先）
      treeshake: false
    },

    // Watch設定
    watch: {
      include: 'src/**',
      exclude: ['node_modules/**', 'dist/**']
    }
  }
}
```

### ステージング環境設定

```typescript
// vite.config.staging.ts
export const stagingBuildConfig = {
  build: {
    target: ['es2022', 'chrome90', 'firefox88'],
    sourcemap: 'hidden', // デバッグ用にソースマップ保持

    // 中程度の最適化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // ステージングではconsole.log保持
        drop_debugger: true,
        dead_code: true
      }
    },

    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('effect')) return 'effect'
          if (id.includes('three')) return 'three'
          if (id.includes('node_modules')) return 'vendor'
          if (id.includes('@/')) return 'app'
        }
      }
    }
  }
}
```

### 本番環境設定（最大最適化）

```typescript
// vite.config.prod.ts
export const productionBuildConfig = {
  build: {
    target: ['es2022', 'chrome90', 'firefox88', 'safari14'],
    sourcemap: false,

    // 最大最適化
    minify: 'terser',
    terserOptions: {
      compress: {
        ecma: 2022,
        drop_console: true,
        drop_debugger: true,
        dead_code: true,
        unused: true,
        pure_funcs: [
          'console.log',
          'console.info',
          'console.warn',
          'console.error',
          'console.debug'
        ],
        // Effect-TS最適化
        pure_getters: true,
        passes: 2 // 2回最適化実行
      },
      mangle: {
        safari10: true,
        properties: {
          regex: /^_/
        }
      }
    },

    // 極限バンドル最適化
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 詳細なチャンク分割
          const chunks = analyzeModuleForChunking(id)
          return chunks
        }
      },

      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },

    // アセット最適化
    assetsInlineLimit: 1024, // より小さいファイルもインライン化
    chunkSizeWarningLimit: 800 // 警告閾値を厳格化
  }
}

function analyzeModuleForChunking(id: string): string {
  // 複雑なチャンク分割ロジック
  if (id.includes('effect/Schema')) return 'effect-schema'
  if (id.includes('effect/Context')) return 'effect-context'
  if (id.includes('effect/Match')) return 'effect-match'
  if (id.includes('effect')) return 'effect-core'

  if (id.includes('three/examples/jsm/controls')) return 'three-controls'
  if (id.includes('three/examples/jsm/loaders')) return 'three-loaders'
  if (id.includes('three/examples/jsm/postprocessing')) return 'three-postfx'
  if (id.includes('three/examples/jsm')) return 'three-extras'
  if (id.includes('three')) return 'three-core'

  // アプリケーション層別
  if (id.includes('@/domain/entities')) return 'domain-entities'
  if (id.includes('@/domain/value-objects')) return 'domain-values'
  if (id.includes('@/domain')) return 'domain-core'

  if (id.includes('@/application/systems/physics')) return 'systems-physics'
  if (id.includes('@/application/systems/rendering')) return 'systems-rendering'
  if (id.includes('@/application/systems')) return 'systems-core'
  if (id.includes('@/application')) return 'app-core'

  if (id.includes('@/infrastructure/rendering')) return 'infra-rendering'
  if (id.includes('@/infrastructure/storage')) return 'infra-storage'
  if (id.includes('@/infrastructure')) return 'infra-core'

  if (id.includes('@/presentation/components/ui')) return 'ui-components'
  if (id.includes('@/presentation/components/game')) return 'game-ui'
  if (id.includes('@/presentation')) return 'presentation'

  if (id.includes('node_modules')) return 'vendor'
  return undefined
}
```

## ⚡ パフォーマンス最適化設定

### バンドルサイズ最適化

```typescript
// config/bundle-optimization.ts
export const bundleOptimizationConfig = {
  // 重複除去設定
  deduplication: {
    enabled: true,
    strategy: 'exact-match', // または 'similar'
    threshold: 0.8
  },

  // Tree shaking強化
  treeShaking: {
    // ES Modules Pure注釈
    pureFunctions: [
      'Effect.succeed',
      'Effect.fail',
      'Effect.sync',
      'Effect.async',
      'Schema.struct',
      'Schema.string',
      'Schema.number'
    ],

    // 副作用なしモジュール
    sideEffectFreeModules: [
      '@/domain/**/*',
      '@/utils/**/*',
      'effect/Schema',
      'effect/Match'
    ]
  },

  // コード分割戦略
  codeSplitting: {
    // 機能別分割
    features: {
      inventory: ['@/features/inventory/**/*'],
      crafting: ['@/features/crafting/**/*'],
      world: ['@/features/world/**/*']
    },

    // 動的インポート閾値
    dynamicImportThreshold: 50000, // 50KB以上で分割

    // プリロード戦略
    preloadStrategy: 'critical-path' // または 'all', 'none'
  },

  // アセット最適化
  assets: {
    images: {
      // WebP変換
      convertToWebP: true,
      quality: 85,
      progressive: true
    },

    models: {
      // Three.js モデル最適化
      compressGeometry: true,
      optimizeMaterials: true,
      removeUnusedMaterials: true
    },

    fonts: {
      // フォントサブセット化
      subsetFonts: true,
      fontDisplay: 'swap'
    }
  }
}
```

### 実行時パフォーマンス最適化

```typescript
// config/runtime-optimization.ts
export const runtimeOptimizationConfig = {
  // Three.js最適化
  threejs: {
    // レンダリング最適化
    rendering: {
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    },

    // メモリ管理
    memory: {
      disposeUnusedTextures: true,
      disposeUnusedGeometry: true,
      maxTextureSize: 2048,
      textureCompression: 'DXT'
    },

    // LOD (Level of Detail) 設定
    lod: {
      enabled: true,
      distances: [10, 50, 100, 500],
      hysteresis: 0.025
    }
  },

  // Effect-TS最適化
  effectTS: {
    // Fiber管理
    fiber: {
      cleanupInterval: 60000,
      maxFiberAge: 300000
    },

    // Context管理
    context: {
      poolSize: 20,
      enableContextPooling: true
    },

    // トレーシング設定
    tracing: {
      enabled: false, // 本番では無効
      sampleRate: 0.01
    }
  },

  // Web Workers最適化
  workers: {
    // ワーカー数最適化
    maxWorkers: Math.min(navigator.hardwareConcurrency || 4, 8),

    // ワーカー設定
    chunkWorker: {
      enabled: true,
      transferables: ['ArrayBuffer', 'ImageData']
    },

    physicsWorker: {
      enabled: true,
      updateRate: 60 // FPS
    }
  }
}
```

## 🧪 ビルドテスト設定

### ビルド品質検証

```typescript
// config/build-quality.ts
export const buildQualityConfig = {
  // バンドルサイズ制限
  sizeConstraints: {
    // 各チャンクの最大サイズ
    chunks: {
      'effect-core': 150_000,      // 150KB
      'three-core': 500_000,       // 500KB
      'app-core': 200_000,         // 200KB
      'vendor': 300_000            // 300KB
    },

    // 合計サイズ制限
    total: {
      js: 2_000_000,               // 2MB
      css: 200_000,                // 200KB
      assets: 10_000_000           // 10MB
    }
  },

  // パフォーマンス指標
  performance: {
    // First Contentful Paint
    fcp: 1500,                     // 1.5秒以内

    // Largest Contentful Paint
    lcp: 2500,                     // 2.5秒以内

    // Time to Interactive
    tti: 3000,                     // 3秒以内

    // Total Blocking Time
    tbt: 200                       // 200ms以内
  },

  // セキュリティ検証
  security: {
    // CSP違反チェック
    cspViolations: [],

    // 脆弱性スキャン
    vulnerabilityThreshold: 'medium',

    // 機密情報チェック
    secretsPattern: /(?:api[_-]?key|password|secret|token)/gi
  }
}
```

### ビルド後検証スクリプト

```typescript
// scripts/validate-build.ts
import { readFileSync, statSync, readdirSync } from 'fs'
import { join } from 'path'
import { gzipSync, brotliCompressSync } from 'zlib'

interface BuildStats {
  files: FileStats[]
  totalSize: number
  totalGzipSize: number
  totalBrotliSize: number
  chunkAnalysis: ChunkAnalysis[]
}

interface FileStats {
  name: string
  size: number
  gzipSize: number
  brotliSize: number
  type: 'js' | 'css' | 'asset'
}

interface ChunkAnalysis {
  name: string
  size: number
  dependencies: string[]
  duplicateCode: string[]
}

export async function validateBuild(): Promise<BuildStats> {
  const distDir = 'dist'
  const stats: BuildStats = {
    files: [],
    totalSize: 0,
    totalGzipSize: 0,
    totalBrotliSize: 0,
    chunkAnalysis: []
  }

  // ファイル統計収集
  function collectFileStats(dir: string): void {
    const files = readdirSync(dir, { withFileTypes: true })

    for (const file of files) {
      const filePath = join(dir, file.name)

      if (file.isDirectory()) {
        collectFileStats(filePath)
      } else {
        const content = readFileSync(filePath)
        const gzipSize = gzipSync(content).length
        const brotliSize = brotliCompressSync(content).length

        const fileStats: FileStats = {
          name: file.name,
          size: content.length,
          gzipSize,
          brotliSize,
          type: getFileType(file.name)
        }

        stats.files.push(fileStats)
        stats.totalSize += fileStats.size
        stats.totalGzipSize += fileStats.gzipSize
        stats.totalBrotliSize += fileStats.brotliSize
      }
    }
  }

  collectFileStats(distDir)

  // サイズ制限チェック
  validateSizeConstraints(stats)

  // 重複コードチェック
  await analyzeDuplicateCode(stats)

  // パフォーマンス予測
  estimatePerformanceMetrics(stats)

  return stats
}

function getFileType(filename: string): 'js' | 'css' | 'asset' {
  if (filename.endsWith('.js')) return 'js'
  if (filename.endsWith('.css')) return 'css'
  return 'asset'
}

function validateSizeConstraints(stats: BuildStats): void {
  const jsFiles = stats.files.filter(f => f.type === 'js')
  const cssFiles = stats.files.filter(f => f.type === 'css')

  const totalJsSize = jsFiles.reduce((sum, f) => sum + f.size, 0)
  const totalCssSize = cssFiles.reduce((sum, f) => sum + f.size, 0)

  // サイズ制限チェック
  if (totalJsSize > buildQualityConfig.sizeConstraints.total.js) {
    throw new Error(`JS bundle size exceeded: ${totalJsSize} > ${buildQualityConfig.sizeConstraints.total.js}`)
  }

  if (totalCssSize > buildQualityConfig.sizeConstraints.total.css) {
    throw new Error(`CSS bundle size exceeded: ${totalCssSize} > ${buildQualityConfig.sizeConstraints.total.css}`)
  }
}

async function analyzeDuplicateCode(stats: BuildStats): Promise<void> {
  // 重複コード分析ロジック
  // 実装は複雑になるため概要のみ
  console.log('Analyzing duplicate code...')
}

function estimatePerformanceMetrics(stats: BuildStats): void {
  // パフォーマンス指標推定
  const mainJsSize = stats.files.find(f => f.name.includes('main'))?.gzipSize || 0
  const estimatedFCP = Math.max(800, mainJsSize / 1000) // 簡易推定

  console.log(`Estimated FCP: ${estimatedFCP}ms`)
}
```

## 🔧 CI/CDビルド統合

### GitHub Actions設定

```yaml
# .github/workflows/build.yml
name: Build and Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Type check
      run: pnpm type-check

    - name: Lint
      run: pnpm lint

    - name: Test
      run: pnpm test:coverage

    - name: Build (Development)
      if: github.ref != 'refs/heads/main'
      run: pnpm build:dev

    - name: Build (Production)
      if: github.ref == 'refs/heads/main'
      run: pnpm build:prod
      env:
        NODE_OPTIONS: '--max-old-space-size=4096'

    - name: Build Analysis
      if: github.ref == 'refs/heads/main'
      run: pnpm build:analyze

    - name: Validate Build
      run: pnpm validate:build

    - name: Upload Build Artifacts
      uses: actions/upload-artifact@v4
      with:
        name: build-${{ github.sha }}
        path: |
          dist/
          stats.html
        retention-days: 30

    - name: Performance Audit
      if: github.ref == 'refs/heads/main'
      uses: treosh/lighthouse-ci-action@v10
      with:
        configPath: './lighthouserc.js'
        uploadArtifacts: true
        temporaryPublicStorage: true
```

### package.json ビルドスクリプト

```json
{
  "scripts": {
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "build:prod": "vite build --mode production",
    "build:analyze": "ANALYZE=true vite build --mode production",
    "build:clean": "rm -rf dist && pnpm build",
    "validate:build": "tsx scripts/validate-build.ts",
    "preview:build": "vite preview --port 4173",
    "size:check": "bundlesize",
    "perf:audit": "lighthouse http://localhost:4173 --output html --output-path ./lighthouse-report.html"
  },

  "bundlesize": [
    {
      "path": "./dist/assets/js/main-*.js",
      "maxSize": "200kb",
      "compression": "gzip"
    },
    {
      "path": "./dist/assets/js/effect-core-*.js",
      "maxSize": "150kb",
      "compression": "gzip"
    },
    {
      "path": "./dist/assets/js/three-core-*.js",
      "maxSize": "500kb",
      "compression": "gzip"
    }
  ]
}
```

## 🛠️ トラブルシューティング

### よくあるビルド問題と解決法

#### 1. バンドルサイズが大きすぎる

**症状**: ビルド成果物のサイズが想定より大きい

**解決策**:
```bash
# バンドル分析実行
ANALYZE=true pnpm build

# 特定ライブラリのサイズ確認
npx webpack-bundle-analyzer dist/stats.json

# 重複依存関係の確認
npx npm ls --depth=0
pnpm why package-name
```

**最適化手順**:
```typescript
// 1. 動的インポートに変換
const LazyComponent = lazy(() => import('./heavy-component'))

// 2. 条件分岐でのインポート
if (isDevelopment) {
  const DevTools = await import('./dev-tools')
}

// 3. Tree shaking対象の確認
// package.jsonで"sideEffects": falseを確認
```

#### 2. ビルドが遅い

**症状**: ビルド時間が長く、CI/CDでタイムアウトする

**解決策**:
```bash
# Node.jsメモリ制限増加
NODE_OPTIONS="--max-old-space-size=8192" pnpm build

# 並列ビルド設定
export UV_THREADPOOL_SIZE=16

# 依存関係キャッシュ確認
pnpm store status
```

**最適化設定**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      // 並列処理数制限
      maxParallelFileOps: 8,

      // キャッシュ設定
      cache: true,

      // 最適化レベル調整
      treeshake: {
        preset: 'smallest' // または 'safest'
      }
    }
  }
})
```

#### 3. Three.jsビルドエラー

**症状**: Three.jsモジュールのimportでエラーが発生

**解決策**:
```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/controls/OrbitControls',
      'three/examples/jsm/loaders/GLTFLoader'
    ]
  },
  build: {
    rollupOptions: {
      external: [], // Three.jsを外部化しない
      output: {
        globals: {} // グローバル変数不要
      }
    }
  }
})
```

#### 4. Effect-TS最適化問題

**症状**: Effect-TSコードが期待通りに最適化されない

**解決策**:
```typescript
// 1. Pure注釈の追加
/*#__PURE__*/ Effect.succeed(value)

// 2. Tree shaking設定
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      treeshake: {
        annotations: true,
        moduleSideEffects: false
      }
    }
  }
})

// 3. Effect-TS専用最適化
export default defineConfig({
  define: {
    __DEV__: JSON.stringify(false), // 開発用コード除去
    'process.env.NODE_ENV': JSON.stringify('production')
  }
})
```

## 📊 ビルドメトリクス監視

### パフォーマンス指標追跡

```typescript
// scripts/build-metrics.ts
interface BuildMetrics {
  buildTime: number
  bundleSize: {
    total: number
    gzipped: number
    brotli: number
  }
  chunkSizes: Record<string, number>
  dependencies: {
    count: number
    vulnerabilities: number
  }
  performance: {
    fcp: number
    lcp: number
    tbt: number
  }
}

export async function collectBuildMetrics(): Promise<BuildMetrics> {
  const startTime = Date.now()

  // ビルド実行
  await execBuild()

  const buildTime = Date.now() - startTime

  // メトリクス収集
  const metrics: BuildMetrics = {
    buildTime,
    bundleSize: await analyzeBundleSize(),
    chunkSizes: await analyzeChunkSizes(),
    dependencies: await analyzeDependencies(),
    performance: await estimatePerformance()
  }

  // メトリクス保存
  await saveMetrics(metrics)

  // 閾値チェック
  validateMetrics(metrics)

  return metrics
}

async function validateMetrics(metrics: BuildMetrics): Promise<void> {
  const constraints = buildQualityConfig.sizeConstraints

  if (metrics.bundleSize.gzipped > constraints.total.js) {
    throw new Error(`Bundle size exceeded: ${metrics.bundleSize.gzipped}`)
  }

  if (metrics.performance.fcp > buildQualityConfig.performance.fcp) {
    console.warn(`FCP target missed: ${metrics.performance.fcp}ms`)
  }
}
```

## 🛠️ Nix環境固有ビルド設定

### devenv.nix連携ビルド

```typescript
// vite.config.nix-build.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  const nixProfile = process.env.NIX_PROFILE
  const devenvRoot = process.env.DEVENV_ROOT

  return {
    build: {
      // Nix環境でのビルドターゲット
      target: 'node22', // devenv.nixのNode.js 22に合わせる

      // Nix store対応のソースマップ
      sourcemap: isProd ? false : 'inline',

      rollupOptions: {
        // Nix環境での外部化設定
        external: (id) => {
          // Nix store内のパッケージは外部化しない
          if (id.startsWith('/nix/store')) return false
          return id.startsWith('node:') || id.startsWith('@types/')
        },

        // Nixビルド成果物の除外
        input: {
          main: resolve(process.cwd(), 'index.html')
        },

        output: {
          // Nix環境でのアセット配置
          dir: 'dist',
          format: 'es',

          // pnpmシンボリックリンクに対応したパス解決
          paths: (id) => {
            if (id.startsWith('@/')) {
              return id.replace('@/', './src/')
            }
            return id
          },

          // Nix環境変数を活用したチャンク命名
          entryFileNames: `assets/js/[name]-${process.env.DEVENV_STATE?.split('/').pop() || 'dev'}-[hash].js`,
          chunkFileNames: `assets/js/[name]-${process.env.DEVENV_STATE?.split('/').pop() || 'dev'}-[hash].js`
        }
      },

      // Nix環境での最適化設定
      minify: 'terser',
      terserOptions: {
        compress: {
          // Node.js 22の最新機能を活用
          ecma: 2022,

          // Nix環境固有の最適化
          drop_console: isProd,
          keep_fargs: false,

          // pnpmによる重複排除を考慮
          pure_funcs: [
            'console.log',
            'console.info',
            'console.warn',
            'Effect.logInfo',
            'Effect.logDebug'
          ]
        }
      }
    },

    // Nix環境でのesbuild設定
    esbuild: {
      target: 'node22',
      platform: 'browser',
      format: 'esm',

      // Nixパッケージ解決用設定
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],

      // devenv環境変数の注入
      define: {
        __NIX_PROFILE__: JSON.stringify(nixProfile),
        __DEVENV_ROOT__: JSON.stringify(devenvRoot),
        __NODE_VERSION__: JSON.stringify(process.version)
      }
    },

    // Nix環境でのパッケージ解決
    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src'),

        // pnpm store内のパッケージ解決
        'effect': nixProfile ? `${nixProfile}/lib/node_modules/effect` : 'effect',
        'three': nixProfile ? `${nixProfile}/lib/node_modules/three` : 'three'
      },

      // pnpmシンボリックリンクの正しい解決
      preserveSymlinks: false,

      // Nix store内のモジュール探索
      conditions: ['browser', 'module', 'import']
    }
  }
})
```

### Nix専用ビルドスクリプト

```bash
#!/usr/bin/env bash
# scripts/nix-build.sh

set -euo pipefail

# Nix環境での最適化ビルドスクリプト
echo "🏗️  Starting Nix-optimized build..."

# devenv環境確認
if [ -z "${DEVENV_ROOT:-}" ]; then
    echo "❌ DEVENV_ROOT not set. Please run 'devenv shell' first."
    exit 1
fi

# Node.js 22の確認
node_version=$(node --version)
if [[ ! $node_version =~ ^v22\. ]]; then
    echo "❌ Expected Node.js v22.x, got $node_version"
    exit 1
fi

# pnpmキャッシュ最適化
export PNPM_CACHE_DIR="${DEVENV_STATE}/pnpm-cache"

# TypeScriptビルドキャッシュ
export TS_NODE_COMPILER_OPTIONS='{"module":"NodeNext","target":"ES2022"}'

# メモリ最適化（Nix環境用）
export NODE_OPTIONS="--max-old-space-size=6144 --experimental-vm-modules"

# Vite専用環境変数
export VITE_NIX_BUILD=true
export VITE_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ビルドモード選択
case "${1:-production}" in
    "dev"|"development")
        echo "🔨 Building for development..."
        pnpm exec vite build --mode development --config vite.config.nix-build.ts
        ;;
    "prod"|"production")
        echo "🚀 Building for production..."
        pnpm exec vite build --mode production --config vite.config.nix-build.ts

        # 本番ビルド後の最適化
        echo "📊 Analyzing bundle..."
        ANALYZE=true pnpm exec vite build --mode production --config vite.config.nix-build.ts
        ;;
    "analyze")
        echo "📈 Building with bundle analysis..."
        ANALYZE=true pnpm exec vite build --mode production --config vite.config.nix-build.ts
        ;;
    *)
        echo "❌ Unknown build mode: $1"
        echo "Usage: $0 [dev|prod|analyze]"
        exit 1
        ;;
esac

echo "✅ Build completed successfully!"

# ビルド後検証
if [ -d "dist" ]; then
    echo "📦 Build artifacts:"
    du -sh dist/*

    # Gzipサイズ確認
    echo ""
    echo "📏 Gzipped sizes:"
    find dist -name "*.js" -exec sh -c 'echo "$(gzip -c "{}" | wc -c) bytes: {}"' \; | sort -n
fi
```

### Docker + Nix ビルド設定

```dockerfile
# Dockerfile.nix-build
FROM nixos/nix:latest as nix-builder

# devenvのインストール
RUN nix-env -iA nixpkgs.cachix
RUN cachix use devenv

# プロジェクトファイルをコピー
WORKDIR /app
COPY devenv.nix devenv.lock ./
COPY src ./src
COPY package.json pnpm-lock.yaml ./

# devenv環境でのビルド
RUN nix develop --command pnpm install --frozen-lockfile
RUN nix develop --command pnpm build:prod

# 最終イメージ（軽量）
FROM nginx:alpine

# ビルド成果物をコピー
COPY --from=nix-builder /app/dist /usr/share/nginx/html

# Nginx設定
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Nixパッケージ依存関係最適化

```typescript
// config/nix-dependencies.ts
export const nixOptimizedDependencies = {
  // Node.js 22 + pnpm最適化された依存関係
  core: [
    'effect@3.17.0',        // Nixでビルドされたeffect
    'three@0.170.0',        // WebGL最適化版
    '@types/three@0.170.0'
  ],

  // Nix store内で事前コンパイルされたパッケージ
  precompiled: [
    'typescript',           // devenv.nixで提供
    'typescript-language-server'
  ],

  // pnpmでの重複排除対象
  dedupe: [
    'effect',
    'three',
    '@types/node',
    'tslib'
  ],

  // Nix環境でのビルド時間最適化
  buildOptimization: {
    // キャッシュ可能な依存関係
    cacheable: [
      'effect/*',
      'three/*',
      '@types/*'
    ],

    // 事前コンパイル対象
    precompile: [
      '@/domain/**/*',
      '@/utils/**/*'
    ],

    // 動的読み込み対象
    dynamic: [
      '@/features/**/*',
      '@/presentation/pages/**/*'
    ]
  }
}
```

## 📚 関連ドキュメント

### 設定ファイル関連
- [Vite設定](./vite-config.md) - Vite開発・ビルド設定詳細
- [TypeScript設定](./typescript-config.md) - TypeScript compilerOptions
- [Project設定](./project-config.md) - プロジェクト全体設定
- [Development設定](./development-config.md) - 開発環境最適化
- [devenv.nix](../../../devenv.nix) - Nix開発環境設定

### 外部リファレンス
- [Vite Build Options](https://vitejs.dev/config/build-options.html)
- [Rollup Configuration](https://rollupjs.org/configuration-options/)
- [Terser Options](https://terser.org/docs/api-reference)
- [Web Vitals](https://web.dev/vitals/)

### プロジェクト固有
- [デプロイガイド](../../03-guides/02-deployment.md)
- [パフォーマンス最適化](../troubleshooting/performance-issues.md)
- [Three.js統合ガイド](../../03-guides/10-threejs-integration.md)