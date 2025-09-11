import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const isProd = mode === 'production'
  const isProfile = mode === 'profile'

  return {
    plugins: [tsconfigPaths()],
    
    // 開発サーバー設定
    server: {
      host: true,
      port: 3000,
      hmr: {
        overlay: true,
        port: 3001
      },
      // ファイル監視設定（開発ツール用）
      watch: {
        usePolling: false,
        interval: 100,
        ignored: ['**/node_modules/**', '**/.git/**']
      }
    },
    
    // 環境変数定義
    define: {
      __DEV__: isDev,
      __PROD__: isProd,
      __PROFILE__: isProfile,
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      'process.env.NODE_ENV': JSON.stringify(mode)
    },

    // ビルド最適化設定
    build: {
      target: 'esnext',
      minify: isProd ? 'terser' : false,
      sourcemap: isDev ? 'inline' : isProd ? false : 'hidden',
      
      // Terser最適化設定（本番のみ）
      terserOptions: isProd ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
          passes: 3,
          unsafe: true,
          unsafe_comps: true,
          unsafe_Function: true,
          unsafe_math: true,
          unsafe_methods: true,
          unsafe_proto: true,
          unsafe_regexp: true,
          toplevel: true,
          keep_infinity: true,
          reduce_vars: true,
          collapse_vars: true,
          join_vars: true,
          sequences: true,
          properties: true,
          dead_code: true,
          conditionals: true,
          booleans: true,
          unused: true,
          if_return: true,
          evaluate: true,
          loops: true
        },
        mangle: {
          safari10: true,
          toplevel: true,
          properties: {
            regex: /^_/
          }
        },
        format: {
          comments: false,
          ascii_only: true
        }
      } : undefined,

      // ロールアップ最適化オプション
      rollupOptions: {
        // Tree shaking 最適化
        treeshake: isProd ? {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
          unknownGlobalSideEffects: false
        } : true,
        
        output: {
          // 高度なチャンク分割戦略
          manualChunks: isProd ? (id) => {
            // Core dependencies
            if (id.includes('effect') && !id.includes('@effect/platform') && !id.includes('@effect/schema')) {
              return 'effect-core'
            }
            if (id.includes('@effect/platform')) {
              return 'effect-platform'
            }
            if (id.includes('@effect/schema')) {
              return 'effect-schema'
            }
            
            // Three.js ecosystem
            if (id.includes('three') && !id.includes('three-')) {
              return 'three-core'
            }
            if (id.includes('gl-matrix') || id.includes('stats.js')) {
              return 'three-utils'
            }
            
            // Utilities and algorithms
            if (id.includes('alea') || id.includes('simplex-noise')) {
              return 'algorithms'
            }
            if (id.includes('uuid')) {
              return 'utilities'
            }
            
            // Game systems
            if (id.includes('/systems/')) {
              if (id.includes('/physics/') || id.includes('/collision')) {
                return 'systems-physics'
              }
              if (id.includes('/rendering/') || id.includes('/camera')) {
                return 'systems-rendering'
              }
              if (id.includes('/input/') || id.includes('/player')) {
                return 'systems-input'
              }
              return 'systems-core'
            }
            
            // Core modules
            if (id.includes('/core/')) {
              if (id.includes('/components/')) {
                return 'core-components'
              }
              if (id.includes('/entities/')) {
                return 'core-entities'
              }
              if (id.includes('/performance/')) {
                return 'core-performance'
              }
              if (id.includes('/queries/')) {
                return 'core-queries'
              }
              return 'core-base'
            }
            
            // Infrastructure
            if (id.includes('/infrastructure/')) {
              return 'infrastructure'
            }
            
            // Workers
            if (id.includes('/workers/') || id.includes('.worker')) {
              return 'workers'
            }
            
            // Services
            if (id.includes('/services/')) {
              return 'services'
            }
            
            // Large node_modules
            if (id.includes('node_modules')) {
              return 'vendor'
            }
            
            // Default fallback
            return undefined
          } : {
            // Development: simpler chunking
            'effect-core': ['effect', '@effect/platform', '@effect/schema'],
            'three-core': ['three'],
            'three-utils': ['gl-matrix', 'stats.js'],
            'vendor-utils': ['alea', 'simplex-noise', 'uuid']
          },
          
          // チャンク命名戦略
          chunkFileNames: isProd 
            ? 'chunks/[name].[hash].js'
            : 'chunks/[name].js',
          entryFileNames: isProd 
            ? '[name].[hash].js' 
            : '[name].js',
          
          // アセット命名戦略
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || ''
            const hash = isProd ? '.[hash]' : ''
            
            if (/\.(png|jpe?g|svg|gif|ico|webp|avif)$/i.test(name)) {
              return `images/[name]${hash}[extname]`
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
              return `fonts/[name]${hash}[extname]`
            }
            if (/\.(css)$/i.test(name)) {
              return `styles/[name]${hash}[extname]`
            }
            return `assets/[name]${hash}[extname]`
          },
          
          // 実験的な最適化
          ...(isProd && {
            experimentalMinChunkSize: 20000,
            hoistTransitiveImports: false,
            generatedCode: {
              preset: 'es2015',
              arrowFunctions: true,
              constBindings: true,
              objectShorthand: true
            }
          })
        }
      },

      // チャンクサイズ制限
      chunkSizeWarningLimit: isProd ? 500 : 1000,
      
      // CSS最適化
      cssCodeSplit: true,
      cssMinify: isProd,
      
      // アセット最適化
      assetsInlineLimit: isProd ? 2048 : 4096,
      
      // 実験的最適化
      ...(isProd && {
        reportCompressedSize: false,
        write: true,
        emptyOutDir: true
      })
    },

    // 依存関係の最適化
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
      exclude: isDev ? [] : ['fsevents'],
      esbuildOptions: {
        target: 'esnext',
        ...(isProd && {
          drop: ['console', 'debugger'],
          minifyIdentifiers: true,
          minifySyntax: true,
          minifyWhitespace: true
        })
      },
      force: isProd
    },

    // 実験的機能
    experimental: isProd ? {
      renderBuiltUrl: (filename: string) => {
        return `/${filename}`
      }
    } : {},

    // テスト設定（CI/CD最適化版）
    test: {
      include: ['src/__test__/*.spec.ts', 'src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
      environment: 'jsdom',
      globals: true,
      testTimeout: 10000,
      hookTimeout: 10000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
        exclude: [
        'src/index.ts', 
        'vite.config*.ts', 
        'src/@types/*', 
        'src/systems/index.ts', 
        'test/', 
        'src/dev-tools/*',
        'src/test-utils/*',
        '**/*.d.ts',
        'dist/',
        'coverage/',
        'node_modules/',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        '**/test/**',
        '**/__test__/**',
        '**/*.mock.*',
        '**/*.worker.*'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      all: true,
      clean: true,
      skipFull: false,
      reportsDirectory: './coverage',
      },
      deps: {
        optimizer: {
          web: {
            include: ['effect', '@effect/platform', '@effect/schema', 'three']
          },
        },
      },
      setupFiles: ['./src/test-utils/setup/setup.ts'],
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          useAtomics: true
        }
      },
      // CI環境での並列実行設定
      maxConcurrency: process.env.CI ? 4 : 1,
      // リポーターの設定
      reporters: process.env.CI 
        ? ['verbose', 'json', 'junit']
        : ['verbose'],
      outputFile: {
        json: './test-results.json',
        junit: './test-results.xml'
      }
    }
  }
})
