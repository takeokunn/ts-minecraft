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
    include: [
      'src/application/**/*.test.ts',
      'src/application/**/__test__/**/*.spec.ts',
      'src/domain/camera/__test__/*.spec.ts',
      'src/domain/input/__test__/*.spec.ts',
      'src/domain/interaction/__test__/**/*.spec.ts',
      'src/domain/player/core/__test__/*.spec.ts',
      'src/domain/player/state/__test__/*.spec.ts',
      'src/domain/player/movement/__test__/*.spec.ts',
      'src/domain/player/health/__test__/*.spec.ts',
      'src/domain/player/hunger/__test__/*.spec.ts',
      'src/domain/block/**/__test__/**/*.spec.ts',
      'src/domain/block/**/*.test.ts',
      'src/domain/agriculture/**/*.test.ts',
      'src/domain/crafting/__test__/**/*.spec.ts',
      'src/domain/chunk/__test__/**/*.spec.ts',
      'src/domain/chunk_loader/__test__/**/*.spec.ts',
      'src/domain/entities/**/__test__/**/*.spec.ts',
      'src/domain/equipment/__test__/**/*.spec.ts',
      'src/domain/inventory/__test__/**/*.spec.ts',
      'src/domain/materials/**/__test__/**/*.spec.ts',
      'src/domain/physics/**/__test__/**/*.spec.ts',
      'src/domain/physics/**/__test__/**/*.ts',
      'src/domain/game_loop/**/*.spec.ts',
      'src/domain/chunk_manager/**/*.test.ts',
      'src/domain/chunk_system/__test__/**/*.test.ts',
      'src/domain/world/__test__/**/*.spec.ts',
      'src/domain/world/**/*.test.ts',
      'src/domain/scene/**/*.test.ts',
      'src/infrastructure/**/__test__/**/*.spec.ts',
      'src/infrastructure/**/*.test.ts',
      'src/bootstrap/**/__test__/**/*.spec.ts',
      'src/bootstrap/**/*.test.ts',
      'src/presentation/**/*.test.ts',
      'src/presentation/**/*.spec.ts',
    ],
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
          statements: 100
        },
        'src/domain/chunk/**/*.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        }
      },
      include: ['src/domain/chunk/**/*.ts', 'src/presentation/**/*.ts'],
      exclude: [
        'src/domain/chunk/**/*.spec.ts',
        'src/domain/chunk/**/__test__/**',
        'src/domain/chunk/**/index.ts',
        '**/node_modules/**',
        '**/dist/**'
      ],
      all: true,
      clean: true
    }
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
      '@effect/platform-node/NodeFileSystem': resolve(__dirname, './src/domain/world/__test__/stubs/node-file-system.ts'),
      '@effect/platform-node/NodePath': resolve(__dirname, './src/domain/world/__test__/stubs/node-path.ts'),
    },
  },
})
