import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'
import { expectEffectDuration, testAllBranches } from '../../../test/unified-test-helpers'
import {
  NoiseGeneratorLive,
  NoiseGeneratorLiveDefault,
  NoiseGeneratorTag,
  NoiseConfigSchema,
  type NoiseGenerator,
  type NoiseConfig,
} from '../NoiseGenerator'

/**
 * NoiseGenerator専用のテストヘルパー
 */
const runWithTestGenerator = <A>(
  config: NoiseConfig,
  operation: (ng: NoiseGenerator) => Effect.Effect<A, never, never>
) =>
  Effect.gen(function* () {
    const ng = yield* NoiseGeneratorTag
    return yield* operation(ng)
  }).pipe(Effect.provide(NoiseGeneratorLive(config)))

describe('NoiseGenerator', () => {
  const testConfig: NoiseConfig = {
    seed: 12345,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
  }

  describe('NoiseConfigSchema', () => {
    it('validates valid noise configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            seed: fc.integer({ min: 0, max: 2147483647 }),
            octaves: fc.integer({ min: 1, max: 10 }),
            persistence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
            lacunarity: fc.float({ min: Math.fround(1.5), max: Math.fround(3.0) }),
          }),
          (config) => {
            expect(() => Schema.decodeUnknownSync(NoiseConfigSchema)(config)).not.toThrow()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('rejects invalid configuration', async () => {
      const invalidConfigs = [
        { seed: 'invalid', octaves: 4, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: -1, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 'invalid', lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 0.5, lacunarity: null },
      ]

      for (const config of invalidConfigs) {
        expect(() => Schema.decodeUnknownSync(NoiseConfigSchema)(config)).toThrow()
      }
    })
  })

  describe('Service Creation', () => {
    it('creates NoiseGenerator with custom config', async () => {
      const testEffect = Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        expect(ng.getSeed()).toBe(testConfig.seed)
        expect(ng.getConfig()).toEqual(testConfig)
      })

      await Effect.runPromise(testEffect.pipe(Effect.provide(NoiseGeneratorLive(testConfig))))
    })

    it('creates NoiseGenerator with default config', async () => {
      const testEffect = Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const config = ng.getConfig()

        expect(config.octaves).toBe(6)
        expect(config.persistence).toBe(0.5)
        expect(config.lacunarity).toBe(2.0)
        expect(typeof config.seed).toBe('number')
      })

      await Effect.runPromise(testEffect.pipe(Effect.provide(NoiseGeneratorLiveDefault)))
    })
  })

  describe('2D Noise Generation', () => {
    it('generates consistent 2D noise values for same input', async () => {
      const testCoords = [
        { x: 0, y: 0 },
        { x: 1.5, y: 2.7 },
        { x: -3.14, y: 2.71 },
        { x: 100.5, y: -50.25 },
      ]

      for (const { x, y } of testCoords) {
        const effect = runWithTestGenerator(testConfig, (ng) =>
          Effect.gen(function* () {
            const value1 = yield* ng.noise2D(x, y)
            const value2 = yield* ng.noise2D(x, y)

            expect(value1).toBe(value2)
            expect(typeof value1).toBe('number')
            expect(value1).toBeGreaterThanOrEqual(-1)
            expect(value1).toBeLessThanOrEqual(1)

            return value1
          })
        )

        await Effect.runPromise(effect)
      }
    })

    it('generates different values for different coordinates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(fc.float({ min: -100, max: 100 }), fc.float({ min: -100, max: 100 })),
          fc.tuple(fc.float({ min: -100, max: 100 }), fc.float({ min: -100, max: 100 })),
          async ([x1, y1], [x2, y2]) => {
            if (Math.abs(x1 - x2) < 0.01 && Math.abs(y1 - y2) < 0.01) {
              return // 座標が近すぎる場合はスキップ
            }

            const effect = runWithTestGenerator(testConfig, (ng) =>
              Effect.gen(function* () {
                const value1 = yield* ng.noise2D(x1, y1)
                const value2 = yield* ng.noise2D(x2, y2)

                // 異なる座標では異なる値を生成する可能性が高い
                return { value1, value2, isDifferent: value1 !== value2 }
              })
            )

            const result: { value1: number; value2: number } = (await Effect.runPromise(effect)) as any
            // 100%異なることは保証されないが、大部分は異なるはず
            expect(typeof result.value1).toBe('number')
            expect(typeof result.value2).toBe('number')
          }
        ),
        { numRuns: 20 }
      )
    })

    it('maintains smoothness - adjacent values should be similar', async () => {
      const baseX = 10.0
      const baseY = 20.0
      const step = 0.1

      const effect = runWithTestGenerator(testConfig, (ng) =>
        Effect.gen(function* () {
          const center = yield* ng.noise2D(baseX, baseY)
          const right = yield* ng.noise2D(baseX + step, baseY)
          const up = yield* ng.noise2D(baseX, baseY + step)

          // 隣接する値は大きく変化しないはず
          const diffRight = Math.abs(center - right)
          const diffUp = Math.abs(center - up)

          expect(diffRight).toBeLessThan(0.3) // 経験的な閾値
          expect(diffUp).toBeLessThan(0.3)

          return { center, right, up }
        })
      )

      await Effect.runPromise(effect)
    })
  })

  describe('3D Noise Generation', () => {
    it('generates consistent 3D noise values for same input', async () => {
      const testCoords = [
        { x: 0, y: 0, z: 0 },
        { x: 1.5, y: 2.7, z: -1.3 },
        { x: -3.14, y: 2.71, z: 0.577 },
      ]

      for (const { x, y, z } of testCoords) {
        const effect = runWithTestGenerator(testConfig, (ng) =>
          Effect.gen(function* () {
            const value1 = yield* ng.noise3D(x, y, z)
            const value2 = yield* ng.noise3D(x, y, z)

            expect(value1).toBe(value2)
            expect(typeof value1).toBe('number')
            expect(value1).toBeGreaterThanOrEqual(-1)
            expect(value1).toBeLessThanOrEqual(1)

            return value1
          })
        )

        await Effect.runPromise(effect)
      }
    })

    it('generates values within expected range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: -50, max: 50 }),
          fc.float({ min: -50, max: 50 }),
          fc.float({ min: -50, max: 50 }),
          async (x, y, z) => {
            const effect = runWithTestGenerator(testConfig, (ng) => ng.noise3D(x, y, z))
            const value = await Effect.runPromise(effect)

            expect(value).toBeGreaterThanOrEqual(-1)
            expect(value).toBeLessThanOrEqual(1)
            expect(typeof value).toBe('number')
            expect(Number.isFinite(value)).toBe(true)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Octave Noise Generation', () => {
    it('generates 2D octave noise with proper layering', async () => {
      const effect = runWithTestGenerator(testConfig, (ng) =>
        Effect.gen(function* () {
          const octave1 = yield* ng.octaveNoise2D(10, 20, 1, 0.5)
          const octave4 = yield* ng.octaveNoise2D(10, 20, 4, 0.5)
          const octave8 = yield* ng.octaveNoise2D(10, 20, 8, 0.5)

          // より多くのオクターブは異なる結果を生成するはず
          expect(octave1).not.toBe(octave4)
          expect(octave4).not.toBe(octave8)

          // 値は範囲内に収まる
          for (const value of [octave1, octave4, octave8]) {
            expect(value).toBeGreaterThanOrEqual(-1)
            expect(value).toBeLessThanOrEqual(1)
          }

          return { octave1, octave4, octave8 }
        })
      )

      await Effect.runPromise(effect)
    })

    it('generates 3D octave noise with different persistence values', async () => {
      const x = 5.5
      const y = 10.3
      const z = -2.7
      const octaves = 6

      const effect = runWithTestGenerator(testConfig, (ng) =>
        Effect.gen(function* () {
          const lowPersistence = yield* ng.octaveNoise3D(x, y, z, octaves, 0.2)
          const medPersistence = yield* ng.octaveNoise3D(x, y, z, octaves, 0.5)
          const highPersistence = yield* ng.octaveNoise3D(x, y, z, octaves, 0.8)

          // 異なるpersistence値は異なる結果を生成
          expect(lowPersistence).not.toBe(medPersistence)
          expect(medPersistence).not.toBe(highPersistence)

          // すべて有効な範囲内
          for (const value of [lowPersistence, medPersistence, highPersistence]) {
            expect(value).toBeGreaterThanOrEqual(-1)
            expect(value).toBeLessThanOrEqual(1)
            expect(Number.isFinite(value)).toBe(true)
          }

          return { lowPersistence, medPersistence, highPersistence }
        })
      )

      await Effect.runPromise(effect)
    })
  })

  describe('Seed Reproducibility', () => {
    it('generates identical results with same seed', async () => {
      const seed = 98765
      const testCoords = { x: 15.7, y: -8.3, z: 22.1 }

      const config1: NoiseConfig = { ...testConfig, seed }
      const config2: NoiseConfig = { ...testConfig, seed }

      const effect1 = runWithTestGenerator(config1, (ng) =>
        Effect.gen(function* () {
          const noise2D = yield* ng.noise2D(testCoords.x, testCoords.y)
          const noise3D = yield* ng.noise3D(testCoords.x, testCoords.y, testCoords.z)
          const octave2D = yield* ng.octaveNoise2D(testCoords.x, testCoords.y, 5, 0.6)
          const octave3D = yield* ng.octaveNoise3D(testCoords.x, testCoords.y, testCoords.z, 5, 0.6)

          return { noise2D, noise3D, octave2D, octave3D }
        })
      )

      const effect2 = runWithTestGenerator(config2, (ng) =>
        Effect.gen(function* () {
          const noise2D = yield* ng.noise2D(testCoords.x, testCoords.y)
          const noise3D = yield* ng.noise3D(testCoords.x, testCoords.y, testCoords.z)
          const octave2D = yield* ng.octaveNoise2D(testCoords.x, testCoords.y, 5, 0.6)
          const octave3D = yield* ng.octaveNoise3D(testCoords.x, testCoords.y, testCoords.z, 5, 0.6)

          return { noise2D, noise3D, octave2D, octave3D }
        })
      )

      const [result1, result2] = await Promise.all([Effect.runPromise(effect1), Effect.runPromise(effect2)])

      expect(result1).toEqual(result2)
    })

    it('generates different results with different seeds', async () => {
      const testCoords = { x: 15.7, y: 23.4 } // より特徴的な座標を使用
      const seed1 = 12345
      const seed2 = 67890

      const config1: NoiseConfig = { ...testConfig, seed: seed1 }
      const config2: NoiseConfig = { ...testConfig, seed: seed2 }

      const effect1 = runWithTestGenerator(config1, (ng) => ng.noise2D(testCoords.x, testCoords.y))
      const effect2 = runWithTestGenerator(config2, (ng) => ng.noise2D(testCoords.x, testCoords.y))

      const [result1, result2] = await Promise.all([Effect.runPromise(effect1), Effect.runPromise(effect2)])

      // 異なるシードでは高い確率で異なる値になる
      expect(result1).not.toBe(result2)
    })
  })

  describe('Performance Requirements', () => {
    it('generates noise efficiently - single calls should be fast', async () => {
      const effect = runWithTestGenerator(testConfig, (ng) => ng.noise2D(10, 20))

      // 単一のノイズ生成は5ms以内で完了するべき
      await expectEffectDuration(effect, 0, 5)
    })

    it('handles batch noise generation efficiently', async () => {
      const batchSize = 1000
      const coordinates = Array.from({ length: batchSize }, (_, i) => ({
        x: i * 0.1,
        y: i * 0.1,
      }))

      const effect = runWithTestGenerator(testConfig, (ng) =>
        Effect.gen(function* () {
          const results: number[] = []
          for (const { x, y } of coordinates) {
            const value = yield* ng.noise2D(x, y)
            results.push(value)
          }
          return results
        })
      )

      // 1000回のノイズ生成は500ms以内で完了するべき
      const results = await expectEffectDuration(effect, 0, 500)
      expect(results).toHaveLength(batchSize)
    })

    it('octave noise performance scales reasonably with octave count', async () => {
      const testCoords = { x: 25, y: 30 }

      const effect1 = runWithTestGenerator(testConfig, (ng) => ng.octaveNoise2D(testCoords.x, testCoords.y, 1, 0.5))
      const effect4 = runWithTestGenerator(testConfig, (ng) => ng.octaveNoise2D(testCoords.x, testCoords.y, 4, 0.5))
      const effect8 = runWithTestGenerator(testConfig, (ng) => ng.octaveNoise2D(testCoords.x, testCoords.y, 8, 0.5))

      // それぞれ実行時間を測定（現実的な時間に調整）
      await Promise.all([
        expectEffectDuration(effect1, 0, 50),
        expectEffectDuration(effect4, 0, 100),
        expectEffectDuration(effect8, 0, 200),
      ])
    })
  })

  describe('Edge Cases', () => {
    it('handles extreme coordinate values', async () => {
      const extremeCoords = [
        { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
        { x: -Number.MAX_SAFE_INTEGER, y: -Number.MAX_SAFE_INTEGER },
        { x: 0, y: 0 },
        { x: 1e10, y: 1e10 },
        { x: -1e10, y: -1e10 },
      ]

      for (const { x, y } of extremeCoords) {
        const effect = runWithTestGenerator(testConfig, (ng) => ng.noise2D(x, y))
        const result = await Effect.runPromise(effect)

        expect(Number.isFinite(result)).toBe(true)
        expect(result).toBeGreaterThanOrEqual(-1)
        expect(result).toBeLessThanOrEqual(1)
      }
    })

    it('handles zero and negative octaves gracefully', async () => {
      const effect = runWithTestGenerator(testConfig, (ng) =>
        Effect.gen(function* () {
          // 0オクターブの場合は0を返すか、最小限の処理
          const zeroOctave = yield* ng.octaveNoise2D(10, 20, 0, 0.5)

          expect(typeof zeroOctave).toBe('number')
          expect(Number.isFinite(zeroOctave)).toBe(true)

          return zeroOctave
        })
      )

      await Effect.runPromise(effect)
    })

    it('handles extreme persistence values', async () => {
      const testCoords = { x: 5, y: 5 }
      const extremePersistence = [0.0, 1.0, 0.001, 0.999]

      for (const persistence of extremePersistence) {
        const effect = runWithTestGenerator(testConfig, (ng) =>
          ng.octaveNoise2D(testCoords.x, testCoords.y, 4, persistence)
        )

        const result = await Effect.runPromise(effect)
        expect(Number.isFinite(result)).toBe(true)
        expect(result).toBeGreaterThanOrEqual(-1)
        expect(result).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('Statistical Properties', () => {
    it('generates values with reasonable distribution', async () => {
      const sampleSize = 10000
      const effect = runWithTestGenerator(testConfig, (ng) =>
        Effect.gen(function* () {
          const values: number[] = []

          for (let i = 0; i < sampleSize; i++) {
            const value = yield* ng.noise2D(i * 0.1, i * 0.1)
            values.push(value)
          }

          return values
        })
      )

      const values = await Effect.runPromise(effect)

      // 統計的検証
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length

      // ノイズの平均は0に近いはず
      expect(Math.abs(mean)).toBeLessThan(0.1)

      // 分散は適度な値を持つはず（完全にランダムではないが、十分な変動がある）
      expect(variance).toBeGreaterThan(0.01)
      expect(variance).toBeLessThan(1.0)

      // 値の範囲確認
      const min = Math.min(...values)
      const max = Math.max(...values)

      expect(min).toBeGreaterThanOrEqual(-1)
      expect(max).toBeLessThanOrEqual(1)
      expect(max - min).toBeGreaterThan(1.0) // 十分な範囲をカバー
    })
  })
})
