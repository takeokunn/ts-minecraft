---
title: "Vite設定 - ビルドツール完全ガイド"
description: "Vite 5.xでのTypeScript Minecraftプロジェクト設定。Three.js統合、Effect-TS最適化、パフォーマンス調整。"
category: "reference"
difficulty: "intermediate"
tags: ["vite", "build-tools", "three.js", "effect-ts", "configuration", "performance"]
prerequisites: ["basic-typescript", "build-tools-basics"]
estimated_reading_time: "15分"
dependencies: ["./typescript-config.md"]
status: "complete"
---

# Vite Configuration

> **Vite設定**: プロジェクトのVite設定完全リファレンス

## 概要

TypeScript MinecraftプロジェクトのVite 5.x設定について詳しく解説します。Three.js統合、Effect-TS最適化、パフォーマンス調整など、実用的な設定例を豊富に提供します。

## 基本設定

### 完全なvite.config.ts設定例

```typescript
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import dns from 'node:dns'

// localhost解決問題の修正（Node.js v17未満）
dns.setDefaultResultOrder('verbatim')

export default defineConfig(({ command, mode }) => {
  // 環境変数の読み込み
  const env = loadEnv(mode, process.cwd(), '')

  const isDev = command === 'serve'
  const isProd = command === 'build' && mode === 'production'

  return {
    // サーバー設定
    server: {
      port: env.VITE_PORT ? Number(env.VITE_PORT) : 3000,
      host: '0.0.0.0', // Docker対応
      strictPort: true, // ポートが使用中の場合エラー
      open: isDev ? '/docs/index.html' : false,
      cors: true,

      // HMR設定（高速リロード）
      hmr: {
        port: 3001,
        overlay: true // エラーオーバーレイ表示
      },

      // プロキシ設定（API統合用）
      proxy: {
        '/api': {
          target: env.API_URL || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('プロキシエラー:', err)
            })
          }
        },
        // WebSocket プロキシ（マルチプレイヤー用）
        '/socket.io': {
          target: 'ws://localhost:3002',
          ws: true,
          rewriteWsOrigin: true
        }
      },

      // パフォーマンス向上：事前ウォームアップ
      warmup: {
        clientFiles: [
          './src/components/**/*.vue',
          './src/utils/big-utils.ts',
          './src/systems/*.ts', // ECSシステム
          './src/renderer/**/*.ts' // Three.js関連
        ],
        ssrFiles: ['./src/server/modules/*.ts']
      }
    },

    // ビルド設定
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDev ? true : false,
      minify: isProd ? 'terser' : false,

      // Terser設定（本番最適化）
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
          pure_funcs: isProd ? ['console.log', 'console.warn'] : []
        },
        mangle: {
          safari10: true // Safari対応
        }
      },

      // チャンク分割（効率的なキャッシュ）
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          worker: resolve(__dirname, 'src/workers/chunk-worker.ts')
        },
        output: {
          // ファイル名設定（キャッシュ最適化）
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',

          // マニュアルチャンク（依存関係別）
          manualChunks: {
            // コア依存関係
            'vendor-core': ['effect'],
            'vendor-3d': ['three'],
            'vendor-utils': ['lodash-es', 'date-fns'],

            // アプリケーション機能別
            'game-core': [
              './src/domain/entities',
              './src/domain/value-objects'
            ],
            'game-systems': [
              './src/application/systems',
              './src/infrastructure/ecs'
            ],
            'game-ui': [
              './src/presentation/components',
              './src/presentation/hooks'
            ]
          }
        }
      },

      // リソース管理
      assetsInlineLimit: 4096, // 4KB未満はインライン化
      cssCodeSplit: true, // CSS分割有効化

      // モジュールプリロード設定
      modulePreload: {
        polyfill: true,
        resolveDependencies: (filename, deps, { hostId, hostType }) => {
          // 重要なチャンクのみプリロード
          return deps.filter(dep =>
            dep.includes('vendor-core') ||
            dep.includes('game-core')
          )
        }
      }
    },

    // パス解決設定
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@/domain': resolve(__dirname, 'src/domain'),
        '@/application': resolve(__dirname, 'src/application'),
        '@/infrastructure': resolve(__dirname, 'src/infrastructure'),
        '@/presentation': resolve(__dirname, 'src/presentation'),
        '@/assets': resolve(__dirname, 'public/assets')
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],

      // 条件付きエクスポート（環境別）
      conditions: isDev
        ? ['module', 'browser', 'development']
        : ['module', 'browser', 'production']
    },

    // プラグイン設定
    plugins: [
      // TypeScript型チェック用プラグインがここに追加される
    ],

    // 依存関係最適化
    optimizeDeps: {
      // 事前バンドル対象
      include: [
        'effect',
        'effect/Schema',
        'effect/Context',
        'effect/Match',
        'three',
        'three/examples/jsm/controls/OrbitControls'
      ],
      // 除外対象
      exclude: [
        '@vite/client',
        '@vite/env'
      ],
      // ESBuild設定
      esbuildOptions: {
        target: 'es2022',
        supported: {
          'top-level-await': true
        }
      }
    },

    // CSS設定
    css: {
      devSourcemap: isDev,
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: isDev
          ? '[name]__[local]___[hash:base64:5]'
          : '[hash:base64:8]'
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`
        }
      }
    },

    // 環境変数設定
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __DEV__: isDev,
      'process.env.NODE_ENV': JSON.stringify(mode)
    },

    // 静的アセット設定
    assetsInclude: [
      '**/*.gltf',
      '**/*.glb',
      '**/*.obj',
      '**/*.mtl'
    ],

    // プレビューサーバー設定（本番ビルドテスト用）
    preview: {
      port: 8080,
      host: true,
      cors: true
    }
  }
})
```

## 🚀 開発環境別設定

### 開発環境用設定（最高の開発体験）

```typescript
// vite.config.dev.ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0', // Docker、VM対応
    strictPort: false, // ポート変更を許可
    open: true, // ブラウザ自動起動

    // 高速HMR設定
    hmr: {
      port: 3001,
      overlay: true, // エラー画面オーバーレイ
      clientPort: 3001 // WebSocketポート明示
    },

    // CORS設定（API統合）
    cors: {
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true
    },

    // ファイル監視設定
    watch: {
      usePolling: true, // Dockerでの安定監視
      interval: 1000
    },

    // ファイルサービング設定
    fs: {
      // プロジェクト外ファイルアクセス許可
      allow: ['..'],
      // 機密ファイル除外
      deny: ['.env*', '**/node_modules/**']
    }
  },

  // 開発時のソースマップ
  build: {
    sourcemap: 'eval-cheap-module-source-map',
    rollupOptions: {
      // 開発用バンドル設定
      output: {
        sourcemapExcludeSources: false
      }
    }
  },

  // ホットリロード最適化
  optimizeDeps: {
    // 開発時の事前バンドル
    include: [
      'effect > effect/Schema',
      'three > three/examples/jsm/controls/OrbitControls'
    ],
    // 強制リビルド（依存関係更新時）
    force: false
  }
})
```

### 本番環境用設定（パフォーマンス最適化）

```typescript
// vite.config.prod.ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'terser',
    sourcemap: false, // 本番では無効

    // 高度な圧縮設定
    terserOptions: {
      compress: {
        // コンソール削除
        drop_console: true,
        drop_debugger: true,

        // 未使用コード除去
        dead_code: true,
        unused: true,

        // 純粋関数呼び出し除去
        pure_funcs: [
          'console.log',
          'console.info',
          'console.warn',
          'console.error'
        ]
      },
      mangle: {
        // 変数名短縮化
        properties: {
          regex: /^_/
        }
      }
    },

    // バンドルサイズ最適化
    rollupOptions: {
      output: {
        // ファイルサイズ制限
        maxParallelFileOps: 5,

        // 効率的なチャンク分割
        manualChunks: (id) => {
          // 大きなライブラリを分離
          if (id.includes('three')) return 'three'
          if (id.includes('effect')) return 'effect'
          if (id.includes('lodash')) return 'utils'

          // ノードモジュールを vendor に
          if (id.includes('node_modules')) {
            return 'vendor'
          }

          // ドメインロジック分離
          if (id.includes('/domain/')) return 'domain'
          if (id.includes('/application/')) return 'application'
        }
      }
    },

    // CSS最適化
    cssMinify: 'lightningcss', // 高速CSS圧縮

    // アセット処理
    assetsInlineLimit: 2048, // 2KB未満インライン化
    chunkSizeWarningLimit: 1000 // チャンクサイズ警告閾値
  },

  // Lightning CSS設定（高速CSS処理）
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        chrome: 90,
        firefox: 88,
        safari: 14
      },
      drafts: {
        customMedia: true
      }
    }
  }
})
```

## ⚡ パフォーマンス最適化

### ビルド最適化の完全設定

```typescript
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    // バンドルサイズ可視化
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true
    })
  ].filter(Boolean),

  build: {
    // ターゲット環境（モダンブラウザ）
    target: ['es2022', 'chrome90', 'firefox88', 'safari14'],

    // 圧縮設定（段階的適用）
    minify: 'terser',
    terserOptions: {
      compress: {
        ecma: 2022,
        drop_console: true,
        drop_debugger: true,
        dead_code: true,
        unused: true,
        pure_funcs: ['console.log', 'console.info', 'console.warn'],
        pure_getters: true
      },
      mangle: {
        safari10: true,
        properties: {
          regex: /^_/
        }
      }
    },

    // 高度なチャンク分割戦略
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('effect/')) return 'effect-core'
          if (id.includes('three')) {
            if (id.includes('examples/jsm')) return 'three-extras'
            return 'three-core'
          }
          if (id.includes('lodash') || id.includes('date-fns')) return 'utils'
          if (id.includes('@/presentation')) return 'ui'
          if (id.includes('@/domain')) return 'domain'
          if (id.includes('node_modules')) return 'vendor'
        }
      }
    }
  }
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
      brotliSize: true
    })
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
        }
      }
    }
  }
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
      ignored: ['**/node_modules/**', '**/dist/**']
    },

    // 事前ウォームアップ
    warmup: {
      clientFiles: ['./src/main.ts', './src/App.vue']
    }
  },

  optimizeDeps: {
    // 依存関係の事前バンドル強化
    include: [
      'effect > effect/Schema',
      'three > three/examples/jsm/controls/OrbitControls'
    ],
    // 強制再最適化
    force: true
  }
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
      'three': 'three'
    }
  },

  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/controls/OrbitControls',
      'three/examples/jsm/loaders/GLTFLoader'
    ],
    // Three.js ESM対応
    esbuildOptions: {
      supported: {
        'dynamic-import': true
      }
    }
  }
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
- [Three.js統合ガイド](../../03-guides/10-threejs-integration.md)
- [Effect-TS最適化](../../03-guides/11-effect-ts-optimization.md)
- [パフォーマンス最適化](../troubleshooting/performance-issues.md)