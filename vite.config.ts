import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import dns from 'node:dns'

dns.setDefaultResultOrder('verbatim')

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDev = command === 'serve'
  const isProd = command === 'build' && mode === 'production'

  return {
    server: {
      fs: {
        strict: true,
        allow: ['..'],
        deny: ['node_modules/.vite', 'test'],
      },
      port: env.VITE_PORT ? Number(env.VITE_PORT) : 5173,
      host: '0.0.0.0',
      strictPort: false,
      open: isDev,
      cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        credentials: true,
      },
      hmr: {
        port: env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : 5174,
        overlay: true,
        clientPort: env.VITE_HMR_CLIENT_PORT ? Number(env.VITE_HMR_CLIENT_PORT) : 5174,
      },
      proxy: isDev
        ? {
            '/api': {
              target: env.API_URL || 'http://localhost:8080',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
              configure: (proxy, _options) => {
                proxy.on('error', (err, _req, _res) => {
                  console.log('proxy error:', err)
                })
              },
            },
            '/socket.io': {
              target: 'ws://localhost:3002',
              ws: true,
              rewriteWsOrigin: true,
            },
          }
        : undefined,
      warmup: isDev
        ? {
            clientFiles: [
              './src/domain/**/*.ts',
              './src/application/**/*.ts',
              './src/infrastructure/**/*.ts',
              './src/presentation/**/*.ts',
              './src/shared/**/*.ts',
            ],
            ssrFiles: [],
          }
        : undefined,
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDev,
      minify: isProd ? 'terser' : false,
      reportCompressedSize: false,
      terserOptions: isProd
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.warn', 'console.info'],
              passes: 2,
            },
            mangle: {
              safari10: true,
              properties: {
                regex: /^_/,
              },
            },
            format: {
              comments: false,
            },
          }
        : undefined,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks: (id) => {
            if (id.includes('test')) return null
            if (id.includes('effect/')) {
              if (id.includes('Schema')) return 'effect-schema'
              if (id.includes('Context')) return 'effect-context'
              if (id.includes('Match')) return 'effect-match'
              return 'effect-core'
            }
            if (id.includes('node_modules')) {
              if (id.includes('three')) return 'three'
              return 'vendor'
            }
            if (id.includes('/domain/')) return 'domain'
            if (id.includes('/application/')) return 'application'
            if (id.includes('/infrastructure/')) return 'infrastructure'
            if (id.includes('/presentation/')) return 'presentation'
            if (id.includes('/shared/')) return 'shared'
          },
        },
      },
      assetsInlineLimit: 4096,
      cssCodeSplit: true,
      modulePreload: {
        polyfill: true,
        resolveDependencies: (filename, deps, { hostId, hostType }) => {
          return deps.filter((dep) => dep.includes('vendor-core') || dep.includes('game-core'))
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src'),
        '@/domain': resolve(process.cwd(), 'src/domain'),
        '@/application': resolve(process.cwd(), 'src/application'),
        '@/infrastructure': resolve(process.cwd(), 'src/infrastructure'),
        '@/presentation': resolve(process.cwd(), 'src/presentation'),
        '@/shared': resolve(process.cwd(), 'src/shared'),
        '@/test': resolve(process.cwd(), 'test'),
        // Prevent dev dependencies from being bundled
        'vitest': resolve(__dirname, 'src/empty.ts'),
        '@vitest/runner': resolve(__dirname, 'src/empty.ts'),
        '@vitest/runner/utils': resolve(__dirname, 'src/empty.ts'),
        '@vitest/expect': resolve(__dirname, 'src/empty.ts'),
        '@vitest/utils': resolve(__dirname, 'src/empty.ts'),
        '@vitest/snapshot': resolve(__dirname, 'src/empty.ts'),
        '@vitest/utils/error': resolve(__dirname, 'src/empty.ts'),
        '@vitest/spy': resolve(__dirname, 'src/empty.ts'),
        '@vitest/utils/source-map': resolve(__dirname, 'src/empty.ts'),
        'fast-check': resolve(__dirname, 'src/empty.ts'),
        'expect-type': resolve(__dirname, 'src/empty.ts'),
        'chai': resolve(__dirname, 'src/empty.ts'),
      },
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
      conditions: isDev
        ? ['development', 'module', 'import', 'default']
        : ['production', 'module', 'import', 'default'],
      preserveSymlinks: true,
    },
    optimizeDeps: {
      disabled: true,
    },
    css: {
      devSourcemap: isDev,
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: isDev ? '[name]__[local]___[hash:base64:5]' : '[hash:base64:8]',
      },
      transformer: 'lightningcss',
      lightningcss: {
        targets: {
          chrome: 90,
          firefox: 88,
          safari: 14,
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __DEV__: isDev,
      __GAME_DEBUG__: isDev,
      'process.env.NODE_ENV': JSON.stringify(mode),
      'import.meta.env.SSR': false,
    },
    assetsInclude: [
      '**/*.gltf',
      '**/*.glb',
      '**/*.obj',
      '**/*.mtl',
      '**/*.png',
      '**/*.jpg',
      '**/*.ogg',
      '**/*.wav',
      '**/*.json',
    ],
    preview: {
      port: env.VITE_PREVIEW_PORT ? Number(env.VITE_PREVIEW_PORT) : 4173,
      host: '0.0.0.0',
      strictPort: false,
      cors: true,
    },
    clearScreen: false,
    logLevel: isDev ? 'info' : 'warn',
  }
})
