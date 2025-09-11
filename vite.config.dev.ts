import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// 開発用の軽量設定 - パフォーマンス重視
export default defineConfig({
  plugins: [tsconfigPaths()],
  
  // 開発サーバー設定
  server: {
    port: 3000,
    host: true,
    open: true,
    hmr: {
      overlay: true,
      port: 3001
    },
    // 開発時のファイル監視最適化
    watch: {
      usePolling: false,
      interval: 100,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**']
    },
    // 開発時のミドルウェア最適化
    middlewareMode: false,
    fs: {
      strict: false
    }
  },

  // 開発用環境変数
  define: {
    __DEV__: true,
    __PROD__: false,
    __PROFILE__: false,
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0-dev'),
    'process.env.NODE_ENV': JSON.stringify('development')
  },

  // 開発ビルド設定（最速ビルド重視）
  build: {
    target: 'esnext',
    minify: false,
    sourcemap: 'inline',
    
    rollupOptions: {
      // 開発時は tree shaking を無効化（高速化）
      treeshake: false,
      
      output: {
        // 開発時は単純な命名（ハッシュなし）
        chunkFileNames: 'chunks/[name].js',
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
        
        // 開発時は単純なチャンク分割
        manualChunks: {
          'vendor': ['effect', '@effect/platform', '@effect/schema'],
          'three': ['three', 'gl-matrix', 'stats.js'],
          'utils': ['alea', 'simplex-noise', 'uuid']
        }
      }
    },
    
    // 開発時はチャンクサイズ警告を緩和
    chunkSizeWarningLimit: 2000,
    
    // 開発時はCSS分割を無効化（高速化）
    cssCodeSplit: false,
    
    // アセットインライン化制限を大きく
    assetsInlineLimit: 8192
  },

  // 開発時の依存関係最適化（高速起動重視）
  optimizeDeps: {
    include: [
      'effect',
      '@effect/platform',
      '@effect/schema',
      'three',
      'gl-matrix',
      'stats.js',
      'alea',
      'simplex-noise',
      'uuid'
    ],
    exclude: ['fsevents'],
    esbuildOptions: {
      target: 'esnext',
      // 開発時は最小限の最適化
      minifyIdentifiers: false,
      minifySyntax: false,
      minifyWhitespace: false
    },
    // 開発時は強制リビルドしない
    force: false
  },

  // 開発専用のテスト設定（高速実行重視）
  test: {
    include: ['src/__test__/*.spec.ts', 'src/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    testTimeout: 5000,
    hookTimeout: 5000,
    
    // 開発時は最小限のカバレッジ
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: [
        'src/index.ts',
        'vite.config*.ts',
        'src/@types/*',
        'src/test-utils/*',
        '**/*.d.ts',
        'dist/',
        'coverage/',
        'node_modules/',
        '**/*.config.*',
        '**/*.worker.*'
      ],
      // 開発時は低い閾値
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50
        }
      }
    },
    
    deps: {
      optimizer: {
        web: {
          include: ['effect', '@effect/platform', '@effect/schema', 'three']
        }
      }
    },
    setupFiles: ['./src/test-utils/setup/setup.ts'],
    
    // 開発時は単一スレッド（デバッグしやすい）
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    
    // 開発時は簡潔なレポーター
    reporters: ['basic'],
    
    // ファイル変更時の自動再実行
    watch: true,
    
    // 開発時は並列実行数を制限
    maxConcurrency: 2
  }
})