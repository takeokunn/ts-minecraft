import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect } from 'effect'
import { NoiseService } from '@ts-minecraft/terrain'

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
        expect(Arr.every([val1, val2, val3], (v) => v === val1)).toBe(false)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // Group 2: setSeed reproducibility
  // ---------------------------------------------------------------------------

  describe('getSeed — returns current seed value', () => {
    it.effect('returns 0 before any setSeed call (default seed)', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const seed = yield* service.getSeed()
        expect(seed).toBe(0)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('returns the seed set by the most recent setSeed call', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(42)
        const seed = yield* service.getSeed()
        expect(seed).toBe(42)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('reflects the latest setSeed after multiple calls', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(100)
        yield* service.setSeed(999)
        const seed = yield* service.getSeed()
        expect(seed).toBe(999)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

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
})
