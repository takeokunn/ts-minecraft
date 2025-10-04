import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@effect/platform-node/NodeFileSystem': resolve(
        __dirname,
        'src/domain/world/__test__/stubs/node-file-system.ts'
      ),
      '@effect/platform-node/NodePath': resolve(
        __dirname,
        'src/domain/world/__test__/stubs/node-path.ts'
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 10_000,
    hookTimeout: 10_000,
    deps: {
      inline: ['fast-check'],
    },
  },
})
