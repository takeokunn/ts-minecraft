import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { NoiseService } from './noise-service'

// ---------------------------------------------------------------------------
// Group 1: noise2D value range
// ---------------------------------------------------------------------------

describe('infrastructure/noise/noise-service', () => {
  describe('noise2D — value range [0, 1]', () => {
    it.effect('should return a value in [0.0, 1.0] for origin (0, 0)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val = yield* service.noise2D(0, 0)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in [0.0, 1.0] for large positive coordinates (100, 200)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val = yield* service.noise2D(100, 200)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in [0.0, 1.0] for negative coordinates (-50, -50)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val = yield* service.noise2D(-50, -50)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in [0.0, 1.0] for fractional coordinates (0.5, 0.75)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val = yield* service.noise2D(0.5, 0.75)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return the same value for the same coordinates called twice (deterministic within session)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val1 = yield* service.noise2D(7, 13)
        const val2 = yield* service.noise2D(7, 13)
        expect(val1).toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return different values for different coordinates in general', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val1 = yield* service.noise2D(0, 0)
        const val2 = yield* service.noise2D(1, 0)
        const val3 = yield* service.noise2D(0, 1)
        // It is astronomically unlikely that all three equal the same value
        expect([val1, val2, val3].every((v) => v === val1)).toBe(false)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // Group 2: setSeed reproducibility
  // ---------------------------------------------------------------------------

  describe('setSeed — reproducibility and isolation', () => {
    it.effect('should produce the same noise value for same coordinates after same seed', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val1 = yield* service.noise2D(1, 1)
        yield* service.setSeed(42)
        const val2 = yield* service.noise2D(1, 1)
        expect(val1).toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce the same noise for same seed across different coordinate sets', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(100)
        const a1 = yield* service.noise2D(3, 7)
        const a2 = yield* service.noise2D(-1, 5)
        yield* service.setSeed(100)
        const b1 = yield* service.noise2D(3, 7)
        const b2 = yield* service.noise2D(-1, 5)
        expect(a1).toBe(b1)
        expect(a2).toBe(b2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce different noise at same coordinate after different seeds', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val42 = yield* service.noise2D(5, 7)
        yield* service.setSeed(99)
        const val99 = yield* service.noise2D(5, 7)
        expect(val42).not.toBe(val99)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should restore original results when re-seeding with the same seed', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val1 = yield* service.noise2D(5, 7)
        yield* service.setSeed(99)
        const val2 = yield* service.noise2D(5, 7)
        yield* service.setSeed(42)
        const val3 = yield* service.noise2D(5, 7)
        expect(val1).toBe(val3)
        expect(val1).not.toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return values in [0.0, 1.0] after setSeed', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(777)
        const val = yield* service.noise2D(10, 20)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // Group 3: octaveNoise2D
  // ---------------------------------------------------------------------------

  describe('octaveNoise2D — value range and behavior', () => {
    it.effect('should return a value in [0.0, 1.0] for octaves=1', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(1)
        const val = yield* service.octaveNoise2D(0, 0, 1, 0.5, 2.0)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in [0.0, 1.0] for octaves=3', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(2)
        const val = yield* service.octaveNoise2D(10, 20, 3, 0.5, 2.0)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in [0.0, 1.0] for octaves=8', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(3)
        const val = yield* service.octaveNoise2D(-5, 30, 8, 0.5, 2.0)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should return a value in [0.0, 1.0] with default biome parameters', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        // Typical biome-service call: octaveNoise2D(x * 0.005, z * 0.005, 4, 0.5, 2.0)
        const val = yield* service.octaveNoise2D(0, 0, 4, 0.5, 2.0) // origin (0,0) scaled by 0.005 = 0
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce different values with different octave counts at same coordinates', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(55)
        const val1 = yield* service.octaveNoise2D(5, 5, 1, 0.5, 2.0)
        const val8 = yield* service.octaveNoise2D(5, 5, 8, 0.5, 2.0)
        // Different octave counts virtually always produce different values
        expect(val1).not.toBe(val8)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should be reproducible after setSeed for octaveNoise2D', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const val1 = yield* service.octaveNoise2D(10, 20, 4, 0.5, 2.0)
        yield* service.setSeed(42)
        const val2 = yield* service.octaveNoise2D(10, 20, 4, 0.5, 2.0)
        expect(val1).toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should produce different octaveNoise2D values after different seeds', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(1)
        const val1 = yield* service.octaveNoise2D(10, 20, 4, 0.5, 2.0)
        yield* service.setSeed(2)
        const val2 = yield* service.octaveNoise2D(10, 20, 4, 0.5, 2.0)
        expect(val1).not.toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // Group 4: setSeed Effect wrapping
  // ---------------------------------------------------------------------------

  describe('setSeed — Effect contract', () => {
    it.effect('should accept seed value of 0 without error', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(0)
        const val = yield* service.noise2D(1, 1)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should accept maximum uint32 seed value (4294967295) without error', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(4294967295)
        const val = yield* service.noise2D(0, 0)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should allow chaining setSeed calls sequentially', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(10)
        yield* service.setSeed(20)
        yield* service.setSeed(30)
        const val = yield* service.noise2D(0, 0)
        // After three setSeed calls, should still produce a valid in-range value
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('should confirm setSeed returns Effect<void, never> (yielding does not throw)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const result = yield* service.setSeed(123)
        // setSeed returns Effect<void, never>; the yielded value is undefined
        expect(result).toBeUndefined()
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

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
        const values = new Set<number>()
        for (let x = 0; x < 10; x++) {
          for (let z = 0; z < 10; z++) {
            values.add(Math.round((yield* service.noise2D(x, z)) * 100) / 100)
          }
        }
        // 100 samples should produce more than just a few unique values
        expect(values.size).toBeGreaterThan(5)
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
