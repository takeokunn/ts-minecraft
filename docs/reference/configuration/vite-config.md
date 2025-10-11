---
title: 'Vite設定 - ビルドツール完全ガイド'
description: 'Vite 7.1+でのTypeScript Minecraftプロジェクト設定。Nix環境対応、Effect-TS最適化、パフォーマンス調整。'
category: 'reference'
difficulty: 'intermediate'
tags: ['vite', 'build-tools', 'nix', 'effect-ts', 'configuration', 'performance', 'pnpm']
prerequisites: ['basic-typescript', 'build-tools-basics']
estimated_reading_time: '20分'
dependencies: ['./typescript-config.md']
status: 'complete'
---

# Vite Configuration

> **Vite設定**: プロジェクトのVite設定完全リファレンス

## 概要

TypeScript MinecraftプロジェクトのVite 7.1+設定について詳しく解説します。Nix開発環境での統合、pnpmパッケージマネージャー、Effect-TS最適化、パフォーマンス調整など、実用的な設定例を豊富に提供します。

**プロジェクト技術スタック**:

- **開発環境**: Nix + devenv
- **パッケージマネージャー**: pnpm
- **ランタイム**: Node.js 22
- **ビルドツール**: Vite 7.1+
- **言語**: TypeScript 5.9+
- **関数型ライブラリ**: Effect-TS 3.17+

## 基本設定

### 完全なvite.config.ts設定例

**注意**: このプロジェクトはNix環境で開発されており、実際の設定ファイルは存在しませんが、以下は実用的な設定例です。

```typescript
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import dns from 'node:dns'

// Nix環境での開発に最適化されたVite設定
// Node.js 22でのlocalhost解決最適化
dns.setDefaultResultOrder('verbatim')

export default defineConfig(({ command, mode }) => {
  // Nix環境の環境変数読み込み
  const env = loadEnv(mode, process.cwd(), '')

  const isDev = command === 'serve'
  const isProd = command === 'build' && mode === 'production'
  const isPreview = command === 'preview'

  return {
    // サーバー設定（Nix/devenv環境最適化）
    server: {
      port: env.VITE_PORT ? Number(env.VITE_PORT) : 5173,
      host: '0.0.0.0', // Nix container対応
      strictPort: false, // Nixでの動的ポート割り当て許可
      open: isDev,
      cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        credentials: true,
      },

      // HMR設定（Nix環境最適化）
      hmr: {
        port: env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : 5174,
        overlay: true, // エラーオーバーレイ表示
        clientPort: env.VITE_HMR_CLIENT_PORT ? Number(env.VITE_HMR_CLIENT_PORT) : 5174,
      },

      // プロキシ設定（API統合用）
      proxy: isDev
        ? {
            '/api': {
              target: env.API_URL || 'http://localhost:8080',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
              configure: (proxy, _options) => {
                proxy.on('error', (err, _req, _res) => {
                  console.log('プロキシエラー:', err)
                })
              },
            },
            // WebSocket プロキシ（マルチプレイヤー用）
            '/socket.io': {
              target: 'ws://localhost:3002',
              ws: true,
              rewriteWsOrigin: true,
            },
          }
        : undefined,

      // パフォーマンス向上：事前ウォームアップ（Effect-TS最適化）
      warmup: isDev
        ? {
            clientFiles: [
              './src/domain/**/*.ts', // ドメインモデル
              './src/application/**/*.ts', // アプリケーションサービス
              './src/infrastructure/**/*.ts', // インフラストラクチャ
              './src/presentation/**/*.ts', // プレゼンテーション層
              './src/shared/**/*.ts', // 共有コンポーネント
            ],
            ssrFiles: [], // SSRは使用しない
          }
        : undefined,
    },

    // ビルド設定（Node.js 22対応）
    build: {
      target: 'es2022', // Node.js 22対応
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDev,
      minify: isProd ? 'terser' : false,
      reportCompressedSize: false, // Nixビルドでの高速化

      // Terser設定（本番最適化）
      terserOptions: isProd
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.warn', 'console.info'],
              passes: 2, // 2パス最適化
            },
            mangle: {
              safari10: true,
              properties: {
                regex: /^_/, // プライベートメンバー短縮化
              },
            },
            format: {
              comments: false, // コメント除去
            },
          }
        : undefined,

      // チャンク分割（効率的なキャッシュ）
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          worker: resolve(__dirname, 'src/workers/chunk-worker.ts'),
        },
        output: {
          // ファイル名設定（キャッシュ最適化）
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',

          // マニュアルチャンク（Effect-TS DDD最適化）
          manualChunks: (id) => {
            // Effect-TS関連
            if (id.includes('effect/')) {
              if (id.includes('Schema')) return 'effect-schema'
              if (id.includes('Context')) return 'effect-context'
              if (id.includes('Match')) return 'effect-match'
              return 'effect-core'
            }

            // 外部ライブラリ
            if (id.includes('node_modules')) {
              if (id.includes('three')) return 'three'
              if (id.includes('lodash')) return 'lodash'
              return 'vendor'
            }

            // アプリケーション層別分割
            if (id.includes('/domain/')) return 'domain'
            if (id.includes('/application/')) return 'application'
            if (id.includes('/infrastructure/')) return 'infrastructure'
            if (id.includes('/presentation/')) return 'presentation'
            if (id.includes('/shared/')) return 'shared'
          },
        },
      },

      // リソース管理
      assetsInlineLimit: 4096, // 4KB未満はインライン化
      cssCodeSplit: true, // CSS分割有効化

      // モジュールプリロード設定
      modulePreload: {
        polyfill: true,
        resolveDependencies: (filename, deps, { hostId, hostType }) => {
          // 重要なチャンクのみプリロード
          return deps.filter((dep) => dep.includes('vendor-core') || dep.includes('game-core'))
        },
      },
    },

    // パス解決設定（DDD構造対応）
    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src'),
        '@/domain': resolve(process.cwd(), 'src/domain'),
        '@/application': resolve(process.cwd(), 'src/application'),
        '@/infrastructure': resolve(process.cwd(), 'src/infrastructure'),
        '@/presentation': resolve(process.cwd(), 'src/presentation'),
        '@shared': resolve(process.cwd(), 'src/shared'),
        '@/test': resolve(process.cwd(), 'test'),
      },
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],

      // 条件付きエクスポート（環境別）
      conditions: isDev
        ? ['development', 'module', 'import', 'default']
        : ['production', 'module', 'import', 'default'],

      // Nixでのシンボリックリンク対応
      preserveSymlinks: true,
    },

    // プラグイン設定
    plugins: [
      // TypeScript型チェック用プラグインがここに追加される
    ],

    // 依存関係最適化（Effect-TS専用）
    optimizeDeps: {
      // 事前バンドル対象（Effect-TS完全対応）
      include: [
        'effect > effect/Effect',
        'effect > effect/Schema',
        'effect > effect/Context',
        'effect > effect/Match',
        'effect > effect/Data',
        'effect > effect/Layer',
        'effect > effect/Chunk',
        'effect > effect/Option',
        'effect > effect/Either',
        'effect > effect/Array',
        'effect > effect/Record',
      ],
      // 除外対象
      exclude: ['@vite/client', '@vite/env'],
      // ESBuild設定（Node.js 22最適化）
      esbuildOptions: {
        target: 'es2022',
        supported: {
          'top-level-await': true,
          'import-meta': true,
        },
        define: {
          global: 'globalThis', // Node.js互換性
        },
      },
      // 強制最適化（Nix環境での安定性）
      force: false,
    },

    // CSS設定（ゲーム向け最適化）
    css: {
      devSourcemap: isDev,
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: isDev ? '[name]__[local]___[hash:base64:5]' : '[hash:base64:8]',
      },
      transformer: 'lightningcss', // 高速CSS処理
      lightningcss: {
        targets: {
          chrome: 90,
          firefox: 88,
          safari: 14,
        },
      },
    },

    // 環境変数設定（ゲーム用定数）
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __DEV__: isDev,
      __GAME_DEBUG__: isDev,
      __NIX_ENV__: true,
      'process.env.NODE_ENV': JSON.stringify(mode),
      'import.meta.env.SSR': false, // クライアントサイドのみ
    },

    // 静的アセット設定（ゲームリソース）
    assetsInclude: [
      '**/*.gltf', // 3Dモデル
      '**/*.glb', // バイナリ3Dモデル
      '**/*.obj', // OBJモデル
      '**/*.mtl', // マテリアル定義
      '**/*.png', // テクスチャ
      '**/*.jpg', // テクスチャ
      '**/*.ogg', // 音声ファイル
      '**/*.wav', // 音声ファイル
      '**/*.json', // データファイル
    ],

    // プレビューサーバー設定（本番ビルドテスト用）
    preview: {
      port: env.VITE_PREVIEW_PORT ? Number(env.VITE_PREVIEW_PORT) : 4173,
      host: '0.0.0.0',
      strictPort: false,
      cors: true,
    },

    // Nix環境専用設定
    clearScreen: false, // Nix環境でのログ表示維持
    logLevel: isDev ? 'info' : 'warn',
  }
})
```

## 🚀 開発環境別設定

### 開発環境用設定（Nix環境最適化）

```typescript
// vite.config.dev.ts - Nix devenv用最適化設定
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0', // Nix container対応
    strictPort: false, // Nix動的ポート対応
    open: false, // Nixでは自動起動無効

    // Nix環境でのHMR最適化
    hmr: {
      port: 5174,
      overlay: true, // エラー画面オーバーレイ
      clientPort: 5174, // WebSocketポート明示
    },

    // CORS設定（Nix環境用）
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://0.0.0.0:5173'],
      credentials: true,
    },

    // ファイル監視設定（Nix最適化）
    watch: {
      usePolling: false, // Nix inotifyサポート
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },

    // Nix store対応
    fs: {
      allow: ['..', '/nix/store'], // Nix store アクセス許可
      deny: ['.env.local', '.env.*.local'],
    },
  },

  // 開発時のソースマップ（Effect-TS最適化）
  build: {
    sourcemap: true, // Effect-TSデバッグ用
    rollupOptions: {
      output: {
        sourcemapExcludeSources: false, // Effect-TSソース表示
      },
    },
  },

  // Effect-TS開発最適化
  optimizeDeps: {
    include: [
      'effect > effect/Effect',
      'effect > effect/Schema',
      'effect > effect/Context',
      'effect > effect/Match',
      'effect > effect/Data',
    ],
    // Nix環境での安定性重視
    force: false,
  },

  // Nix環境専用設定
  clearScreen: false,
  logLevel: 'info',
})
```

### 本番環境用設定（ゲームパフォーマンス最適化）

```typescript
// vite.config.prod.ts - TypeScript Minecraft本番最適化
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: ['es2022', 'chrome90', 'firefox88', 'safari14'], // モダンブラウザ対応
    minify: 'terser',
    sourcemap: false, // 本番では無効
    reportCompressedSize: false, // ビルド高速化

    // ゲーム用高度な圧縮設定
    terserOptions: {
      compress: {
        // デバッグコード完全除去
        drop_console: true,
        drop_debugger: true,

        // ゲーム最適化
        dead_code: true,
        unused: true,
        passes: 2, // 2パス最適化

        // Effect-TS最適化
        pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.error', 'console.debug', '__DEV__'],
      },
      mangle: {
        // プライベートメンバー短縮化
        properties: {
          regex: /^_/,
        },
        // Safari対応
        safari10: true,
      },
      format: {
        comments: false, // 全コメント除去
        ecma: 2022, // 最新ECMAScript対応
      },
    },

    // ゲーム用バンドル最適化
    rollupOptions: {
      // Web Worker対応
      input: {
        main: 'index.html',
        'chunk-worker': 'src/workers/chunk-worker.ts',
        'physics-worker': 'src/workers/physics-worker.ts',
      },

      output: {
        // ゲームアセット最適化
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',

        // Effect-TS + ゲーム最適化チャンク分割
        manualChunks: (id) => {
          // Effect-TS細分化
          if (id.includes('effect/Schema')) return 'effect-schema'
          if (id.includes('effect/Context')) return 'effect-context'
          if (id.includes('effect/Match')) return 'effect-match'
          if (id.includes('effect/')) return 'effect-core'

          // ゲームエンジン分離
          if (id.includes('three')) return 'three-engine'

          // ゲーム機能別分割
          if (id.includes('/domain/world')) return 'game-world'
          if (id.includes('/domain/player')) return 'game-player'
          if (id.includes('/domain/block')) return 'game-blocks'
          if (id.includes('/domain/inventory')) return 'game-inventory'

          // システム分離
          if (id.includes('/application/systems')) return 'game-systems'
          if (id.includes('/infrastructure/ecs')) return 'ecs-engine'
          if (id.includes('/infrastructure/renderer')) return 'render-engine'

          // UI層
          if (id.includes('/presentation/')) return 'game-ui'

          // 外部ライブラリ
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },

    // ゲームアセット最適化
    assetsInlineLimit: 1024, // 1KB未満のみインライン化
    chunkSizeWarningLimit: 2000, // ゲーム用サイズ制限緩和

    // Web Worker最適化
    rollupOptions: {
      ...rollupOptions,
      external: [],
      plugins: [],
    },
  },

  // Lightning CSS設定（ゲーム用高速化）
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        chrome: 90,
        firefox: 88,
        safari: 14,
      },
      minify: true,
      drafts: {
        customMedia: true,
      },
    },
  },

  // 本番環境専用定義
  define: {
    __GAME_DEBUG__: false,
    __PERFORMANCE_MONITORING__: true,
    __GAME_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
})
```

## ⚡ パフォーマンス最適化

### Effect-TS + Nix環境専用最適化設定

```typescript
// vite.config.performance.ts - Effect-TS + ゲーム最適化
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    // バンドル分析（Nix環境対応）
    process.env.ANALYZE &&
      visualizer({
        filename: 'dist/stats.html',
        open: false, // Nix環境では自動起動無効
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),

  build: {
    // ターゲット環境（ゲーム推奨）
    target: ['es2022', 'chrome90', 'firefox88', 'safari14'],

    // Effect-TS最適化圧縮設定
    minify: 'terser',
    terserOptions: {
      compress: {
        ecma: 2022,
        module: true, // ESモジュール最適化

        // ゲーム用デバッグコード除去
        drop_console: true,
        drop_debugger: true,
        dead_code: true,
        unused: true,

        // Effect-TS特化最適化
        pure_funcs: [
          'console.log',
          'console.info',
          'console.warn',
          // Effect-TS pure functions
          'Effect.log',
          'Effect.logInfo',
          'Effect.logWarning',
          'Schema.decodeUnknown',
          // Note: 'Data.struct' は廃止パターンのため除外
        ],
        pure_getters: true,

        // パフォーマンス最適化
        passes: 2,
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      mangle: {
        safari10: true,
        properties: {
          // Effect-TSプライベートメンバー短縮
          regex: /^_[a-zA-Z]/,
        },
      },
    },

    // Effect-TS + ゲーム専用チャンク戦略
    rollupOptions: {
      output: {
        // 細粒度チャンク分割
        manualChunks: (id) => {
          // Effect-TS細分化（重要度別）
          if (id.includes('effect/Effect')) return 'effect-core'
          if (id.includes('effect/Schema')) return 'effect-schema'
          if (id.includes('effect/Context')) return 'effect-context'
          if (id.includes('effect/Match')) return 'effect-match'
          if (id.includes('effect/Data')) return 'effect-data'
          if (id.includes('effect/Layer')) return 'effect-layer'
          if (id.includes('effect/')) return 'effect-utils'

          // ゲームエンジン分離
          if (id.includes('three/examples/jsm/controls')) return 'three-controls'
          if (id.includes('three/examples/jsm/loaders')) return 'three-loaders'
          if (id.includes('three/examples/jsm')) return 'three-extras'
          if (id.includes('three')) return 'three-core'

          // ゲーム機能別分割（DDD層対応）
          if (id.includes('src/domain/world')) return 'domain-world'
          if (id.includes('src/domain/player')) return 'domain-player'
          if (id.includes('src/domain/block')) return 'domain-block'
          if (id.includes('src/domain/inventory')) return 'domain-inventory'
          if (id.includes('src/domain/')) return 'domain-core'

          if (id.includes('src/application/systems')) return 'app-systems'
          if (id.includes('src/application/')) return 'app-services'

          if (id.includes('src/infrastructure/ecs')) return 'infra-ecs'
          if (id.includes('src/infrastructure/renderer')) return 'infra-render'
          if (id.includes('src/infrastructure/')) return 'infra-core'

          if (id.includes('src/presentation/')) return 'presentation'
          if (id.includes('src/shared/')) return 'shared'

          // ユーティリティライブラリ
          if (id.includes('lodash')) return 'utils-lodash'
          if (id.includes('date-fns')) return 'utils-date'

          // その他外部ライブラリ
          if (id.includes('node_modules')) return 'vendor'
        },

        // ゲーム用アセット最適化
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') ?? []
          const extType = info[info.length - 1]

          // ゲームアセット種別分類
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/woff2?|eot|ttf|otf/i.test(extType)) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          if (/mp3|wav|ogg|m4a/i.test(extType)) {
            return `assets/audio/[name]-[hash][extname]`
          }
          if (/gltf|glb|obj|mtl/i.test(extType)) {
            return `assets/models/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        },
      },
    },

    // ゲーム用最適化設定
    assetsInlineLimit: 512, // 512B未満のみインライン
    chunkSizeWarningLimit: 1500, // チャンクサイズ警告
    reportCompressedSize: false, // Nix高速ビルド

    // Web Worker最適化
    rollupOptions: {
      input: {
        main: 'index.html',
        'worker-chunk': 'src/workers/chunk-worker.ts',
        'worker-physics': 'src/workers/physics-worker.ts',
        'worker-pathfinding': 'src/workers/pathfinding-worker.ts',
      },
    },
  },

  // Nix環境用最適化
  esbuild: {
    target: 'es2022',
    legalComments: 'none',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
})
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. ビルドサイズが大きい

**問題**: バンドルサイズが大きくて読み込みが遅い

**解決策**:

```typescript
// バンドルアナライザーで原因調査
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],

  build: {
    // Tree shaking強化
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 未使用ライブラリの特定と分離
          if (id.includes('unused-heavy-lib')) {
            return 'unused' // 別チャンクに分離
          }
        },
      },
    },
  },
})
```

#### 2. 開発サーバーが遅い

**問題**: HMRが遅い、ページ読み込みに時間がかかる

**解決策**:

```typescript
export default defineConfig({
  server: {
    // ファイル監視最適化
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },

    // 事前ウォームアップ
    warmup: {
      clientFiles: ['./src/main.ts', './src/App.vue'],
    },
  },

  optimizeDeps: {
    // 依存関係の事前バンドル強化
    include: ['effect > effect/Schema', 'three > three/examples/jsm/controls/OrbitControls'],
    // 強制再最適化
    force: true,
  },
})
```

#### 3. Three.js関連のビルドエラー

**問題**: Three.js modules not found, import errors

**解決策**:

```typescript
export default defineConfig({
  resolve: {
    alias: {
      // Three.jsパス解決
      'three/examples/jsm': 'three/examples/jsm',
      three: 'three',
    },
  },

  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls', 'three/examples/jsm/loaders/GLTFLoader'],
    // Three.js ESM対応
    esbuildOptions: {
      supported: {
        'dynamic-import': true,
      },
    },
  },
})
```

## 📚 関連ドキュメント

### 設定ファイル関連

- [TypeScript設定](./typescript-config.md) - TypeScript compilerOptions
- [Vitest設定](./vitest-config.md) - テスト実行環境
- [開発設定](./development-config.md) - 開発効率化
- [ビルド設定](./build-config.md) - 本番ビルド最適化
- [Project設定](./project-config.md) - プロジェクト全体設定

### 外部リファレンス

- [Vite公式ドキュメント](https://vitejs.dev/)
- [Rollup設定オプション](https://rollupjs.org/configuration-options/)
- [Terser圧縮オプション](https://terser.org/docs/api-reference)
- [Lightning CSS設定](https://lightningcss.dev/)

### プロジェクト固有

- [Three.js統合ガイド](../../how-to/development/performance-optimization.md)
- [Effect-TS最適化](../../how-to/development/effect-ts-migration-guide.md)
- [パフォーマンス最適化](../troubleshooting/performance-issues.md)
