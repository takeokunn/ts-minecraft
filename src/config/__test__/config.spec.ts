import { describe, it, expect } from '@effect/vitest'
import { Effect, Either } from 'effect'
import { defaultConfig, loadConfig, validateConfig } from '../config.js'

describe('defaultConfig', () => {
  it('should provide valid default configuration', () => {
    expect(defaultConfig).toEqual({
      debug: false,
      fps: 60,
      memoryLimit: 2048,
    })
  })
})

describe('loadConfig', () => {
  it.effect('should load config from environment with defaults', () =>
    Effect.gen(function* () {
      const config = yield* loadConfig
      expect(config.debug).toBe(false) // default value
      expect(config.fps).toBe(60) // default value
      expect(config.memoryLimit).toBe(2048) // default value
    })
  )
})

describe('validateConfig', () => {
  describe('有効な設定のテスト', () => {
    it.effect('should accept valid configuration', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 60, memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right).toEqual(config)
        }
      })
    )

    it.effect('should handle minimum valid values', () =>
      Effect.gen(function* () {
        const config = { debug: false, fps: 1, memoryLimit: 1 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right).toEqual(config)
        }
      })
    )

    it.effect('should handle maximum valid values', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 120, memoryLimit: 2048 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right).toEqual(config)
        }
      })
    )
  })

  describe('無効な設定のテスト', () => {
    it.effect('should reject config with invalid fps (too low)', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 0, memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject config with invalid fps (too high)', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 121, memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject config with invalid memoryLimit (too low)', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 60, memoryLimit: 0 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject config with invalid memoryLimit (too high)', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 60, memoryLimit: 2049 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject incomplete config (missing fps)', () =>
      Effect.gen(function* () {
        const config = { debug: true, memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject incomplete config (missing memoryLimit)', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 60 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject incomplete config (missing debug)', () =>
      Effect.gen(function* () {
        const config = { fps: 60, memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('型エラーのテスト', () => {
    it.effect('should reject config with wrong debug type', () =>
      Effect.gen(function* () {
        const config = { debug: 'true', fps: 60, memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject config with wrong fps type', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: '60', memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject config with wrong memoryLimit type', () =>
      Effect.gen(function* () {
        const config = { debug: true, fps: 60, memoryLimit: '1024' }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject null values', () =>
      Effect.gen(function* () {
        const config = { debug: null, fps: 60, memoryLimit: 1024 }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('プリミティブ型や無効な構造のテスト', () => {
    it.effect('should reject string input', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig('invalid'))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject number input', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(123))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject boolean input', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(true))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject null input', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(null))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject undefined input', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(undefined))

        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('should reject array input', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(['array']))

        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('追加フィールドの処理', () => {
    it.effect('should remove extra fields from config', () =>
      Effect.gen(function* () {
        const config = {
          debug: true,
          fps: 60,
          memoryLimit: 1024,
          extra: 'field',
          another: 'extra',
        }
        const result = yield* Effect.either(validateConfig(config))

        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right).toEqual({
            debug: true,
            fps: 60,
            memoryLimit: 1024,
          })
        }
      })
    )
  })
})

// ===========================
// Property-Based Tests (Migrated to Data-Driven Tests)
// ===========================

describe('Property-Based Tests', () => {
  const TestData = {
    validConfigs: [
      { debug: true, fps: 60, memoryLimit: 1024 },
      { debug: false, fps: 1, memoryLimit: 1 },
      { debug: true, fps: 120, memoryLimit: 2048 },
      { debug: false, fps: 30, memoryLimit: 512 },
    ],
    configsWithExtraFields: [
      { debug: true, fps: 60, memoryLimit: 1024, extra: 'field' },
      { debug: false, fps: 30, memoryLimit: 512, another: 'extra', third: 123 },
    ],
    invalidFpsConfigs: [
      { debug: true, fps: 0, memoryLimit: 1024 }, // fps too low
      { debug: false, fps: 121, memoryLimit: 512 }, // fps too high
      { debug: true, fps: -10, memoryLimit: 1024 }, // negative fps
    ],
    invalidMemoryLimitConfigs: [
      { debug: true, fps: 60, memoryLimit: 0 }, // memoryLimit too low
      { debug: false, fps: 30, memoryLimit: 2049 }, // memoryLimit too high
      { debug: true, fps: 60, memoryLimit: -100 }, // negative memoryLimit
    ],
    incompleteConfigs: [
      { debug: true, fps: 60 }, // missing memoryLimit
      { debug: false, memoryLimit: 1024 }, // missing fps
      { fps: 30, memoryLimit: 512 }, // missing debug
      { debug: true }, // missing fps and memoryLimit
    ],
    wrongTypeConfigs: [
      { debug: 'true', fps: 60, memoryLimit: 1024 }, // debug should be boolean
      { debug: true, fps: '60', memoryLimit: 1024 }, // fps should be number
      { debug: true, fps: 60, memoryLimit: '1024' }, // memoryLimit should be number
      { debug: null, fps: 60, memoryLimit: 1024 }, // debug should not be null
    ],
    primitiveInputs: ['string', 123, true, null, undefined, ['array'], 'invalid'],
  }

  describe('有効な設定の不変条件', () => {
    it.effect('有効な設定は常に正しくデコード・エンコードされる', () =>
      Effect.gen(function* () {
        for (const config of TestData.validConfigs) {
          const result = yield* Effect.either(validateConfig(config))

          expect(Either.isRight(result)).toBe(true)
          if (Either.isRight(result)) {
            expect(result.right).toEqual(config)
          }
        }
      })
    )

    it.effect('有効な設定は常に指定範囲内にある', () =>
      Effect.gen(function* () {
        for (const config of TestData.validConfigs) {
          const result = yield* Effect.either(validateConfig(config))

          if (Either.isRight(result)) {
            const validated = result.right
            expect(validated.fps).toBeGreaterThanOrEqual(1)
            expect(validated.fps).toBeLessThanOrEqual(120)
            expect(validated.memoryLimit).toBeGreaterThanOrEqual(1)
            expect(validated.memoryLimit).toBeLessThanOrEqual(2048)
          }
        }
      })
    )

    it.effect('追加フィールドは常に除去される', () =>
      Effect.gen(function* () {
        for (const config of TestData.configsWithExtraFields) {
          const result = yield* Effect.either(validateConfig(config))

          if (Either.isRight(result)) {
            const validated = result.right
            expect(validated).toEqual({
              debug: config.debug,
              fps: config.fps,
              memoryLimit: config.memoryLimit,
            })
          }
        }
      })
    )
  })

  describe('無効な設定の検出', () => {
    it.effect('無効なfps値は常に拒否される', () =>
      Effect.gen(function* () {
        for (const config of TestData.invalidFpsConfigs) {
          const result = yield* Effect.either(validateConfig(config))
          expect(Either.isLeft(result)).toBe(true)
        }
      })
    )

    it.effect('無効なmemoryLimit値は常に拒否される', () =>
      Effect.gen(function* () {
        for (const config of TestData.invalidMemoryLimitConfigs) {
          const result = yield* Effect.either(validateConfig(config))
          expect(Either.isLeft(result)).toBe(true)
        }
      })
    )

    it.effect('不完全な設定は常に拒否される', () =>
      Effect.gen(function* () {
        for (const config of TestData.incompleteConfigs) {
          const result = yield* Effect.either(validateConfig(config))
          expect(Either.isLeft(result)).toBe(true)
        }
      })
    )

    it.effect('型が間違っている設定は常に拒否される', () =>
      Effect.gen(function* () {
        for (const config of TestData.wrongTypeConfigs) {
          const result = yield* Effect.either(validateConfig(config))
          expect(Either.isLeft(result)).toBe(true)
        }
      })
    )
  })

  describe('プリミティブ型や無効な構造は常に拒否される', () => {
    it.effect('プリミティブ型や無効な構造は常に拒否される', () =>
      Effect.gen(function* () {
        for (const invalidInput of TestData.primitiveInputs) {
          const result = yield* Effect.either(validateConfig(invalidInput))
          expect(Either.isLeft(result)).toBe(true)
        }
      })
    )
  })
})

// ===========================
// ラウンドトリップテスト
// ===========================

describe('ラウンドトリップテスト', () => {
  it.effect('有効な設定のラウンドトリップ変換が正しく動作する', () =>
    Effect.gen(function* () {
      const configs = [
        { debug: true, fps: 60, memoryLimit: 1024 },
        { debug: false, fps: 1, memoryLimit: 1 },
        { debug: true, fps: 120, memoryLimit: 2048 },
      ]

      for (const originalConfig of configs) {
        const validatedResult = yield* Effect.either(validateConfig(originalConfig))

        expect(Either.isRight(validatedResult)).toBe(true)
        if (Either.isRight(validatedResult)) {
          const validated = validatedResult.right

          // 再度バリデーションを通しても同じ結果になることを確認
          const secondValidation = yield* Effect.either(validateConfig(validated))
          expect(Either.isRight(secondValidation)).toBe(true)

          if (Either.isRight(secondValidation)) {
            expect(secondValidation.right).toEqual(validated)
          }
        }
      }
    })
  )
})

// ===========================
// 境界値の検証
// ===========================

describe('境界値の検証', () => {
  it.effect('fps境界値の動作を検証', () =>
    Effect.gen(function* () {
      // fps = 1 (最小値) は有効
      const minFpsResult = yield* Effect.either(validateConfig({ debug: true, fps: 1, memoryLimit: 1024 }))
      expect(Either.isRight(minFpsResult)).toBe(true)

      // fps = 0 (最小値未満) は無効
      const belowMinFpsResult = yield* Effect.either(validateConfig({ debug: true, fps: 0, memoryLimit: 1024 }))
      expect(Either.isLeft(belowMinFpsResult)).toBe(true)

      // fps = 120 (最大値) は有効
      const maxFpsResult = yield* Effect.either(validateConfig({ debug: true, fps: 120, memoryLimit: 1024 }))
      expect(Either.isRight(maxFpsResult)).toBe(true)

      // fps = 121 (最大値超過) は無効
      const aboveMaxFpsResult = yield* Effect.either(validateConfig({ debug: true, fps: 121, memoryLimit: 1024 }))
      expect(Either.isLeft(aboveMaxFpsResult)).toBe(true)
    })
  )

  it.effect('memoryLimit境界値の動作を検証', () =>
    Effect.gen(function* () {
      // memoryLimit = 1 (最小値) は有効
      const minMemResult = yield* Effect.either(validateConfig({ debug: true, fps: 60, memoryLimit: 1 }))
      expect(Either.isRight(minMemResult)).toBe(true)

      // memoryLimit = 0 (最小値未満) は無効
      const belowMinMemResult = yield* Effect.either(validateConfig({ debug: true, fps: 60, memoryLimit: 0 }))
      expect(Either.isLeft(belowMinMemResult)).toBe(true)

      // memoryLimit = 2048 (最大値) は有効
      const maxMemResult = yield* Effect.either(validateConfig({ debug: true, fps: 60, memoryLimit: 2048 }))
      expect(Either.isRight(maxMemResult)).toBe(true)

      // memoryLimit = 2049 (最大値超過) は無効
      const aboveMaxMemResult = yield* Effect.either(validateConfig({ debug: true, fps: 60, memoryLimit: 2049 }))
      expect(Either.isLeft(aboveMaxMemResult)).toBe(true)
    })
  )
})

// ===========================
// 無効な設定の検出
// ===========================

describe('無効な設定の検出', () => {
  it.effect('無効なmemoryLimit値は常に拒否される', () =>
    Effect.gen(function* () {
      const invalidMemoryLimits = [-1, 0, 2049, 10000, Number.MAX_VALUE]

      for (const invalidMemoryLimit of invalidMemoryLimits) {
        const result = yield* Effect.either(
          validateConfig({
            debug: true,
            fps: 60,
            memoryLimit: invalidMemoryLimit,
          })
        )
        expect(Either.isLeft(result)).toBe(true)
      }
    })
  )

  it.effect('無効なmemoryLimit値は常に拒否される', () =>
    Effect.gen(function* () {
      const invalidFpsValues = [-1, 0, 121, 1000, Number.MAX_VALUE]

      for (const invalidFps of invalidFpsValues) {
        const result = yield* Effect.either(
          validateConfig({
            debug: true,
            fps: invalidFps,
            memoryLimit: 1024,
          })
        )
        expect(Either.isLeft(result)).toBe(true)
      }
    })
  )
})

// ===========================
// 統合テスト
// ===========================

describe('統合テスト', () => {
  it.effect('loadConfigの結果はvalidateConfigを通過する', () =>
    Effect.gen(function* () {
      const loadedConfig = yield* loadConfig
      const validationResult = yield* Effect.either(validateConfig(loadedConfig))

      expect(Either.isRight(validationResult)).toBe(true)
      if (Either.isRight(validationResult)) {
        expect(validationResult.right).toEqual(loadedConfig)
      }
    })
  )

  it.effect('defaultConfigはvalidateConfigを通過する', () =>
    Effect.gen(function* () {
      const validationResult = yield* Effect.either(validateConfig(defaultConfig))

      expect(Either.isRight(validationResult)).toBe(true)
      if (Either.isRight(validationResult)) {
        expect(validationResult.right).toEqual(defaultConfig)
      }
    })
  )
})
