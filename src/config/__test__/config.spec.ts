import { describe, it, expect } from '@effect/vitest'
import { Effect, Either } from 'effect'
import * as fc from 'fast-check'
import { defaultConfig, validateConfig, loadConfig } from '../config'
import { Config } from '../../core/schemas/Config'

describe('config', () => {
  describe('defaultConfig', () => {
    it('デフォルト設定が正しい値を持つ', () => {
      expect(defaultConfig.debug).toBe(false)
      expect(defaultConfig.fps).toBe(60)
      expect(defaultConfig.memoryLimit).toBe(2048)
    })

    it('デフォルト設定がConfigスキーマに適合する', async () => {
      const validation = await Effect.runPromise(Effect.either(validateConfig(defaultConfig)))

      expect(Either.isRight(validation)).toBe(true)
      if (Either.isRight(validation)) {
        expect(validation.right).toEqual(defaultConfig)
      }
    })
  })

  describe('validateConfig', () => {
    it.effect('有効な設定をバリデーションできる', () =>
      Effect.gen(function* () {
        const validConfig = {
          debug: true,
          fps: 120,
          memoryLimit: 1024,
        }

        const result = yield* validateConfig(validConfig)
        expect(result.debug).toBe(true)
        expect(result.fps).toBe(120)
        expect(result.memoryLimit).toBe(1024)
      })
    )

    it.effect('無効なfps値を拒否する', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: 0, // 無効な値（正数である必要がある）
          memoryLimit: 2048,
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('fps上限を超える値を拒否する', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: 121, // 無効な値（120以下である必要がある）
          memoryLimit: 2048,
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('無効なmemoryLimit値を拒否する', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: 60,
          memoryLimit: -1, // 無効な値（正数である必要がある）
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('memoryLimit上限を超える値を拒否する', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: 60,
          memoryLimit: 2049, // 無効な値（2048以下である必要がある）
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('必須フィールドが欠けている場合にエラーを返す', () =>
      Effect.gen(function* () {
        const incompleteConfig = {
          debug: true,
          fps: 60,
          // memoryLimitが欠けている
        }

        const result = yield* Effect.either(validateConfig(incompleteConfig))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('型が間違っている場合にエラーを返す', () =>
      Effect.gen(function* () {
        const wrongTypeConfig = {
          debug: 'not a boolean', // 型が間違っている
          fps: 60,
          memoryLimit: 2048,
        }

        const result = yield* Effect.either(validateConfig(wrongTypeConfig))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('null値に対してエラーを返す', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(null))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('undefined値に対してエラーを返す', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(undefined))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('空のオブジェクトに対してエラーを返す', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({}))
        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('loadConfig', () => {
    it.effect('デフォルト設定を正常に読み込む', () =>
      Effect.gen(function* () {
        const config = yield* loadConfig

        expect(config.debug).toBe(false)
        expect(config.fps).toBe(60)
        expect(config.memoryLimit).toBe(2048)
      })
    )

    it.effect('loadConfigが常に有効な設定を返す', () =>
      Effect.gen(function* () {
        const config = yield* loadConfig

        // 設定が有効かチェック
        expect(typeof config.debug).toBe('boolean')
        expect(typeof config.fps).toBe('number')
        expect(typeof config.memoryLimit).toBe('number')
        expect(config.fps).toBeGreaterThan(0)
        expect(config.fps).toBeLessThanOrEqual(120)
        expect(config.memoryLimit).toBeGreaterThan(0)
        expect(config.memoryLimit).toBeLessThanOrEqual(2048)
      })
    )
  })

  describe('境界値テスト', () => {
    it.effect('fps最小値（1）を受け入れる', () =>
      Effect.gen(function* () {
        const config = {
          debug: false,
          fps: 1,
          memoryLimit: 1024,
        }

        const result = yield* validateConfig(config)
        expect(result.fps).toBe(1)
      })
    )

    it.effect('fps最大値（120）を受け入れる', () =>
      Effect.gen(function* () {
        const config = {
          debug: false,
          fps: 120,
          memoryLimit: 1024,
        }

        const result = yield* validateConfig(config)
        expect(result.fps).toBe(120)
      })
    )

    it.effect('memoryLimit最小値（1）を受け入れる', () =>
      Effect.gen(function* () {
        const config = {
          debug: false,
          fps: 60,
          memoryLimit: 1,
        }

        const result = yield* validateConfig(config)
        expect(result.memoryLimit).toBe(1)
      })
    )

    it.effect('memoryLimit最大値（2048）を受け入れる', () =>
      Effect.gen(function* () {
        const config = {
          debug: false,
          fps: 60,
          memoryLimit: 2048,
        }

        const result = yield* validateConfig(config)
        expect(result.memoryLimit).toBe(2048)
      })
    )
  })

  describe('Property-based testing', () => {
    it('有効な設定のプロパティテスト', () => {
      const validConfigArbitrary = fc.record({
        debug: fc.boolean(),
        fps: fc.integer({ min: 1, max: 120 }),
        memoryLimit: fc.integer({ min: 1, max: 2048 }),
      })

      fc.assert(
        fc.asyncProperty(validConfigArbitrary, async (config) => {
          const validation = await Effect.runPromise(Effect.either(validateConfig(config)))
          expect(Either.isRight(validation)).toBe(true)

          if (Either.isRight(validation)) {
            expect(validation.right.debug).toBe(config.debug)
            expect(validation.right.fps).toBe(config.fps)
            expect(validation.right.memoryLimit).toBe(config.memoryLimit)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('無効なfps値のプロパティテスト', () => {
      const invalidFpsArbitrary = fc.record({
        debug: fc.boolean(),
        fps: fc.oneof(
          fc.integer({ max: 0 }), // 0以下
          fc.integer({ min: 121 }) // 121以上
        ),
        memoryLimit: fc.integer({ min: 1, max: 2048 }),
      })

      fc.assert(
        fc.asyncProperty(invalidFpsArbitrary, async (config) => {
          const validation = await Effect.runPromise(Effect.either(validateConfig(config)))
          expect(Either.isLeft(validation)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('無効なmemoryLimit値のプロパティテスト', () => {
      const invalidMemoryLimitArbitrary = fc.record({
        debug: fc.boolean(),
        fps: fc.integer({ min: 1, max: 120 }),
        memoryLimit: fc.oneof(
          fc.integer({ max: 0 }), // 0以下
          fc.integer({ min: 2049 }) // 2049以上
        ),
      })

      fc.assert(
        fc.asyncProperty(invalidMemoryLimitArbitrary, async (config) => {
          const validation = await Effect.runPromise(Effect.either(validateConfig(config)))
          expect(Either.isLeft(validation)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('不正な型のプロパティテスト', () => {
      const invalidTypeArbitrary = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.array(fc.anything()),
        fc.constant(null),
        fc.constant(undefined)
      )

      fc.assert(
        fc.asyncProperty(invalidTypeArbitrary, async (invalidInput) => {
          const validation = await Effect.runPromise(Effect.either(validateConfig(invalidInput)))
          expect(Either.isLeft(validation)).toBe(true)
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('設定の不変条件', () => {
    it.effect('設定は常に非負の値を持つ', () =>
      Effect.gen(function* () {
        const config = yield* loadConfig

        expect(config.fps).toBeGreaterThan(0)
        expect(config.memoryLimit).toBeGreaterThan(0)
      })
    )

    it.effect('設定は実用的な範囲内にある', () =>
      Effect.gen(function* () {
        const config = yield* loadConfig

        // 実用的なFPS範囲
        expect(config.fps).toBeLessThanOrEqual(120)
        expect(config.fps).toBeGreaterThanOrEqual(1)

        // 実用的なメモリ制限範囲
        expect(config.memoryLimit).toBeLessThanOrEqual(2048)
        expect(config.memoryLimit).toBeGreaterThanOrEqual(1)
      })
    )
  })
})
