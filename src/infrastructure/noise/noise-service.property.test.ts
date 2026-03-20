import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Effect, Schema } from 'effect'
import { NoiseService } from './noise-service'

const finiteFloat = Arbitrary.make(Schema.Number.pipe(Schema.between(-10000, 10000)))

describe('infrastructure/noise/noise-service — property tests', () => {
  // P-01: noise2D output always in [0, 1] for finite float coordinates
  it.effect.prop(
    'noise2D output is always in [0, 1] for arbitrary coordinates',
    { x: finiteFloat, z: finiteFloat },
    ({ x, z }) =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val = yield* service.noise2D(x, z)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default)),
    { fastCheck: { numRuns: 200 } },
  )

  // P-02: octaveNoise2D output always in [0, 1]
  it.effect.prop(
    'octaveNoise2D output is always in [0, 1] for arbitrary parameters',
    {
      x: finiteFloat,
      z: finiteFloat,
      octaves: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(1, 16))),
      persistence: Arbitrary.make(Schema.Number.pipe(Schema.between(0.1, 0.9))),
      lacunarity: Arbitrary.make(Schema.Number.pipe(Schema.between(1.5, 3.0))),
    },
    ({ x, z, octaves, persistence, lacunarity }) =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val = yield* service.octaveNoise2D(x, z, octaves, persistence, lacunarity)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(NoiseService.Default)),
    { fastCheck: { numRuns: 100 } },
  )

  // P-03: determinism — same seed + same coords produce the same value in one Effect chain
  it.effect.prop(
    'noise2D is deterministic: same seed and coords always produce the same value',
    {
      seed: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, 4294967295))),
      x: finiteFloat,
      z: finiteFloat,
    },
    ({ seed, x, z }) =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        yield* service.setSeed(seed)
        const val1 = yield* service.noise2D(x, z)
        const val2 = yield* service.noise2D(x, z)
        expect(val1).toBe(val2)
      }).pipe(Effect.provide(NoiseService.Default)),
    { fastCheck: { numRuns: 100 } },
  )

  // P-04: spatial continuity — small coordinate delta produces small value change
  // Perlin noise is C^2 continuous; a 0.01 step produces at most ~0.1 normalized change.
  // Both values are queried from the same service instance to ensure the same perm table.
  it.effect.prop(
    'noise2D is spatially continuous: small coordinate change produces small value change',
    {
      x: Arbitrary.make(Schema.Number.pipe(Schema.between(-100, 100))),
      z: Arbitrary.make(Schema.Number.pipe(Schema.between(-100, 100))),
    },
    ({ x, z }) =>
      Effect.gen(function* () {
        const service = yield* NoiseService
        const val0 = yield* service.noise2D(x, z)
        const val1 = yield* service.noise2D(x + 0.01, z)
        expect(Math.abs(val1 - val0)).toBeLessThan(0.1)
      }).pipe(Effect.provide(NoiseService.Default)),
    { fastCheck: { numRuns: 200 } },
  )
})
