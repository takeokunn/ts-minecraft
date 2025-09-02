import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src/index.ts', 'vite.config.ts', 'src/@types/*', 'src/systems/index.ts', 'test/'],
    },
  },
})
