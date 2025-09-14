---
title: "開発環境設定 - 統合開発環境ガイド"
description: "TypeScript Minecraft開発環境の完全設定。Vite開発サーバー、デバッグ環境、エディター統合、ホットリロード。"
category: "reference"
difficulty: "intermediate"
tags: ["development", "vite", "debugging", "hot-reload", "editor-integration"]
prerequisites: ["basic-typescript", "vite-basics"]
estimated_reading_time: "15分"
dependencies: ["./vite-config.md"]
status: "complete"
---

# Development Configuration

> **開発設定**: 開発効率最大化のための統合環境構築

## 概要

TypeScript Minecraftプロジェクトの開発環境設定について詳しく解説します。Vite 5.x開発サーバー、デバッグ環境、エディター統合、ホットリロード、開発ツール、パフォーマンス監視など、開発効率を最大化する実用的な設定例を豊富に提供します。

## 開発サーバー設定

### 完全なVite開発サーバー設定

```typescript
// vite.config.dev.ts
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import type { UserConfig } from 'vite'

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDev = mode === 'development'

  return {
    // 開発サーバー設定
    server: {
      // ポート・ホスト設定
      port: Number(env.VITE_DEV_PORT) || 3000,
      host: '0.0.0.0', // Docker、VM、リモート開発対応
      strictPort: false, // ポート変更を許可

      // 自動ブラウザ起動
      open: {
        target: '/docs/index.html',
        app: {
          name: env.BROWSER || 'default'
        }
      },

      // HTTPS設定（本格的な開発環境）
      https: env.HTTPS_ENABLED === 'true' ? {
        key: resolve(__dirname, 'certs/key.pem'),
        cert: resolve(__dirname, 'certs/cert.pem')
      } : false,

      // ホットモジュールリプレースメント（HMR）
      hmr: {
        port: Number(env.VITE_HMR_PORT) || 3001,
        host: 'localhost',
        overlay: true, // エラーオーバーレイ表示
        clientPort: Number(env.VITE_HMR_CLIENT_PORT) || 3001
      },

      // CORS設定（API統合）
      cors: {
        origin: [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://localhost:3000'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
      },

      // プロキシ設定（高度な設定）
      proxy: {
        // REST API プロキシ
        '/api': {
          target: env.API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false, // 開発環境では自己署名証明書を許可
          rewrite: (path) => path.replace(/^\/api/, ''),

          // プロキシ動作監視
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.error('Proxy error:', err)
            })
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`Proxying ${req.method} ${req.url} -> ${options.target}${proxyReq.path}`)
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log(`Proxy response: ${proxyRes.statusCode} ${req.url}`)
            })
          }
        },

        // WebSocket プロキシ（リアルタイム通信）
        '/socket.io': {
          target: env.WS_BASE_URL || 'ws://localhost:3002',
          ws: true,
          changeOrigin: true,
          rewriteWsOrigin: true
        },

        // GraphQL プロキシ
        '/graphql': {
          target: env.GRAPHQL_BASE_URL || 'http://localhost:4000',
          changeOrigin: true
        },

        // 開発用モック API
        '/mock-api': {
          target: 'http://localhost:3003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/mock-api/, '')
        }
      },

      // ファイル監視設定
      watch: {
        // 監視対象
        include: [
          'src/**/*',
          'public/**/*',
          'docs/**/*',
          '*.config.*',
          'package.json'
        ],
        // 監視除外
        exclude: [
          'node_modules/**',
          'dist/**',
          '.git/**',
          'coverage/**'
        ],
        // ポーリング設定（Docker環境）
        usePolling: env.USE_POLLING === 'true',
        interval: 1000
      },

      // ファイルシステムアクセス設定
      fs: {
        // プロジェクト外ファイルアクセス許可
        allow: ['..'],
        // 機密ファイルアクセス拒否
        deny: [
          '.env*',
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
          '**/coverage/**'
        ],
        // 厳格モード
        strict: false // 開発環境では柔軟に
      },

      // パフォーマンス最適化
      warmup: {
        // 重要ファイルの事前ウォームアップ
        clientFiles: [
          './src/main.ts',
          './src/App.vue',
          './src/components/**/*.vue',
          './src/utils/**/*.ts',
          './src/stores/**/*.ts'
        ]
      }
    },

    // 開発時の最適化設定
    optimizeDeps: {
      // 事前バンドル対象（開発効率化）
      include: [
        // Effect-TS
        'effect',
        'effect/Schema',
        'effect/Context',
        'effect/Layer',
        'effect/Match',
        '@effect/schema',

        // Three.js
        'three',
        'three/examples/jsm/controls/OrbitControls',
        'three/examples/jsm/loaders/GLTFLoader',
        'three/examples/jsm/loaders/TextureLoader',

        // ユーティリティ
        'lodash-es',
        'date-fns',
        'uuid',
        'alea'
      ],

      // バンドル除外（開発時の柔軟性）
      exclude: [
        '@vite/client',
        '@vite/env'
      ],

      // ESBuild設定（開発時）
      esbuildOptions: {
        target: 'es2022',
        keepNames: true, // 関数名保持（デバッグ用）
        sourcemap: 'inline',
        define: {
          __DEV__: 'true',
          __PROD__: 'false'
        }
      },

      // 強制リビルド設定
      force: env.FORCE_OPTIMIZE === 'true'
    }
  }
})
```

## 🛠️ デバッグ設定

### VSCode統合デバッグ設定

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "TypeScript Minecraft Debug",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "args": [],
      "runtimeArgs": [
        "--loader", "tsx/esm"
      ],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "*"
      },
      "sourceMaps": true,
      "outFiles": [
        "${workspaceFolder}/dist/**/*.js"
      ],
      "skipFiles": [
        "<node_internals>/**",
        "node_modules/**"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ]
    },
    {
      "name": "Vite Dev Server Debug",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vite/bin/vite.js",
      "args": ["dev", "--debug"],
      "cwd": "${workspaceFolder}",
      "env": {
        "DEBUG": "vite:*",
        "NODE_ENV": "development"
      },
      "sourceMaps": true,
      "console": "integratedTerminal"
    },
    {
      "name": "Vitest Debug",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${file}", "--inspect-brk"],
      "cwd": "${workspaceFolder}",
      "sourceMaps": true,
      "console": "integratedTerminal"
    },
    {
      "name": "Attach to Chrome",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/src",
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "webpack:///./src/*": "${workspaceFolder}/src/*"
      }
    }
  ]
}
```

### ブラウザデバッグ設定

```typescript
// src/debug/browser-debug.ts
interface DebugConfig {
  enableSourceMaps: boolean
  enablePerformanceMonitoring: boolean
  enableNetworkLogging: boolean
  enableThreeJSStats: boolean
  enableEffectTracing: boolean
}

export const createDebugConfig = (): DebugConfig => ({
  enableSourceMaps: import.meta.env.DEV,
  enablePerformanceMonitoring: true,
  enableNetworkLogging: import.meta.env.VITE_DEBUG_NETWORK === 'true',
  enableThreeJSStats: import.meta.env.VITE_DEBUG_THREEJS === 'true',
  enableEffectTracing: import.meta.env.VITE_DEBUG_EFFECT === 'true'
})

// ブラウザデバッグヘルパー
export const setupBrowserDebug = (config: DebugConfig) => {
  if (!import.meta.env.DEV) return

  // Performance Observer設定
  if (config.enablePerformanceMonitoring) {
    const perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.duration > 100) { // 100ms以上の操作を警告
          console.warn(`Slow operation detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`)
        }
      })
    })
    perfObserver.observe({ entryTypes: ['function', 'navigation', 'resource'] })
  }

  // ネットワークログ
  if (config.enableNetworkLogging) {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const start = performance.now()
      console.log('🌐 Fetch Request:', args[0])
      const response = await originalFetch(...args)
      const duration = performance.now() - start
      console.log(`🌐 Fetch Response: ${response.status} (${duration.toFixed(2)}ms)`)
      return response
    }
  }

  // Three.js統計情報
  if (config.enableThreeJSStats && window.Stats) {
    const stats = new window.Stats()
    stats.showPanel(0) // FPS
    document.body.appendChild(stats.dom)

    function animate() {
      stats.begin()
      // レンダリングループ
      stats.end()
      requestAnimationFrame(animate)
    }
    animate()
  }

  // グローバルデバッグヘルパー
  if (typeof window !== 'undefined') {
    (window as any).__DEBUG__ = {
      config,
      clearCache: () => {
        localStorage.clear()
        sessionStorage.clear()
        console.log('🧹 Cache cleared')
      },
      enableVerboseLogging: () => {
        localStorage.setItem('debug', '*')
        console.log('🔍 Verbose logging enabled')
      },
      performance: () => performance.getEntriesByType('navigation')[0]
    }
  }
}
```

### Node.js デバッグ設定

```typescript
// src/debug/node-debug.ts
import { createWriteStream } from 'fs'
import { join } from 'path'

interface NodeDebugConfig {
  enableInspector: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  logToFile: boolean
  traceUnhandledRejections: boolean
}

export const setupNodeDebug = (config: NodeDebugConfig) => {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') return

  // インスペクター有効化
  if (config.enableInspector && !process.env.NODE_OPTIONS?.includes('inspect')) {
    try {
      const inspector = require('inspector')
      if (!inspector.url()) {
        inspector.open(9229, '0.0.0.0', true)
        console.log('🔍 Node.js Inspector enabled on port 9229')
      }
    } catch (error) {
      console.warn('Failed to enable inspector:', error)
    }
  }

  // ログファイル設定
  if (config.logToFile) {
    const logPath = join(process.cwd(), 'logs', 'debug.log')
    const logStream = createWriteStream(logPath, { flags: 'a' })

    const originalConsoleLog = console.log
    console.log = (...args) => {
      originalConsoleLog(...args)
      logStream.write(`${new Date().toISOString()} [LOG] ${args.join(' ')}\n`)
    }
  }

  // 未処理Promise拒否の追跡
  if (config.traceUnhandledRejections) {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason)
      console.trace('Stack trace:')
    })

    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error)
      console.trace('Stack trace:')
      // 開発環境では終了しない
      if (process.env.NODE_ENV !== 'development') {
        process.exit(1)
      }
    })
  }
}
```

## 🏗️ 開発環境別設定

### ローカル開発設定

```typescript
// config/local-development.ts
export const localDevelopmentConfig = {
  // 開発サーバー
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: true,
    https: false
  },

  // ホットリロード
  hmr: {
    enabled: true,
    overlay: true,
    clientPort: 3001
  },

  // デバッグ
  debug: {
    sourceMap: 'eval-cheap-module-source-map',
    enableConsole: true,
    enableDebugger: true,
    verboseLogging: true
  },

  // パフォーマンス
  performance: {
    bundleAnalyzer: false,
    enableProfiling: true,
    optimizeChunks: false // 開発速度優先
  },

  // Three.js開発設定
  threejs: {
    enableStats: true,
    enableAxesHelper: true,
    enableGridHelper: true,
    shadowMapType: 'BasicShadowMap', // 軽量版
    enableWireframe: true,
    enableOrbitControls: true
  },

  // Effect-TS開発設定
  effectTS: {
    enableTracing: true,
    logLevel: 'Debug',
    enableFiberDump: true,
    enableMetrics: true
  },

  // Mock設定
  mocks: {
    enabled: true,
    apiDelay: 100, // 100ms遅延
    errorRate: 0.05, // 5%エラー率
    cacheEnabled: false
  },

  // 自動再読み込み設定
  autoReload: {
    enabled: true,
    watchFiles: ['src/**/*', 'public/**/*'],
    ignoreFiles: ['**/*.test.*', '**/node_modules/**']
  }
}
```

### Docker開発設定

```typescript
// config/docker-development.ts
export const dockerDevelopmentConfig = {
  server: {
    host: '0.0.0.0', // Docker必須
    port: 3000,
    watch: {
      usePolling: true, // Docker Volume対応
      interval: 1000,
      binaryInterval: 3000
    }
  },

  // Docker特有の設定
  docker: {
    volumeMount: '/app',
    nodeModulesCache: '/app/node_modules',
    enableLayerCaching: true
  },

  // ネットワーク設定
  network: {
    containerPort: 3000,
    hostPort: 3000,
    hmrPort: 3001
  },

  // パフォーマンス最適化
  performance: {
    // Docker環境でのメモリ制限対応
    maxMemory: '2g',
    enableCaching: true,
    parallelism: 2 // Docker環境では控えめに
  }
}
```

### Remote Development設定（SSH/Codespaces）

```typescript
// config/remote-development.ts
export const remoteDevelopmentConfig = {
  server: {
    host: '0.0.0.0',
    port: 3000,
    // リモート環境での最適化
    hmr: {
      port: 3001,
      host: '0.0.0.0'
    }
  },

  // リモート開発最適化
  remote: {
    // 帯域幅制限対応
    compressAssets: true,
    enableGzip: true,

    // レイテンシー対応
    batchUpdates: true,
    debounceDelay: 300,

    // セキュリティ設定
    enableHttps: true,
    corsOrigins: ['*.github.dev', '*.codespaces.new']
  },

  // 同期設定
  sync: {
    ignorePatterns: ['node_modules', 'dist', '.git'],
    enableBackup: true,
    backupInterval: 300000 // 5分
  }
}
```

## 🚀 開発ツール統合

### エディター設定（VSCode）

```json
// .vscode/settings.json
{
  // TypeScript設定
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.preferences.includePackageJsonAutoImports": "auto",

  // コード整形設定
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.oxlint": true,
    "source.organizeImports": true,
    "source.addMissingImports": true
  },

  // Three.js設定
  "files.associations": {
    "*.vert": "glsl",
    "*.frag": "glsl",
    "*.geom": "glsl",
    "*.comp": "glsl"
  },

  // Effect-TS設定
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.completeFunctionCalls": true,

  // 開発効率化
  "editor.suggestSelection": "first",
  "editor.tabCompletion": "on",
  "editor.quickSuggestions": {
    "strings": true
  },

  // ファイル監視設定
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/.git/**": true,
    "**/coverage/**": true
  },

  // Vite統合
  "vite.devCommand": "pnpm dev",
  "vite.buildCommand": "pnpm build"
}
```

### 拡張機能設定

```json
// .vscode/extensions.json
{
  "recommendations": [
    // TypeScript
    "ms-vscode.vscode-typescript-next",

    // Vite
    "antfu.vite",

    // リント・フォーマット
    "oxc-project.oxc-vscode",
    "esbenp.prettier-vscode",

    // Three.js
    "slevesque.shader",
    "raczzalan.webgl-glsl-editor",

    // デバッグ
    "ms-vscode.js-debug-nightly",

    // Git
    "eamodio.gitlens",

    // ユーティリティ
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

### タスク自動化

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Dev Server",
      "type": "npm",
      "script": "dev",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      },
      "isBackground": true,
      "runOptions": {
        "runOn": "folderOpen"
      },
      "problemMatcher": [
        {
          "pattern": [
            {
              "regexp": "^(.*):(\\d+):(\\d+)\\s+(error|warning|info)\\s+(.*)\\s\\s+(.*)$",
              "file": 1,
              "line": 2,
              "column": 3,
              "severity": 4,
              "message": 5,
              "code": 6
            }
          ],
          "background": {
            "activeOnStart": true,
            "beginsPattern": "^.*Local:.*$",
            "endsPattern": "^.*ready in.*$"
          }
        }
      ]
    },
    {
      "label": "Type Check",
      "type": "npm",
      "script": "type-check",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "silent",
        "focus": false,
        "panel": "shared"
      }
    },
    {
      "label": "Test Watch",
      "type": "npm",
      "script": "test:watch",
      "group": "test",
      "isBackground": true,
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ]
}
```

## 🔧 開発ワークフロー設定

### Git Hooks開発用設定

```bash
#!/usr/bin/env sh
# .husky/pre-commit（開発最適化版）
. "$(dirname -- "$0")/_/husky.sh"

# 高速リント（変更ファイルのみ）
npx lint-staged

# 段階的型チェック
if git diff --cached --name-only | grep -q '\.tsx\?$'; then
  echo "Running type check on staged TypeScript files..."
  npx tsc --noEmit --incremental
fi

# テスト（関連ファイルのみ）
if [ "$SKIP_TESTS" != "true" ]; then
  echo "Running tests for changed files..."
  pnpm test:related
fi
```

### 開発用スクリプト

```json
// package.json（開発用スクリプト）
{
  "scripts": {
    "dev": "vite dev --config vite.config.dev.ts",
    "dev:debug": "DEBUG=vite:* pnpm dev",
    "dev:https": "HTTPS_ENABLED=true pnpm dev",
    "dev:docker": "docker-compose -f docker-compose.dev.yml up",
    "dev:clean": "rm -rf node_modules/.vite && pnpm dev",

    "debug:inspect": "node --inspect-brk ./node_modules/vite/bin/vite.js dev",
    "debug:chrome": "node --inspect=0.0.0.0:9229 ./node_modules/vite/bin/vite.js dev",

    "type-check:watch": "tsc --noEmit --watch",
    "lint:watch": "nodemon --watch src --ext ts,tsx --exec 'oxlint src'",

    "test:dev": "vitest --config vitest.config.dev.ts",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:related": "vitest related",

    "logs:clear": "rm -rf logs && mkdir logs",
    "cache:clear": "rm -rf node_modules/.vite node_modules/.cache .tsbuildinfo",

    "deps:check": "npm-check-updates --interactive",
    "deps:audit": "pnpm audit --audit-level moderate"
  }
}
```

## 📊 開発環境監視

### パフォーマンス監視設定

```typescript
// src/dev/performance-monitor.ts
interface DevPerformanceMetrics {
  bundleSize: number
  buildTime: number
  hmrUpdateTime: number
  memoryUsage: NodeJS.MemoryUsage
  renderFps: number
}

export class DevelopmentPerformanceMonitor {
  private metrics: DevPerformanceMetrics = {
    bundleSize: 0,
    buildTime: 0,
    hmrUpdateTime: 0,
    memoryUsage: process.memoryUsage(),
    renderFps: 0
  }

  private fpsCounter = 0
  private lastFpsTime = performance.now()

  startMonitoring(): void {
    if (!import.meta.env.DEV) return

    // メモリ使用量監視
    setInterval(() => {
      this.metrics.memoryUsage = process.memoryUsage()

      // メモリ使用量警告（開発環境）
      const usedMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024
      if (usedMB > 500) { // 500MB超過で警告
        console.warn(`🚨 High memory usage: ${usedMB.toFixed(2)}MB`)
      }
    }, 5000)

    // HMR更新時間測定
    if (import.meta.hot) {
      const hmrStart = performance.now()
      import.meta.hot.on('vite:afterUpdate', () => {
        this.metrics.hmrUpdateTime = performance.now() - hmrStart
        console.log(`⚡ HMR Update: ${this.metrics.hmrUpdateTime.toFixed(2)}ms`)
      })
    }

    // FPS監視（Three.js）
    this.startFpsMonitoring()
  }

  private startFpsMonitoring(): void {
    const measureFps = () => {
      this.fpsCounter++
      const currentTime = performance.now()

      if (currentTime - this.lastFpsTime >= 1000) {
        this.metrics.renderFps = this.fpsCounter

        // FPS警告
        if (this.metrics.renderFps < 30) {
          console.warn(`🎮 Low FPS detected: ${this.metrics.renderFps}fps`)
        }

        this.fpsCounter = 0
        this.lastFpsTime = currentTime
      }

      requestAnimationFrame(measureFps)
    }

    measureFps()
  }

  getMetrics(): DevPerformanceMetrics {
    return { ...this.metrics }
  }

  logMetrics(): void {
    console.group('📊 Development Metrics')
    console.log(`Bundle Size: ${this.metrics.bundleSize} bytes`)
    console.log(`Build Time: ${this.metrics.buildTime}ms`)
    console.log(`HMR Update: ${this.metrics.hmrUpdateTime}ms`)
    console.log(`Memory Usage: ${(this.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`)
    console.log(`Render FPS: ${this.metrics.renderFps}fps`)
    console.groupEnd()
  }
}

// グローバル監視開始
if (import.meta.env.DEV) {
  const monitor = new DevelopmentPerformanceMonitor()
  monitor.startMonitoring()

  // グローバルアクセス
  ;(window as any).__DEV_MONITOR__ = monitor
}
```

## 🛠️ トラブルシューティング

### よくある開発環境問題と解決法

#### 1. HMRが動作しない

**症状**: ファイル変更がブラウザに反映されない

**解決策**:
```bash
# 1. Viteキャッシュクリア
rm -rf node_modules/.vite
pnpm dev

# 2. ブラウザキャッシュクリア（開発者ツール）
# Ctrl+Shift+R (Windows/Linux) または Cmd+Shift+R (Mac)

# 3. ファイルウォッチャー制限確認（Linux）
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf

# 4. ポーリング有効化
USE_POLLING=true pnpm dev
```

#### 2. 開発サーバーが遅い

**症状**: サーバー起動やページ読み込みが遅い

**解決策**:
```typescript
// vite.config.dev.ts最適化
export default defineConfig({
  server: {
    warmup: {
      clientFiles: ['./src/main.ts', './src/App.vue']
    }
  },
  optimizeDeps: {
    include: ['effect', 'three'],
    force: true // 初回のみ
  }
})
```

#### 3. TypeScript型エラーが解決しない

**症状**: 開発環境で型エラーが発生し続ける

**解決策**:
```bash
# TypeScriptサーバー再起動（VSCode）
# Ctrl+Shift+P → "TypeScript: Restart TS Server"

# または
pnpm tsc --build --clean
rm -rf .tsbuildinfo
pnpm type-check
```

#### 4. Docker開発環境でのパフォーマンス問題

**症状**: Docker環境でのファイル監視やHMRが遅い

**解決策**:
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  app:
    volumes:
      # node_modulesをボリュームマウント
      - node_modules:/app/node_modules
    environment:
      - USE_POLLING=true
      - WATCHPACK_POLLING=true
```

## 📚 関連ドキュメント

### 設定ファイル関連
- [Vite設定](./vite-config.md) - Vite開発・ビルド設定詳細
- [TypeScript設定](./typescript-config.md) - TypeScript compilerOptions
- [Project設定](./project-config.md) - プロジェクト全体設定
- [Build設定](./build-config.md) - ビルドパイプライン

### 外部リファレンス
- [Vite Dev Server](https://vitejs.dev/config/server-options.html)
- [VSCode TypeScript](https://code.visualstudio.com/docs/languages/typescript)
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools)
- [Node.js Inspector](https://nodejs.org/en/docs/guides/debugging-getting-started/)

### プロジェクト固有
- [デバッグガイド](../troubleshooting/debugging-guide.md)
- [パフォーマンス最適化](../troubleshooting/performance-issues.md)
- [開発ガイド](../../03-guides/01-development-setup.md)