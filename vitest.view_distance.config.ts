import baseConfig from './vitest.config.ts'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/domain/view_distance/__test__/**/*.test.ts'],
    exclude: [],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/domain/view_distance/**/*.ts'],
      exclude: [
        'src/domain/view_distance/__test__/**/*.test.ts',
        'src/domain/view_distance/index.ts',
      ],
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
      all: true,
      clean: true,
    },
  },
})
