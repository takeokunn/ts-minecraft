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
              './src/domain/**/*.ts',
              './src/application/**/*.ts',
              './src/infrastructure/**/*.ts',
              './src/presentation/**/*.ts',
              './src/shared/**/*.ts',
              '!./src/**/*.test.ts',
              '!./src/**/*.property.test.ts',
              '!./src/**/*.spec.ts',
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
      minify: isProd ? 'esbuild' : false,
      reportCompressedSize: false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('three')) return 'three'
              if (id.includes('/effect/')) return 'effect'
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
        '@/application': resolve(process.cwd(), 'src/application'),
        '@/infrastructure': resolve(process.cwd(), 'src/infrastructure'),
        '@/presentation': resolve(process.cwd(), 'src/presentation'),
        '@/test': resolve(process.cwd(), 'test'),
        // @ts-minecraft/* workspace package aliases (dev: resolve to TypeScript source directly)
        '@ts-minecraft/kernel': resolve(process.cwd(), 'packages/kernel/src'),
        '@ts-minecraft/domain': resolve(process.cwd(), 'packages/domain/src'),
        '@ts-minecraft/noise-generator': resolve(process.cwd(), 'packages/noise-generator/src'),
        '@ts-minecraft/block-storage': resolve(process.cwd(), 'packages/block-storage/src'),
        '@ts-minecraft/physics-engine': resolve(process.cwd(), 'packages/physics-engine/src'),
        '@ts-minecraft/terrain-generator': resolve(process.cwd(), 'packages/terrain-generator/src'),
        '@ts-minecraft/biome-classifier': resolve(process.cwd(), 'packages/biome-classifier/src'),
        '@ts-minecraft/chunk-manager': resolve(process.cwd(), 'packages/chunk-manager/src'),
        '@ts-minecraft/world-renderer': resolve(process.cwd(), 'packages/world-renderer/src'),
        '@ts-minecraft/block-service': resolve(process.cwd(), 'packages/block-service/src'),
        '@ts-minecraft/fluid-simulation': resolve(process.cwd(), 'packages/fluid-simulation/src'),
        '@ts-minecraft/light-engine': resolve(process.cwd(), 'packages/light-engine/src'),
        '@ts-minecraft/redstone-circuit': resolve(process.cwd(), 'packages/redstone-circuit/src'),
        '@ts-minecraft/player-controller': resolve(process.cwd(), 'packages/player-controller/src'),
        '@ts-minecraft/camera-controller': resolve(process.cwd(), 'packages/camera-controller/src'),
        '@ts-minecraft/input-handler': resolve(process.cwd(), 'packages/input-handler/src'),
        '@ts-minecraft/inventory-system': resolve(process.cwd(), 'packages/inventory-system/src'),
        '@ts-minecraft/hotbar-system': resolve(process.cwd(), 'packages/hotbar-system/src'),
        '@ts-minecraft/crafting-system': resolve(process.cwd(), 'packages/crafting-system/src'),
        '@ts-minecraft/furnace-system': resolve(process.cwd(), 'packages/furnace-system/src'),
        '@ts-minecraft/game-mode': resolve(process.cwd(), 'packages/game-mode/src'),
        '@ts-minecraft/settings-manager': resolve(process.cwd(), 'packages/settings-manager/src'),
        '@ts-minecraft/day-night-cycle': resolve(process.cwd(), 'packages/day-night-cycle/src'),
        '@ts-minecraft/audio-engine': resolve(process.cwd(), 'packages/audio-engine/src'),
        '@ts-minecraft/entity-manager': resolve(process.cwd(), 'packages/entity-manager/src'),
        '@ts-minecraft/village-system': resolve(process.cwd(), 'packages/village-system/src'),
        '@ts-minecraft/trading-system': resolve(process.cwd(), 'packages/trading-system/src'),
        '@ts-minecraft/game-session': resolve(process.cwd(), 'packages/game-session/src'),
        '@ts-minecraft/game-loop': resolve(process.cwd(), 'packages/game-loop/src'),
        '@ts-minecraft/app': resolve(process.cwd(), 'packages/app/src'),
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
      noDiscovery: true,
      include: undefined,
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
