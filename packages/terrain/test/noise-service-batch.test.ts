import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect } from 'effect'
import { NoiseService } from '@ts-minecraft/terrain'

describe('infrastructure/noise/noise-service', () => {
  describe('batch helpers — XY batch consistency', () => {
    it.effect('octaveNoise2DBatchXY matches the scalar octaveNoise2D results for the same coordinates', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(12345)

        const xs = [0, 1.5, -3, 42]
        const zs = [0, -2.25, 7, 99]

        const batchVals = yield* service.octaveNoise2DBatchXY(xs, zs, 4, 0.5, 2.0)
        const scalarVals = yield* Effect.forEach(
          Arr.zip(xs, zs),
          ([x, z]) => service.octaveNoise2D(x, z, 4, 0.5, 2.0),
          { concurrency: 1 }
        )

        expect(batchVals).toEqual(scalarVals)
      }).pipe(Effect.provide(NoiseService.Default))
    )

    it.effect('noise2DBatchXY matches the scalar noise2D results for the same coordinates', () =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(9876)

        const xs = [5, 10, 15, 20]
        const zs = [4, 8, 12, 16]

        const batchVals = yield* service.noise2DBatchXY(xs, zs)
        const scalarVals = yield* Effect.forEach(
          Arr.zip(xs, zs),
          ([x, z]) => service.noise2D(x, z),
          { concurrency: 1 }
        )

        expect(batchVals).toEqual(scalarVals)
      }).pipe(Effect.provide(NoiseService.Default))
    )
  })

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
})
