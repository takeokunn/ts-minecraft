import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config.ts'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/domain/furniture/__test__/**/*.spec.ts'],
    exclude: [],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/domain/furniture/**/*.ts'],
      exclude: ['src/domain/furniture/__test__/**/*.spec.ts'],
      all: false,
      clean: true,
    },
  },
})
