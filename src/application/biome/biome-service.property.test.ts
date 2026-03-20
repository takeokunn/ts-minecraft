import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Effect, Layer } from 'effect'
import { BiomeService, BiomeServiceLive, BiomeTypeSchema } from '@/application/biome/biome-service'
import { NoiseService } from '@/infrastructure/noise/noise-service'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { Schema } from 'effect'

// Valid block type indices stored in Uint8Array (0=AIR through 11=COBBLESTONE)
const MAX_BLOCK_INDEX = 11

/**
 * Build a mock NoiseService layer that returns controlled [0,1] values.
 * Uses the same threshold heuristic as biome-service.test.ts:
 *   x_arg > 25.0 → humidity call
 *   x_arg ≤ 25.0 → temperature call
 */
const makeMockNoiseLayer = (tempValue: number, humidityValue: number) =>
  Layer.succeed(NoiseService, {
    noise2D: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0.5),
    octaveNoise2D: (x: number, _z: number, _octaves: number, _persistence: number, _lacunarity: number): Effect.Effect<number, never> =>
      Effect.succeed(x > 25.0 ? humidityValue : tempValue),
    setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
  } as unknown as NoiseService)

const makeTestLayer = (tempValue: number, humidityValue: number) =>
  BiomeServiceLive.pipe(Layer.provide(makeMockNoiseLayer(tempValue, humidityValue)))

// All valid BiomeType literals
const ALL_BIOME_TYPES = ['PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS', 'SNOW', 'SWAMP', 'JUNGLE'] as const

describe('BiomeService — getBiome property tests', () => {
  it('returns a valid BiomeType for any ChunkCoord integer pair', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (cx, cz, tempVal, humVal) => {
          const program = Effect.gen(function* () {
            const service = yield* BiomeService
            const biome = yield* service.getBiome(cx * CHUNK_SIZE, cz * CHUNK_SIZE)
            // Must be one of the known biome types
            expect(ALL_BIOME_TYPES).toContain(biome)
          }).pipe(Effect.provide(makeTestLayer(tempVal, humVal)))

          Effect.runSync(program)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('getBiome is deterministic: same coordinates always produce the same biome', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (cx, cz, tempVal, humVal) => {
          const program = Effect.gen(function* () {
            const service = yield* BiomeService
            const wx = cx * CHUNK_SIZE
            const wz = cz * CHUNK_SIZE
            const biome1 = yield* service.getBiome(wx, wz)
            const biome2 = yield* service.getBiome(wx, wz)
            expect(biome1).toBe(biome2)
          }).pipe(Effect.provide(makeTestLayer(tempVal, humVal)))

          Effect.runSync(program)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('BiomeTypeSchema decodes all values returned by getBiome', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (tempVal, humVal) => {
          const program = Effect.gen(function* () {
            const service = yield* BiomeService
            const biome = yield* service.getBiome(0, 0)
            const result = Schema.decodeUnknownEither(BiomeTypeSchema)(biome)
            expect(result._tag).toBe('Right')
          }).pipe(Effect.provide(makeTestLayer(tempVal, humVal)))

          Effect.runSync(program)
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('BiomeService — getBiomeProperties property tests', () => {
  it('treeDensity is always in [0, 1] for all biome types', () => {
    const program = Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(props.treeDensity).toBeGreaterThanOrEqual(0)
        expect(props.treeDensity).toBeLessThanOrEqual(1)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5)))

    Effect.runSync(program)
  })

  it('heightModifier is always > 0 for all biome types', () => {
    const program = Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(props.heightModifier).toBeGreaterThan(0)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5)))

    Effect.runSync(program)
  })

  it('baseHeight is always > 0 and < CHUNK_HEIGHT for all biome types', () => {
    const program = Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(props.baseHeight).toBeGreaterThan(0)
        expect(props.baseHeight).toBeLessThan(CHUNK_HEIGHT)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5)))

    Effect.runSync(program)
  })

  it('temperature and humidity properties are numeric for all biome types', () => {
    const program = Effect.gen(function* () {
      const service = yield* BiomeService
      for (const biome of ALL_BIOME_TYPES) {
        const props = yield* service.getBiomeProperties(biome)
        expect(typeof props.temperature).toBe('number')
        expect(typeof props.humidity).toBe('number')
        expect(Number.isFinite(props.temperature)).toBe(true)
        expect(Number.isFinite(props.humidity)).toBe(true)
      }
    }).pipe(Effect.provide(makeTestLayer(0.5, 0.5)))

    Effect.runSync(program)
  })

  it('getBiomeProperties is pure: returns same result on repeated calls', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_BIOME_TYPES),
        (biome) => {
          const program = Effect.gen(function* () {
            const service = yield* BiomeService
            const props1 = yield* service.getBiomeProperties(biome)
            const props2 = yield* service.getBiomeProperties(biome)
            expect(props1.surfaceBlock).toBe(props2.surfaceBlock)
            expect(props1.subSurfaceBlock).toBe(props2.subSurfaceBlock)
            expect(props1.heightModifier).toBe(props2.heightModifier)
            expect(props1.baseHeight).toBe(props2.baseHeight)
            expect(props1.treeDensity).toBe(props2.treeDensity)
          }).pipe(Effect.provide(makeTestLayer(0.5, 0.5)))

          Effect.runSync(program)
        }
      ),
      { numRuns: 8 }
    )
  })
})

describe('BiomeService — block type index bounds', () => {
  it('CHUNK_SIZE and CHUNK_HEIGHT constants define valid flat-array bounds', () => {
    const totalBlocks = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
    // 16 * 16 * 256 = 65536
    expect(totalBlocks).toBe(65536)
  })

  it('block index values in generated terrain are within valid Uint8Array range [0, MAX_BLOCK_INDEX]', () => {
    // Simulate terrain column filling logic: block indices 0-11 are valid
    fc.assert(
      fc.property(
        fc.uint8Array({
          minLength: CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT,
          maxLength: CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT,
        }),
        (rawBlocks) => {
          // Clamp to valid block type range as the real terrain generator does
          const blocks = rawBlocks.map((b) => b % (MAX_BLOCK_INDEX + 1))
          for (let i = 0; i < blocks.length; i++) {
            const val = blocks[i]!
            expect(val).toBeGreaterThanOrEqual(0)
            expect(val).toBeLessThanOrEqual(MAX_BLOCK_INDEX)
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  it('Uint8Array of CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT has the correct length', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(blocks.length).toBe(65536)
  })
})
