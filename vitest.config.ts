import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 10000,
    hookTimeout: 10000,
    deps: {
      optimizer: {
        web: {
          include: ['fast-check'],
        },
      },
    },
    include: ['src/**/__tests__/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/docs/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/domain/chunk/**/*.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
      include: ['src/domain/chunk/**/*.ts', 'src/presentation/**/*.ts'],
      exclude: [
        'src/domain/chunk/**/*.spec.ts',
        'src/domain/chunk/**/__tests__/**',
        'src/domain/chunk/**/index.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
      all: true,
      clean: true,
    },
  },

  resolve: {
    alias: {
      '@config': resolve(__dirname, './src/config'),
      '@domain': resolve(__dirname, './src/domain'),
      '@application': resolve(__dirname, './src/application'),
      '@infrastructure': resolve(__dirname, './src/infrastructure'),
      '@presentation': resolve(__dirname, './src/presentation'),
      '@shared': resolve(__dirname, './src/shared'),
      '@bootstrap': resolve(__dirname, './src/bootstrap'),
      '@effect/platform-node/NodeFileSystem': resolve(
        __dirname,
        './src/domain/world/__test__/stubs/node-file-system.ts'
      ),
      '@effect/platform-node/NodePath': resolve(__dirname, './src/domain/world/__test__/stubs/node-path.ts'),
    },
  },
})
