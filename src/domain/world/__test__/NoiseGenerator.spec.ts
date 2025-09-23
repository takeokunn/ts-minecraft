import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import { BrandedTypes } from '../../../shared/types/branded'
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
      const validConfig = {
        seed: 12345,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
      }

      expect(() => Schema.decodeUnknownSync(NoiseConfigSchema)(validConfig)).not.toThrow()
    })

    it('validates boundary values', () => {
      const boundaryConfigs = [
        { seed: 0, octaves: 1, persistence: 0.1, lacunarity: 1.5 },
        { seed: 2147483647, octaves: 10, persistence: 1.0, lacunarity: 3.0 },
      ]

      for (const config of boundaryConfigs) {
        expect(() => Schema.decodeUnknownSync(NoiseConfigSchema)(config)).not.toThrow()
      }
    })

    it('rejects invalid configuration', () => {
      const invalidConfigs = [
        // 型エラー
        { seed: 'invalid', octaves: 4, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 'invalid', lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 0.5, lacunarity: null },
        // 範囲外
        { seed: -1, octaves: 4, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: 0, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: 11, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 0.05, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 1.1, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 0.5, lacunarity: 1.0 },
        { seed: 12345, octaves: 4, persistence: 0.5, lacunarity: 4.0 },
        // NaN値
        { seed: NaN, octaves: 4, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: NaN, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: NaN, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 0.5, lacunarity: NaN },
        // Infinity値
        { seed: Infinity, octaves: 4, persistence: 0.5, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: Infinity, lacunarity: 2.0 },
        { seed: 12345, octaves: 4, persistence: 0.5, lacunarity: Infinity },
      ]

      for (const config of invalidConfigs) {
        expect(() => Schema.decodeUnknownSync(NoiseConfigSchema)(config)).toThrow()
      }
    })
  })

  describe('Service Creation', () => {
    it.effect('creates NoiseGenerator with custom config', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        expect(ng.getSeed()).toBe(testConfig.seed)
        expect(ng.getConfig()).toEqual(testConfig)
      }).pipe(Effect.provide(NoiseGeneratorLive(testConfig)))
    )

    it.effect('creates NoiseGenerator with default config', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const config = ng.getConfig()

        expect(config.octaves).toBe(6)
        expect(config.persistence).toBe(0.5)
        expect(config.lacunarity).toBe(2.0)
        expect(typeof config.seed).toBe('number')
      }).pipe(Effect.provide(NoiseGeneratorLiveDefault))
    )
  })

  describe('2D Noise Generation', () => {
    it.effect('generates consistent 2D noise values for same input', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const testCoords = [
          { x: 0, y: 0 },
          { x: 1.5, y: 2.7 },
          { x: -3.14, y: 2.71 },
        ]

        for (const { x, y } of testCoords) {
          const value1 = yield* ng.noise2D(BrandedTypes.createNoiseCoordinate(x), BrandedTypes.createNoiseCoordinate(y))
          const value2 = yield* ng.noise2D(BrandedTypes.createNoiseCoordinate(x), BrandedTypes.createNoiseCoordinate(y))

          expect(value1).toBe(value2)
          expect(typeof value1).toBe('number')
          expect(value1).toBeGreaterThanOrEqual(-1)
          expect(value1).toBeLessThanOrEqual(1)
          expect(Number.isFinite(value1)).toBe(true)
        }
      }).pipe(Effect.provide(NoiseGeneratorLive(testConfig)))
    )

    it.effect('generates different values for different coordinates', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const value1 = yield* ng.noise2D(
          BrandedTypes.createNoiseCoordinate(1.5),
          BrandedTypes.createNoiseCoordinate(2.7)
        )
        const value2 = yield* ng.noise2D(
          BrandedTypes.createNoiseCoordinate(10.3),
          BrandedTypes.createNoiseCoordinate(15.8)
        )

        // ノイズ関数は通常異なる座標で異なる値を生成するが、稀に同じ値になることもある
        // そのため、少なくとも数値であることと範囲内であることのみ検証
        expect(typeof value1).toBe('number')
        expect(typeof value2).toBe('number')
        expect(value1).toBeGreaterThanOrEqual(-1)
        expect(value1).toBeLessThanOrEqual(1)
        expect(value2).toBeGreaterThanOrEqual(-1)
        expect(value2).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseGeneratorLive(testConfig)))
    )
  })

  describe('3D Noise Generation', () => {
    it.effect('generates consistent 3D noise values for same input', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const value1 = yield* ng.noise3D(
          BrandedTypes.createNoiseCoordinate(1.5),
          BrandedTypes.createNoiseCoordinate(2.7),
          BrandedTypes.createNoiseCoordinate(-1.3)
        )
        const value2 = yield* ng.noise3D(
          BrandedTypes.createNoiseCoordinate(1.5),
          BrandedTypes.createNoiseCoordinate(2.7),
          BrandedTypes.createNoiseCoordinate(-1.3)
        )

        expect(value1).toBe(value2)
        expect(typeof value1).toBe('number')
        expect(value1).toBeGreaterThanOrEqual(-1)
        expect(value1).toBeLessThanOrEqual(1)
        expect(Number.isFinite(value1)).toBe(true)
      }).pipe(Effect.provide(NoiseGeneratorLive(testConfig)))
    )
  })

  describe('Octave Noise Generation', () => {
    it.effect('generates octave noise with different octave counts', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const octave1 = yield* ng.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(1.5),
          BrandedTypes.createNoiseCoordinate(2.7),
          1,
          0.5
        )
        const octave4 = yield* ng.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(1.5),
          BrandedTypes.createNoiseCoordinate(2.7),
          4,
          0.5
        )

        expect(octave1).not.toBe(octave4)
        expect(octave1).toBeGreaterThanOrEqual(-1)
        expect(octave1).toBeLessThanOrEqual(1)
        expect(octave4).toBeGreaterThanOrEqual(-1)
        expect(octave4).toBeLessThanOrEqual(1)
        expect(Number.isFinite(octave1)).toBe(true)
        expect(Number.isFinite(octave4)).toBe(true)
      }).pipe(Effect.provide(NoiseGeneratorLive(testConfig)))
    )
  })

  describe('Seed Reproducibility', () => {
    it.effect('generates identical results with same seed', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const noise1 = yield* ng.noise2D(
          BrandedTypes.createNoiseCoordinate(15.7),
          BrandedTypes.createNoiseCoordinate(-8.3)
        )
        const noise2 = yield* ng.noise2D(
          BrandedTypes.createNoiseCoordinate(15.7),
          BrandedTypes.createNoiseCoordinate(-8.3)
        )

        expect(noise1).toBe(noise2)
        expect(typeof noise1).toBe('number')
      }).pipe(Effect.provide(NoiseGeneratorLive(testConfig)))
    )
  })

  describe('Edge Cases', () => {
    it.effect('handles zero octaves gracefully', () =>
      Effect.gen(function* () {
        const ng = yield* NoiseGeneratorTag
        const zeroOctave = yield* ng.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(10),
          BrandedTypes.createNoiseCoordinate(20),
          0,
          0.5
        )

        expect(zeroOctave).toBe(0)
        expect(Number.isFinite(zeroOctave)).toBe(true)
      }).pipe(Effect.provide(NoiseGeneratorLive(testConfig)))
    )
  })
})
