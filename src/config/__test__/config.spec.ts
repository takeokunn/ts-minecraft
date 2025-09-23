import { describe, it, expect } from '@effect/vitest'
import { Effect, Either, ParseResult } from 'effect'
import * as fc from 'fast-check'
import { defaultConfig, validateConfig, loadConfig } from '../config'

// ===========================
// テスト用アービトラリ定義
// ===========================

const Arbitraries = {
  // 有効な設定値のアービトラリ
  validConfig: fc.record({
    debug: fc.boolean(),
    fps: fc.integer({ min: 1, max: 120 }),
    memoryLimit: fc.integer({ min: 1, max: 2048 }),
  }),

  // 境界値用のアービトラリ
  boundaryFps: fc.constantFrom(0, 1, 120, 121, -1, 0.5, 119.9),
  boundaryMemoryLimit: fc.constantFrom(0, 1, 2048, 2049, -1, 0.5, 2047.9),

  // 無効なFPS値のアービトラリ
  invalidFps: fc.oneof(
    fc.integer({ max: 0 }),
    fc.integer({ min: 121 }),
    fc.float({ max: Math.fround(0.99) }),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity)
  ),

  // 無効なメモリリミット値のアービトラリ
  invalidMemoryLimit: fc.oneof(
    fc.integer({ max: 0 }),
    fc.integer({ min: 2049 }),
    fc.float({ max: Math.fround(0.99) }),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity)
  ),

  // 無効な型のアービトラリ
  invalidTypes: fc.oneof(
    fc.string(),
    fc.integer(),
    fc.float(),
    fc.array(fc.anything()),
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(Symbol('test')),
    fc.bigInt(),
    fc.date(),
    fc.func(fc.anything())
  ),

  // 不完全な設定のアービトラリ
  incompleteConfig: fc.oneof(
    fc.record({ debug: fc.boolean(), fps: fc.integer({ min: 1, max: 120 }) }),
    fc.record({ debug: fc.boolean(), memoryLimit: fc.integer({ min: 1, max: 2048 }) }),
    fc.record({ fps: fc.integer({ min: 1, max: 120 }), memoryLimit: fc.integer({ min: 1, max: 2048 }) }),
    fc.record({ debug: fc.boolean() }),
    fc.record({ fps: fc.integer({ min: 1, max: 120 }) }),
    fc.record({ memoryLimit: fc.integer({ min: 1, max: 2048 }) }),
    fc.constant({})
  ),

  // 型が間違っている設定のアービトラリ
  wrongTypeConfig: fc.oneof(
    fc.record({
      debug: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
      fps: fc.integer({ min: 1, max: 120 }),
      memoryLimit: fc.integer({ min: 1, max: 2048 }),
    }),
    fc.record({
      debug: fc.boolean(),
      fps: fc.oneof(fc.string(), fc.boolean(), fc.constant(null)),
      memoryLimit: fc.integer({ min: 1, max: 2048 }),
    }),
    fc.record({
      debug: fc.boolean(),
      fps: fc.integer({ min: 1, max: 120 }),
      memoryLimit: fc.oneof(fc.string(), fc.boolean(), fc.constant(null)),
    })
  ),

  // 追加フィールドを持つ設定のアービトラリ
  configWithExtraFields: fc.record({
    debug: fc.boolean(),
    fps: fc.integer({ min: 1, max: 120 }),
    memoryLimit: fc.integer({ min: 1, max: 2048 }),
    extra: fc.anything(),
    another: fc.anything(),
  }),
}

// ===========================
// defaultConfig のテスト
// ===========================

describe('defaultConfig', () => {
  it('正しいデフォルト値を持つ', () => {
    expect(defaultConfig).toEqual({
      debug: false,
      fps: 60,
      memoryLimit: 2048,
    })
  })

  it.effect('Configスキーマに適合する', () =>
    Effect.gen(function* () {
      const result = yield* validateConfig(defaultConfig)
      expect(result).toEqual(defaultConfig)
    })
  )

  it('不変であることを保証', () => {
    const frozen = Object.freeze({ ...defaultConfig })
    expect(() => {
      // @ts-expect-error - 意図的な変更テスト
      frozen.debug = true
    }).toThrow()
  })
})

// ===========================
// validateConfig のテスト
// ===========================

describe('validateConfig', () => {
  describe('正常系', () => {
    it.effect('有効な最小値設定を受け入れる', () =>
      Effect.gen(function* () {
        const minConfig = { debug: false, fps: 1, memoryLimit: 1 }
        const result = yield* validateConfig(minConfig)
        expect(result).toEqual(minConfig)
      })
    )

    it.effect('有効な最大値設定を受け入れる', () =>
      Effect.gen(function* () {
        const maxConfig = { debug: true, fps: 120, memoryLimit: 2048 }
        const result = yield* validateConfig(maxConfig)
        expect(result).toEqual(maxConfig)
      })
    )

    it.effect('追加フィールドを無視する', () =>
      Effect.gen(function* () {
        const configWithExtra = {
          debug: true,
          fps: 60,
          memoryLimit: 1024,
          extraField: 'should be ignored',
        }
        const result = yield* validateConfig(configWithExtra)
        expect(result).toEqual({
          debug: true,
          fps: 60,
          memoryLimit: 1024,
        })
      })
    )
  })

  describe('異常系 - fps', () => {
    it.effect('fps = 0 を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 0, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(ParseResult.isParseError(result.left)).toBe(true)
        }
      })
    )

    it.effect('fps = 121 を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 121, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('負のfps値を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: -1, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('小数のfps値を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 60.5, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('NaNをfpsとして拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: NaN, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('Infinityをfpsとして拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: Infinity, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('異常系 - memoryLimit', () => {
    it.effect('memoryLimit = 0 を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 60, memoryLimit: 0 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('memoryLimit = 2049 を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 60, memoryLimit: 2049 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('負のmemoryLimit値を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 60, memoryLimit: -1 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('小数のmemoryLimit値を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 60, memoryLimit: 1024.5 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('異常系 - 型エラー', () => {
    it.effect('debugフィールドの型エラーを検出', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: 'not boolean', fps: 60, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('fpsフィールドの型エラーを検出', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: '60', memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('memoryLimitフィールドの型エラーを検出', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 60, memoryLimit: '1024' }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('異常系 - 構造エラー', () => {
    it.effect('null入力を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(null))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('undefined入力を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(undefined))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('空オブジェクトを拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({}))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('debugフィールドの欠如を検出', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ fps: 60, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('fpsフィールドの欠如を検出', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, memoryLimit: 1024 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('memoryLimitフィールドの欠如を検出', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig({ debug: false, fps: 60 }))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('配列入力を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig([]))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('文字列入力を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig('config'))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('数値入力を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(123))
        expect(Either.isLeft(result)).toBe(true)
      })
    )

    it.effect('関数入力を拒否する', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(validateConfig(() => ({})))
        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })
})

// ===========================
// loadConfig のテスト
// ===========================

describe('loadConfig', () => {
  it.effect('デフォルト設定を正しく読み込む', () =>
    Effect.gen(function* () {
      const config = yield* loadConfig
      expect(config).toEqual({
        debug: false,
        fps: 60,
        memoryLimit: 2048,
      })
    })
  )

  it.effect('読み込まれた設定が不変条件を満たす', () =>
    Effect.gen(function* () {
      const config = yield* loadConfig

      // 型の検証
      expect(typeof config.debug).toBe('boolean')
      expect(typeof config.fps).toBe('number')
      expect(typeof config.memoryLimit).toBe('number')

      // 範囲の検証
      expect(config.fps).toBeGreaterThan(0)
      expect(config.fps).toBeLessThanOrEqual(120)
      expect(config.memoryLimit).toBeGreaterThan(0)
      expect(config.memoryLimit).toBeLessThanOrEqual(2048)

      // 整数の検証
      expect(Number.isInteger(config.fps)).toBe(true)
      expect(Number.isInteger(config.memoryLimit)).toBe(true)
    })
  )

  it.effect('複数回呼び出しても同じ値を返す', () =>
    Effect.gen(function* () {
      const config1 = yield* loadConfig
      const config2 = yield* loadConfig
      const config3 = yield* loadConfig

      expect(config1).toEqual(config2)
      expect(config2).toEqual(config3)
    })
  )
})

// ===========================
// Property-Based Tests
// ===========================

describe('Property-Based Tests', () => {
  describe('有効な設定の不変条件', () => {
    it('有効な設定は常に正しくデコード・エンコードされる', () => {
      fc.assert(
        fc.property(Arbitraries.validConfig, (config) => {
          const result = Effect.runSync(Effect.either(validateConfig(config)))

          expect(Either.isRight(result)).toBe(true)
          if (Either.isRight(result)) {
            expect(result.right).toEqual(config)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('有効な設定は常に指定範囲内にある', () => {
      fc.assert(
        fc.property(Arbitraries.validConfig, (config) => {
          const result = Effect.runSync(Effect.either(validateConfig(config)))

          if (Either.isRight(result)) {
            const validated = result.right
            expect(validated.fps).toBeGreaterThanOrEqual(1)
            expect(validated.fps).toBeLessThanOrEqual(120)
            expect(validated.memoryLimit).toBeGreaterThanOrEqual(1)
            expect(validated.memoryLimit).toBeLessThanOrEqual(2048)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('追加フィールドは常に除去される', () => {
      fc.assert(
        fc.property(Arbitraries.configWithExtraFields, (config) => {
          const result = Effect.runSync(Effect.either(validateConfig(config)))

          if (Either.isRight(result)) {
            const validated = result.right
            expect(Object.keys(validated).sort()).toEqual(['debug', 'fps', 'memoryLimit'].sort())
            expect('extra' in validated).toBe(false)
            expect('another' in validated).toBe(false)
          }
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('無効な設定の検出', () => {
    it('無効なfps値は常に拒否される', () => {
      fc.assert(
        fc.property(
          fc.record({
            debug: fc.boolean(),
            fps: Arbitraries.invalidFps,
            memoryLimit: fc.integer({ min: 1, max: 2048 }),
          }),
          (config) => {
            const result = Effect.runSync(Effect.either(validateConfig(config)))
            expect(Either.isLeft(result)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('無効なmemoryLimit値は常に拒否される', () => {
      fc.assert(
        fc.property(
          fc.record({
            debug: fc.boolean(),
            fps: fc.integer({ min: 1, max: 120 }),
            memoryLimit: Arbitraries.invalidMemoryLimit,
          }),
          (config) => {
            const result = Effect.runSync(Effect.either(validateConfig(config)))
            expect(Either.isLeft(result)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('不完全な設定は常に拒否される', () => {
      fc.assert(
        fc.property(Arbitraries.incompleteConfig, (config) => {
          const result = Effect.runSync(Effect.either(validateConfig(config)))
          expect(Either.isLeft(result)).toBe(true)
        }),
        { numRuns: 50 }
      )
    })

    it('型が間違っている設定は常に拒否される', () => {
      fc.assert(
        fc.property(Arbitraries.wrongTypeConfig, (config) => {
          const result = Effect.runSync(Effect.either(validateConfig(config)))
          expect(Either.isLeft(result)).toBe(true)
        }),
        { numRuns: 50 }
      )
    })

    it('プリミティブ型や無効な構造は常に拒否される', () => {
      fc.assert(
        fc.property(Arbitraries.invalidTypes, (invalidInput) => {
          const result = Effect.runSync(Effect.either(validateConfig(invalidInput)))
          expect(Either.isLeft(result)).toBe(true)
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('境界値の検証', () => {
    it('fps境界値の動作を検証', () => {
      fc.assert(
        fc.property(Arbitraries.boundaryFps, (fps) => {
          const config = { debug: false, fps, memoryLimit: 1024 }
          const result = Effect.runSync(Effect.either(validateConfig(config)))

          const shouldBeValid = Number.isInteger(fps) && fps >= 1 && fps <= 120
          expect(Either.isRight(result)).toBe(shouldBeValid)
        }),
        { numRuns: 10 }
      )
    })

    it('memoryLimit境界値の動作を検証', () => {
      fc.assert(
        fc.property(Arbitraries.boundaryMemoryLimit, (memoryLimit) => {
          const config = { debug: false, fps: 60, memoryLimit }
          const result = Effect.runSync(Effect.either(validateConfig(config)))

          const shouldBeValid = Number.isInteger(memoryLimit) && memoryLimit >= 1 && memoryLimit <= 2048
          expect(Either.isRight(result)).toBe(shouldBeValid)
        }),
        { numRuns: 10 }
      )
    })
  })

  describe('ラウンドトリップテスト', () => {
    it('有効な設定は複数回のバリデーションでも同一', () => {
      fc.assert(
        fc.property(Arbitraries.validConfig, (config) => {
          const result1 = Effect.runSync(Effect.either(validateConfig(config)))
          const result2 = Effect.runSync(Effect.either(validateConfig(config)))

          expect(Either.isRight(result1)).toBe(true)
          expect(Either.isRight(result2)).toBe(true)

          if (Either.isRight(result1) && Either.isRight(result2)) {
            expect(result1.right).toEqual(result2.right)
          }
        }),
        { numRuns: 50 }
      )
    })
  })
})

// ===========================
// 統合テスト
// ===========================

describe('統合テスト', () => {
  it.effect('loadConfigの結果はvalidateConfigを通過する', () =>
    Effect.gen(function* () {
      const loaded = yield* loadConfig
      const validated = yield* validateConfig(loaded)
      expect(validated).toEqual(loaded)
    })
  )

  it.effect('エラーケースでEffectが適切に失敗する', () =>
    Effect.gen(function* () {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { debug: 'not boolean', fps: 60, memoryLimit: 1024 },
        { debug: false, fps: 0, memoryLimit: 1024 },
        { debug: false, fps: 60, memoryLimit: -1 },
      ]

      for (const invalid of invalidConfigs) {
        const result = yield* Effect.either(validateConfig(invalid))
        expect(Either.isLeft(result)).toBe(true)
      }
    })
  )
})
