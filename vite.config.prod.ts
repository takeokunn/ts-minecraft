import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// 本番用の完全最適化設定
export default defineConfig({
  plugins: [tsconfigPaths()],
  
  // 本番ビルド最適化
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false, // 本番では完全にソースマップを削除
    
    // 本番用のTerser設定
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: [
          'console.log',
          'console.info',
          'console.debug',
          'console.warn',
          'console.trace'
        ],
        passes: 3, // 本番では3パスの最適化
        unsafe: true,
        unsafe_comps: true,
        unsafe_Function: true,
        unsafe_math: true,
        unsafe_symbols: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true
      },
      mangle: {
        safari10: true,
        properties: {
          regex: /^_/
        }
      },
      format: {
        comments: false,
        ascii_only: true
      }
    },

    // 本番用のロールアップ設定
    rollupOptions: {
      output: {
        // 本番用のチャンク分割戦略（より細分化）
        manualChunks: (id) => {
          // Effect-TS関連の細分化
          if (id.includes('effect') && !id.includes('@effect/platform')) {
            return 'effect-core'
          }
          if (id.includes('@effect/platform')) {
            return 'effect-platform'
          }
          
          // Three.js関連の細分化
          if (id.includes('three')) {
            return 'three-core'
          }
          if (id.includes('gl-matrix') || id.includes('stats.js')) {
            return 'three-utils'
          }
          
          // ユーティリティライブラリ
          if (id.includes('alea') || id.includes('simplex-noise') || id.includes('uuid')) {
            return 'vendor-utils'
          }
          
          // システム関連の分割
          if (id.includes('/systems/')) {
            return 'game-systems'
          }
          
          // インフラストラクチャの分割
          if (id.includes('/infrastructure/')) {
            return 'infrastructure'
          }
          
          // ワーカー関連
          if (id.includes('/workers/')) {
            return 'workers'
          }
          
          // 大きなnode_modulesを個別のチャンクに
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
        
        // 本番用の命名戦略
        chunkFileNames: 'chunks/[name].[hash].js',
        entryFileNames: '[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || ''
          if (/\.(png|jpe?g|svg|gif|ico|webp|avif)$/i.test(name)) {
            return 'images/[name].[hash][extname]'
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
            return 'fonts/[name].[hash][extname]'
          }
          if (/\.(css)$/i.test(name)) {
            return 'styles/[name].[hash][extname]'
          }
          return 'assets/[name].[hash][extname]'
        }
      }
    },

    // 本番用のチャンクサイズ制限を厳しく
    chunkSizeWarningLimit: 500,
    
    // CSS最適化
    cssCodeSplit: true,
    
    // アセット最適化
    assetsInlineLimit: 2048, // 2KB以下のアセットをインライン化
  },

  // 本番用の依存関係最適化
  optimizeDeps: {
    include: [
      'effect',
      '@effect/platform',
      'three',
      'gl-matrix',
      'stats.js',
      'alea',
      'simplex-noise',
      'uuid'
    ],
    exclude: [],
    esbuildOptions: {
      target: 'esnext',
      drop: ['console', 'debugger']
    }
  },

  // 本番用の環境変数設定
  define: {
    __DEV__: false,
    __PROD__: true,
    __PROFILE__: false,
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    'process.env.NODE_ENV': JSON.stringify('production'),
    // 本番用の機能フラグ
    'process.env.ENABLE_PERFORMANCE_MONITORING': JSON.stringify(true),
    'process.env.ENABLE_ANALYTICS': JSON.stringify(true)
  },

  // 実験的機能（本番用）
  experimental: {
    renderBuiltUrl: (filename) => {
      // CDN URLを返すことも可能
      return `/${filename}`
    }
  },

  // 本番テスト設定（厳密）
  test: {
    include: ['src/__test__/*.spec.ts', 'src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
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
        '**/*.worker.*',
        'scripts/**'
      ],
      // 本番用は厳しい閾値
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      },
      all: true,
      clean: true,
      skipFull: false,
      reportsDirectory: './coverage'
    },
    
    deps: {
      optimizer: {
        web: {
          include: ['effect', '@effect/platform', '@effect/schema', 'three']
        }
      }
    },
    setupFiles: ['./src/test-utils/setup/setup.ts'],
    
    // 本番テストは並列実行
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true
      }
    },
    
    // 本番用レポーター
    reporters: ['verbose', 'json', 'html'],
    
    // CI環境対応
    maxConcurrency: process.env.CI ? 4 : 8,
    
    outputFile: {
      json: './test-results.json',
      html: './test-results.html'
    }
  },
})