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
      open: false,
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
              './src/main.ts',
              './packages/*/{domain,application,infrastructure,presentation}/**/*.ts',
              '!./packages/**/*.test.ts',
              '!./packages/**/*.property.test.ts',
              '!./packages/**/*.spec.ts',
              '!./packages/**/test/**',
            ],
            ssrFiles: [],
          }
        : undefined,
    },
    build: {
      target: 'es2024',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDev,
      minify: isProd ? 'esbuild' : false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return

            if (id.includes('/three/')) return 'three'
            if (id.includes('/effect/')) return 'effect'
          },
        },
      },
      assetsInlineLimit: 4096,
      cssCodeSplit: true,
      modulePreload: {
        polyfill: true,
        resolveDependencies: (_filename, deps) => {
          return deps.filter((dep) => dep.includes('vendor-core') || dep.includes('game-core'))
        },
      },
    },
    resolve: {
      alias: {
        // Current @ts-minecraft/* workspace package aliases (dev: resolve to TypeScript source directly)
        '@ts-minecraft/core': resolve(process.cwd(), 'packages/core'),
        '@ts-minecraft/block': resolve(process.cwd(), 'packages/block'),
        '@ts-minecraft/entity': resolve(process.cwd(), 'packages/entity'),
        '@ts-minecraft/inventory': resolve(process.cwd(), 'packages/inventory'),
        '@ts-minecraft/network': resolve(process.cwd(), 'packages/network'),
        '@ts-minecraft/world': resolve(process.cwd(), 'packages/world'),
        '@ts-minecraft/game': resolve(process.cwd(), 'packages/game'),
        '@ts-minecraft/rendering/particles/particle-system': resolve(process.cwd(), 'packages/rendering/infrastructure/particles/particle-system'),
        '@ts-minecraft/rendering': resolve(process.cwd(), 'packages/rendering'),
        '@ts-minecraft/worker': resolve(process.cwd(), 'packages/worker'),
        '@ts-minecraft/presentation': resolve(process.cwd(), 'packages/presentation'),
        '@ts-minecraft/app/frame-handler.config': resolve(process.cwd(), 'packages/app/application/frame-handler.config'),
        '@ts-minecraft/app/frame-handler': resolve(process.cwd(), 'packages/app/application/frame-handler'),
        '@ts-minecraft/app/frame': resolve(process.cwd(), 'packages/app/application/frame'),
        '@ts-minecraft/app/main.config': resolve(process.cwd(), 'packages/app/application/main.config'),
        '@ts-minecraft/app/main': resolve(process.cwd(), 'packages/app/application/main'),
        '@ts-minecraft/app': resolve(process.cwd(), 'packages/app'),
        // Prevent dev dependencies from being bundled
        'vitest': resolve(__dirname, 'empty.ts'),
        '@vitest/runner': resolve(__dirname, 'empty.ts'),
        '@vitest/runner/utils': resolve(__dirname, 'empty.ts'),
        '@vitest/expect': resolve(__dirname, 'empty.ts'),
        '@vitest/utils': resolve(__dirname, 'empty.ts'),
        '@vitest/snapshot': resolve(__dirname, 'empty.ts'),
        '@vitest/utils/error': resolve(__dirname, 'empty.ts'),
        '@vitest/spy': resolve(__dirname, 'empty.ts'),
        '@vitest/utils/source-map': resolve(__dirname, 'empty.ts'),
        'expect-type': resolve(__dirname, 'empty.ts'),
        'chai': resolve(__dirname, 'empty.ts'),
      },
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
      conditions: isDev
        ? ['development', 'module', 'import', 'default']
        : ['production', 'module', 'import', 'default'],
      preserveSymlinks: true,
      dedupe: ['three'],
    },
    optimizeDeps: {
      include: ['effect', 'three'],
    },
    worker: {
      format: 'es',
    },
    css: {
      devSourcemap: isDev,
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: isDev ? '[name]__[local]___[hash:base64:5]' : '[hash:base64:8]',
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
