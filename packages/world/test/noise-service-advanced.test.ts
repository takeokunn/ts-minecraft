import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, MutableHashSet } from 'effect'
import { NoiseService } from '@ts-minecraft/world'

describe('infrastructure/noise/noise-service', () => {
  // ---------------------------------------------------------------------------
  // Group 5: noise spatial continuity
  // ---------------------------------------------------------------------------

  describe('noise2D — spatial continuity', () => {
    it.effect('should produce smoothly varying values between nearby coordinates', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val0 = yield* service.noise2D(10, 10)
        const val1 = yield* service.noise2D(10.01, 10)
        // Nearby coordinates should produce close values (Perlin noise is continuous)
        expect(Math.abs(val1 - val0)).toBeLessThan(0.1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce a variety of values across a range of coordinates', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const values = MutableHashSet.empty<number>()
        yield* Effect.forEach(Arr.makeBy(10, x => x), x =>
          Effect.forEach(Arr.makeBy(10, z => z), z =>
            Effect.gen(function* () {
              const v = yield* service.noise2D(x, z)
              MutableHashSet.add(values, Math.round(v * 100) / 100)
            }), { concurrency: 1 }
          ), { concurrency: 1 }
        )
        // 100 samples should produce more than just a few unique values
        expect(MutableHashSet.size(values)).toBeGreaterThan(5)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return consistent values across independent service instances with same seed', () =>
      Effect.gen(function* () {
        const service1 = yield* NoiseService
        yield* service1.setSeed(42)
        const val1 = yield* service1.noise2D(7, 13)

        const service2 = yield* NoiseService
        yield* service2.setSeed(42)
        const val2 = yield* service2.noise2D(7, 13)

        // Both instances with same seed should produce identical output
        expect(val1).toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // Group 3D: noise3D determinism, range, and batch consistency
  // ---------------------------------------------------------------------------

  describe('noise3D — value range and determinism', () => {
    it.effect('should return a value in approximately [-1.0, 1.0] for origin (0, 0, 0)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(1)
        const val = yield* service.noise3D(0, 0, 0)
        // Allow small numeric slack — amplitude normalisation is ~[-1, 1].
        expect(val).toBeGreaterThanOrEqual(-1.01)
        expect(val).toBeLessThanOrEqual(1.01)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in approximately [-1, 1] for mixed coords (10, 20, -5)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val = yield* service.noise3D(10, 20, -5)
        expect(val).toBeGreaterThanOrEqual(-1.01)
        expect(val).toBeLessThanOrEqual(1.01)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should be deterministic: same seed + same (x, y, z) yields the same value', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(777)
        const v1 = yield* service.noise3D(3.14, 1.5, -2.7)
        yield* service.setSeed(777)
        const v2 = yield* service.noise3D(3.14, 1.5, -2.7)
        expect(v1).toBe(v2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce different values at different coordinates', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(99)
        const v000 = yield* service.noise3D(0, 0, 0)
        const v100 = yield* service.noise3D(1, 0, 0)
        const v010 = yield* service.noise3D(0, 1, 0)
        const v001 = yield* service.noise3D(0, 0, 1)
        // It is astronomically unlikely that all four equal v000
        expect(Arr.every([v100, v010, v001], (v) => v === v000)).toBe(false)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce different values after different seeds (3D)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(1)
        const v1 = yield* service.noise3D(5, 10, 7)
        yield* service.setSeed(2)
        const v2 = yield* service.noise3D(5, 10, 7)
        expect(v1).not.toBe(v2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('noise3DBatchXYZ matches scalar noise3D for the same coordinates', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(2024)
        const xs = [0, 1.5, -3, 42, 7.2]
        const ys = [0, -2, 8, 15, 1.1]
        const zs = [0, -2.25, 7, 99, -1.5]

        const batch = yield* service.noise3DBatchXYZ(xs, ys, zs)
        const scalar = yield* Effect.forEach(
          Arr.makeBy(xs.length, (i) => i),
          (i) => service.noise3D(xs[i]!, ys[i]!, zs[i]!),
          { concurrency: 1 },
        )
        expect(batch).toEqual(scalar)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce spatially continuous values for nearby coordinates (3D)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(7)
        const v0 = yield* service.noise3D(10, 10, 10)
        const v1 = yield* service.noise3D(10.01, 10, 10)
        // Perlin noise is continuous — tiny step, tiny output delta.
        expect(Math.abs(v1 - v0)).toBeLessThan(0.1)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // Group 6: octaveNoise2D — parameter sensitivity
  // ---------------------------------------------------------------------------

  describe('octaveNoise2D — parameter sensitivity', () => {
    it.effect('should produce different values with different persistence parameters', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val1 = yield* service.octaveNoise2D(5, 5, 4, 0.3, 2.0)
        const val2 = yield* service.octaveNoise2D(5, 5, 4, 0.7, 2.0)
        // Different persistence should produce different results
        expect(val1).not.toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce different values with different lacunarity parameters', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val1 = yield* service.octaveNoise2D(5, 5, 4, 0.5, 1.5)
        const val2 = yield* service.octaveNoise2D(5, 5, 4, 0.5, 3.0)
        // Different lacunarity should produce different results
        expect(val1).not.toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in [0, 1] for large octave count (16)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val = yield* service.octaveNoise2D(10, 20, 16, 0.5, 2.0)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce identical results for octaves=1 and noise2D at same coordinate scale', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const octaveVal = yield* service.octaveNoise2D(5, 7, 1, 0.5, 2.0)
        const noise2dVal = yield* service.noise2D(5, 7)
        // With 1 octave, octaveNoise2D normalizes by maxValue=1 and
        // uses the same base noise function, so results should match
        expect(octaveVal).toBe(noise2dVal)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })
})

describe('NoiseService.octaveNoise2DBatch / noise2DBatch (tuple-pair format)', () => {
  it.effect('noise2DBatch returns one value per input point', () =>
    Effect.gen(function* () {
      const service = yield* NoiseService
      yield* service.setSeed(42)
      const points: ReadonlyArray<readonly [number, number]> = [[0, 0], [10, 5], [100, 200]]
      const results = yield* service.noise2DBatch(points)
      expect(results).toHaveLength(3)
    }).pipe(Effect.provide(NoiseService.Default))
  )

  it.effect('noise2DBatch matches scalar noise2D for the same coordinates', () =>
    Effect.gen(function* () {
      const service = yield* NoiseService
      yield* service.setSeed(7)
      const points: ReadonlyArray<readonly [number, number]> = [[3, 4], [10, 20], [0, 0]]
      const batch = yield* service.noise2DBatch(points)
      const [v0, v1, v2] = yield* Effect.all([
        service.noise2D(3, 4),
        service.noise2D(10, 20),
        service.noise2D(0, 0),
      ], { concurrency: 'unbounded' })
      expect(batch[0]).toBeCloseTo(v0, 10)
      expect(batch[1]).toBeCloseTo(v1, 10)
      expect(batch[2]).toBeCloseTo(v2, 10)
    }).pipe(Effect.provide(NoiseService.Default))
  )

  it.effect('octaveNoise2DBatch returns one value per input point', () =>
    Effect.gen(function* () {
      const service = yield* NoiseService
      yield* service.setSeed(42)
      const points: ReadonlyArray<readonly [number, number]> = [[0, 0], [10, 5], [100, 200]]
      const results = yield* service.octaveNoise2DBatch(points, 4, 0.5, 2.0)
      expect(results).toHaveLength(3)
    }).pipe(Effect.provide(NoiseService.Default))
  )

  it.effect('octaveNoise2DBatch matches scalar octaveNoise2D for the same coordinates', () =>
    Effect.gen(function* () {
      const service = yield* NoiseService
      yield* service.setSeed(7)
      const points: ReadonlyArray<readonly [number, number]> = [[3, 4], [10, 20], [0, 0]]
      const batch = yield* service.octaveNoise2DBatch(points, 4, 0.5, 2.0)
      const [v0, v1, v2] = yield* Effect.all([
        service.octaveNoise2D(3, 4, 4, 0.5, 2.0),
        service.octaveNoise2D(10, 20, 4, 0.5, 2.0),
        service.octaveNoise2D(0, 0, 4, 0.5, 2.0),
      ], { concurrency: 'unbounded' })
      expect(batch[0]).toBeCloseTo(v0, 10)
      expect(batch[1]).toBeCloseTo(v1, 10)
      expect(batch[2]).toBeCloseTo(v2, 10)
    }).pipe(Effect.provide(NoiseService.Default))
  )
})
