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
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
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
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['effect'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/domain': resolve(__dirname, 'src/domain'),
      '@/application': resolve(__dirname, 'src/application'),
      '@/infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@/presentation': resolve(__dirname, 'src/presentation'),
      '@/shared': resolve(__dirname, 'src/shared'),
      '@test': resolve(__dirname, 'test'),
    },
  },
  esbuild: {
    target: 'node22',
    format: 'esm',
    platform: 'node',
  },
})
