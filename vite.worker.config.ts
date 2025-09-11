import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// Worker専用の最適化設定 - 高性能かつ軽量化
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  
  return {
    plugins: [tsconfigPaths()],
    
    // Worker用環境変数
    define: {
      __DEV__: !isProd,
      __PROD__: isProd,
      __WORKER__: true,
      'process.env.NODE_ENV': JSON.stringify(mode || 'production')
    },
    
    build: {
      target: 'esnext',
      minify: isProd ? 'terser' : false,
      sourcemap: isProd ? false : 'inline',
      
      // Worker用のロールアップ設定
      rollupOptions: {
        input: {
          'terrain-worker': 'src/workers/terrain-generation.worker.ts',
          'physics-worker': 'src/workers/physics.worker.ts', 
          'computation-worker': 'src/workers/computation.worker.ts'
        },
        
        // Worker用の tree shaking 最適化
        treeshake: isProd ? {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
          unknownGlobalSideEffects: false
        } : true,
        
        output: {
          dir: 'dist/workers',
          format: 'es',
          chunkFileNames: isProd ? '[name].[hash].js' : '[name].js',
          entryFileNames: isProd ? '[name].[hash].js' : '[name].js',
          
          // Worker用チャンク分割戦略
          manualChunks: isProd ? (id) => {
            // 共通ライブラリを分離
            if (id.includes('effect')) {
              return 'worker-effect'
            }
            if (id.includes('three') || id.includes('gl-matrix')) {
              return 'worker-three'
            }
            if (id.includes('alea') || id.includes('simplex-noise')) {
              return 'worker-algorithms'
            }
            
            // Worker間の共通コード
            if (id.includes('/core/') && !id.includes('.worker')) {
              return 'worker-core'
            }
            
            return undefined
          } : undefined,
          
          // 実験的最適化
          ...(isProd && {
            generatedCode: {
              preset: 'es2015',
              arrowFunctions: true,
              constBindings: true,
              objectShorthand: true
            },
            hoistTransitiveImports: false
          })
        },
        
        // 外部依存関係の扱い
        external: isProd ? [] : ['fs', 'path', 'url']
      },
      
      // Worker用のTerser最適化
      terserOptions: isProd ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 3,
          unsafe: true,
          unsafe_comps: true,
          unsafe_Function: true,
          unsafe_math: true,
          unsafe_methods: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
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
      
      // Worker用のチャンクサイズ制限
      chunkSizeWarningLimit: isProd ? 200 : 1000,
      
      // アセット最適化（Worker用）
      assetsInlineLimit: isProd ? 1024 : 4096,
      
      // 実験的最適化
      ...(isProd && {
        reportCompressedSize: false,
        write: true,
        emptyOutDir: false // メインビルドと競合しないよう
      })
    },

    // Worker用の依存関係最適化
    optimizeDeps: {
      include: [
        'effect',
        '@effect/platform',
        'three',
        'gl-matrix',
        'alea',
        'simplex-noise'
      ],
      exclude: ['fsevents'],
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
    
    // Worker用の実験的機能
    experimental: {
      renderBuiltUrl: isProd ? (filename) => {
        return `/workers/${filename}`
      } : undefined
    }
  }
})