import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: '50%',
        minForks: 1,
        isolate: true,
        singleFork: false,
      },
    },
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'packages/*/{application,infrastructure,domain,presentation}/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'packages/*/test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    slowTestThreshold: 300,
    fileParallelism: true,
    sequence: {
      seed: 0,
      hooks: 'stack',
    },
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      enabled: false,
      include: ['packages/*/{application,infrastructure,domain,presentation}/**/*.{ts,tsx}'],
      exclude: [
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
        '**/*.property.test.{js,ts}',
        '**/index.ts',
        // Browser-only entrypoints and WebGL passes — not runnable in Node.js
        '**/workers/**',
        '**/god-rays-pass.ts',
        '**/perf-marks.ts',
        'src/main.ts',
        // DOM-heavy presentation files with no meaningful unit-test surface
        '**/pause-menu.ts',
        '**/death-screen.ts',
        '**/input-service.ts',
      ],
      all: true,
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    deps: {},
  },
  resolve: {
    alias: {
      '@test': resolve(__dirname, 'test'),
      // @ts-minecraft/* workspace package aliases
      '@ts-minecraft/kernel': resolve(__dirname, 'packages/kernel'),
      '@ts-minecraft/terrain': resolve(__dirname, 'packages/terrain'),
      '@ts-minecraft/world-state': resolve(__dirname, 'packages/world-state'),
      '@ts-minecraft/player': resolve(__dirname, 'packages/player'),
      '@ts-minecraft/inventory': resolve(__dirname, 'packages/inventory'),
      '@ts-minecraft/entities': resolve(__dirname, 'packages/entities'),
      '@ts-minecraft/rendering/particles/particle-system': resolve(__dirname, 'packages/rendering/infrastructure/particles/particle-system'),
      '@ts-minecraft/rendering': resolve(__dirname, 'packages/rendering'),
      '@ts-minecraft/physics': resolve(__dirname, 'packages/physics'),
      '@ts-minecraft/game': resolve(__dirname, 'packages/game'),
      '@ts-minecraft/app/frame-handler.config': resolve(__dirname, 'packages/app/application/frame-handler.config'),
      '@ts-minecraft/app/frame-handler': resolve(__dirname, 'packages/app/application/frame-handler'),
      '@ts-minecraft/app/frame': resolve(__dirname, 'packages/app/application/frame'),
      '@ts-minecraft/app/main.config': resolve(__dirname, 'packages/app/application/main.config'),
      '@ts-minecraft/app/main': resolve(__dirname, 'packages/app/application/main'),
      '@ts-minecraft/app': resolve(__dirname, 'packages/app'),
    },
  },
  esbuild: {
    target: 'node22',
    format: 'esm',
    platform: 'node',
  },
})
