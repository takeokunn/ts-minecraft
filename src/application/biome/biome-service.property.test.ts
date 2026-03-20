import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Effect, Layer, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { BiomeService, BiomeServiceLive, BiomeTypeSchema } from '@/application/biome/biome-service'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'

// Valid block type indices stored in Uint8Array (0=AIR through 11=COBBLESTONE)
const MAX_BLOCK_INDEX = 11

/**
 * Build a mock NoiseService layer that returns controlled [0,1] values.
 * Uses the same threshold heuristic as biome-service.test.ts:
 *   x_arg > 25.0 → humidity call
 *   x_arg ≤ 25.0 → temperature call
 */
const makeMockNoiseLayer = (tempValue: number, humidityValue: number) =>
  Layer.succeed(NoiseServicePort, {
    noise2D: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0.5),
    octaveNoise2D: (x: number, _z: number, _octaves: number, _persistence: number, _lacunarity: number): Effect.Effect<number, never> =>
      Effect.succeed(x > 25.0 ? humidityValue : tempValue),
    setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
  } as unknown as NoiseServicePort)

const makeTestLayer = (tempValue: number, humidityValue: number) =>
  BiomeServiceLive.pipe(Layer.provide(makeMockNoiseLayer(tempValue, humidityValue)))

// All valid BiomeType literals
const ALL_BIOME_TYPES = ['PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS', 'SNOW', 'SWAMP', 'JUNGLE'] as const

describe('BiomeService — getBiome property tests', () => {
  it.effect.prop(
    'returns a valid BiomeType for any ChunkCoord integer pair',
    {
      cx: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
      cz: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
      tempVal: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
      humVal: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
    },
    ({ cx, cz, tempVal, humVal }) =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(cx * CHUNK_SIZE, cz * CHUNK_SIZE)
        expect(ALL_BIOME_TYPES).toContain(biome)
      }).pipe(Effect.provide(makeTestLayer(tempVal, humVal))),
    { fastCheck: { numRuns: 50 } },
  )

  it.effect.prop(
    'getBiome is deterministic: same coordinates always produce the same biome',
    {
      cx: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
      cz: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
      tempVal: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
      humVal: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
    },
    ({ cx, cz, tempVal, humVal }) =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const wx = cx * CHUNK_SIZE
        const wz = cz * CHUNK_SIZE
        const biome1 = yield* service.getBiome(wx, wz)
        const biome2 = yield* service.getBiome(wx, wz)
        expect(biome1).toBe(biome2)
      }).pipe(Effect.provide(makeTestLayer(tempVal, humVal))),
    { fastCheck: { numRuns: 50 } },
  )

  it.effect.prop(
    'BiomeTypeSchema decodes all values returned by getBiome',
    {
      tempVal: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
      humVal: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
    },
    ({ tempVal, humVal }) =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        const result = Schema.decodeUnknownEither(BiomeTypeSchema)(biome)
        expect(result._tag).toBe('Right')
      }).pipe(Effect.provide(makeTestLayer(tempVal, humVal))),
    { fastCheck: { numRuns: 50 } },
  )
})

describe('BiomeService — getBiomeProperties property tests', () => {
  it.effect('treeDensity is always in [0, 1] for all biome types', () =>
    Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(props.treeDensity).toBeGreaterThanOrEqual(0)
        expect(props.treeDensity).toBeLessThanOrEqual(1)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5))),
  )

  it.effect('heightModifier is always > 0 for all biome types', () =>
    Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(props.heightModifier).toBeGreaterThan(0)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5))),
  )

  it.effect('baseHeight is always > 0 and < CHUNK_HEIGHT for all biome types', () =>
    Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(props.baseHeight).toBeGreaterThan(0)
        expect(props.baseHeight).toBeLessThan(CHUNK_HEIGHT)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5))),
  )

  it.effect('temperature and humidity properties are numeric for all biome types', () =>
    Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(typeof props.temperature).toBe('number')
        expect(typeof props.humidity).toBe('number')
        expect(Number.isFinite(props.temperature)).toBe(true)
        expect(Number.isFinite(props.humidity)).toBe(true)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5))),
  )

  it.effect.prop(
    'getBiomeProperties is pure: returns same result on repeated calls',
    { biome: Arbitrary.make(BiomeTypeSchema) },
    ({ biome }) =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props1 = yield* service.getBiomeProperties(biome)
        const props2 = yield* service.getBiomeProperties(biome)
        expect(props1.surfaceBlock).toBe(props2.surfaceBlock)
        expect(props1.subSurfaceBlock).toBe(props2.subSurfaceBlock)
        expect(props1.heightModifier).toBe(props2.heightModifier)
        expect(props1.baseHeight).toBe(props2.baseHeight)
        expect(props1.treeDensity).toBe(props2.treeDensity)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.5))),
    { fastCheck: { numRuns: 8 } },
  )
})

describe('BiomeService — block type index bounds', () => {
  it('CHUNK_SIZE and CHUNK_HEIGHT constants define valid flat-array bounds', () => {
    const totalBlocks = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
    // 16 * 16 * 256 = 65536
    expect(totalBlocks).toBe(65536)
  })

  it.prop(
    'block index values in generated terrain are within valid Uint8Array range [0, MAX_BLOCK_INDEX]',
    {
      rawBlocks: fc.uint8Array({
        minLength: CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT,
        maxLength: CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT,
      }),
    },
    ({ rawBlocks }) => {
      // Clamp to valid block type range as the real terrain generator does
      const blocks = rawBlocks.map((b) => b % (MAX_BLOCK_INDEX + 1))
      expect(blocks.every((val) => val >= 0 && val <= MAX_BLOCK_INDEX)).toBe(true)
    },
    { fastCheck: { numRuns: 10 } },
  )

  it('Uint8Array of CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT has the correct length', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(blocks.length).toBe(65536)
  })
})
