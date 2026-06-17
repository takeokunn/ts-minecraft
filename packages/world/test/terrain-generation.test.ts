import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Schema } from 'effect'
import { CHUNK_HEIGHT } from '@ts-minecraft/core'
import {
  TerrainGenerationInputSchema,
  NoiseServicePort,
  buildTerrainLayer,
} from '@ts-minecraft/world'

// ---------------------------------------------------------------------------
// TerrainGenerationInputSchema — validation
// ---------------------------------------------------------------------------

describe('application/terrain/terrain-generation — TerrainGenerationInputSchema', () => {
  it('accepts valid input with origin chunk', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: 48,
      lakeLevel: 62,
      seed: 12345,
    })
    expect(input.coord).toEqual({ x: 0, z: 0 })
    expect(input.seaLevel).toBe(48)
    expect(input.lakeLevel).toBe(62)
    expect(input.seed).toBe(12345)
  })

  it('accepts seaLevel at boundary 0', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: 0,
      lakeLevel: 0,
      seed: 1,
    })
    expect(input.seaLevel).toBe(0)
  })

  it('accepts seaLevel at boundary CHUNK_HEIGHT - 1 (255)', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: CHUNK_HEIGHT - 1,
      lakeLevel: 0,
      seed: 1,
    })
    expect(input.seaLevel).toBe(CHUNK_HEIGHT - 1)
  })

  it('rejects seaLevel below 0', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: -1,
        lakeLevel: 48,
        seed: 1,
      })
    ).toThrow()
  })

  it('rejects seaLevel above CHUNK_HEIGHT - 1 (256)', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: CHUNK_HEIGHT,
        lakeLevel: 48,
        seed: 1,
      })
    ).toThrow()
  })

  it('rejects fractional seaLevel (not integer)', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: 48.5,
        lakeLevel: 62,
        seed: 1,
      })
    ).toThrow()
  })

  it('rejects fractional seed (not integer)', () => {
    expect(() =>
      Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
        coord: { x: 0, z: 0 },
        seaLevel: 48,
        lakeLevel: 62,
        seed: 1.5,
      })
    ).toThrow()
  })

  it('accepts negative seed values (seeds are integers, no lower bound)', () => {
    const input = Schema.decodeUnknownSync(TerrainGenerationInputSchema)({
      coord: { x: 0, z: 0 },
      seaLevel: 48,
      lakeLevel: 62,
      seed: -99999,
    })
    expect(input.seed).toBe(-99999)
  })
})

describe('buildTerrainLayer — NoiseServicePort octaveNoise2DBatch / noise2DBatch', () => {
  it.effect('noise2DBatch via buildTerrainLayer returns one value per point', () =>
    Effect.gen(function* () {
      const noisePort = yield* NoiseServicePort
      const points: ReadonlyArray<readonly [number, number]> = [[0, 0], [10, 5], [100, 200]]
      const results = yield* noisePort.noise2DBatch(points)
      expect(results).toHaveLength(3)
      results.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      })
    }).pipe(Effect.provide(buildTerrainLayer(42)))
  )

  it.effect('octaveNoise2DBatch via buildTerrainLayer matches scalar octaveNoise2D', () =>
    Effect.gen(function* () {
      const noisePort = yield* NoiseServicePort
      const points: ReadonlyArray<readonly [number, number]> = [[3, 4], [10, 20]]
      const batch = yield* noisePort.octaveNoise2DBatch(points, 4, 0.5, 2.0)
      const [v0, v1] = yield* Effect.all([
        noisePort.octaveNoise2D(3, 4, 4, 0.5, 2.0),
        noisePort.octaveNoise2D(10, 20, 4, 0.5, 2.0),
      ], { concurrency: 'unbounded' })
      expect(batch).toHaveLength(2)
      expect(batch[0]).toBeCloseTo(v0, 10)
      expect(batch[1]).toBeCloseTo(v1, 10)
    }).pipe(Effect.provide(buildTerrainLayer(42)))
  )

  it.effect('noise3D via buildTerrainLayer returns a number in [-1, 1]', () =>
    Effect.gen(function* () {
      const noisePort = yield* NoiseServicePort
      const value = yield* noisePort.noise3D(3, 4, 5)
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThanOrEqual(1)
    }).pipe(Effect.provide(buildTerrainLayer(42)))
  )

  it.effect('setSeed via buildTerrainLayer is a no-op and completes without error', () =>
    Effect.gen(function* () {
      const noisePort = yield* NoiseServicePort
      // setSeed is a no-op: the seed is baked in at layer construction time
      const result = yield* noisePort.setSeed(99999)
      expect(result).toBeUndefined()
    }).pipe(Effect.provide(buildTerrainLayer(42)))
  )

  it.effect('setSeed does not change noise output (seed baked at construction)', () =>
    Effect.gen(function* () {
      const noisePort = yield* NoiseServicePort
      const before = yield* noisePort.noise2D(5, 10)
      yield* noisePort.setSeed(12345)
      const after = yield* noisePort.noise2D(5, 10)
      expect(before).toBe(after)
    }).pipe(Effect.provide(buildTerrainLayer(42)))
  )
})
