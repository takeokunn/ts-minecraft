import { resolve } from 'node:path'
import { defineConfig } from 'vite'
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
})
