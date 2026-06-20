import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect } from 'effect'
import {
  type BiomeType,
  CHUNK_COLUMN_SAMPLE_COUNT,
} from '@ts-minecraft/world'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  makeWorldCoordNoiseLayer,
  withBiomeService,
  withBiomeServiceLayer,
} from './biome-service-test-utils'

type BiomeChunkEntry = Readonly<{ readonly biome: BiomeType }>

const readBiomeChunkEntry = (
  entries: ReadonlyArray<BiomeChunkEntry>,
  index: number,
): BiomeChunkEntry =>
  entries[index] ?? { biome: 'PLAINS' }

describe('BiomeService.getBiomesAndPropertiesForChunk', () => {
  it.effect('returns CHUNK_SIZE² entries', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        expect(results).toHaveLength(CHUNK_COLUMN_SAMPLE_COUNT)
      })
    )
  )

  it.effect('all entries have a valid biome and matching properties', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        Arr.forEach(results, ({ biome, props }) => {
          expect(typeof biome).toBe('string')
          expect(typeof props.surfaceBlock).toBe('string')
          expect(props.treeDensity).toBeGreaterThanOrEqual(0)
          expect(props.treeDensity).toBeLessThanOrEqual(1)
        })
      })
    )
  )

  it.effect('all entries classify to PLAINS when noise returns temperate/moderate values', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        const biomes = Arr.map(results, (r) => r.biome)
        expect(Arr.every(biomes, (b) => b === 'PLAINS')).toBe(true)
      })
    )
  )

  it.effect('classifies DESERT when noise returns hot/dry values', () =>
    withBiomeService(0.8, 0.15, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        const biomes = Arr.map(results, (r) => r.biome)
        expect(Arr.every(biomes, (b) => b === 'DESERT')).toBe(true)
      })
    )
  )

  it.effect('promotes shoreline-adjacent inland columns to BEACH only when next to OCEAN', () => {
    const coastlineNoise = makeWorldCoordNoiseLayer({
      temperatureAt: (x) => x === 0 ? 0.2 : 0.5,
      humidityAt: (x) => x === 0 ? 0.9 : 0.45,
      continentalnessAt: (x) => x === 0 ? -0.65 : -0.05,
      erosionAt: () => 0.7,
    })
    return withBiomeServiceLayer(coastlineNoise, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        expect(readBiomeChunkEntry(results, 0).biome).toBe('OCEAN')
        expect(readBiomeChunkEntry(results, CHUNK_SIZE).biome).toBe('BEACH')
        expect(readBiomeChunkEntry(results, CHUNK_SIZE * 2).biome).toBe('PLAINS')
      })
    )
  })

  it.effect('promotes shoreline columns to BEACH even when the adjacent OCEAN lies in the neighboring chunk', () => {
    const crossChunkCoastNoise = makeWorldCoordNoiseLayer({
      temperatureAt: (x) => x >= CHUNK_SIZE ? 0.2 : 0.5,
      humidityAt: (x) => x >= CHUNK_SIZE ? 0.9 : 0.45,
      continentalnessAt: (x) => x >= CHUNK_SIZE ? -0.65 : -0.05,
      erosionAt: () => 0.7,
    })
    return withBiomeServiceLayer(crossChunkCoastNoise, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        const edgeIndex = (CHUNK_SIZE - 1) * CHUNK_SIZE
        expect(readBiomeChunkEntry(results, edgeIndex).biome).toBe('BEACH')
        const scalarBiome = yield* service.getBiome(CHUNK_SIZE - 1, 0)
        expect(scalarBiome).toBe('BEACH')
      })
    )
  })

  it.effect('results for chunk (0,0) and chunk (1,0) use different world coordinates', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.gen(function* () {
        const [chunk0, chunk1] = yield* Effect.all([
          service.getBiomesAndPropertiesForChunk(0, 0),
          service.getBiomesAndPropertiesForChunk(1, 0),
        ])
        expect(chunk0).toHaveLength(CHUNK_COLUMN_SAMPLE_COUNT)
        expect(chunk1).toHaveLength(CHUNK_COLUMN_SAMPLE_COUNT)
      })
    )
  )

  it.effect('batched chunk biome classification matches scalar getBiome for non-uniform terrain channels', () => {
    const pvFromWeirdness = (w: number): number => 1 - Math.abs(3 * Math.abs(w) - 2)
    const perCellClimateNoise = makeWorldCoordNoiseLayer({
      temperatureAt: (x, z) => {
        const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        void localZ
        return localX >= CHUNK_SIZE / 2 ? 0.82 : 0.22
      },
      humidityAt: (x, z) => {
        const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        void localX
        return localZ >= CHUNK_SIZE / 2 ? 0.72 : 0.24
      },
      continentalnessAt: (x) =>
        ((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE < CHUNK_SIZE / 2 ? -0.2 : 0.55,
      erosionAt: (_x, z) =>
        ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE < CHUNK_SIZE / 2 ? 0.7 : 0.2,
      weirdnessAt: (x, z) =>
        (Math.floor(x) + Math.floor(z)) % 2 === 0 ? 0.85 : -0.15,
      pvAt: (x, z) =>
        pvFromWeirdness((Math.floor(x) + Math.floor(z)) % 2 === 0 ? 0.85 : -0.15),
      jaggednessAt: () => 0.3,
    })
    return withBiomeServiceLayer(perCellClimateNoise, (service) =>
      Effect.gen(function* () {
        const batched = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        yield* Effect.forEach(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, (i) => i), (i) => {
          const lx = Math.floor(i / CHUNK_SIZE)
          const lz = i % CHUNK_SIZE
          return Effect.gen(function* () {
            const scalarBiome = yield* service.getBiome(lx, lz)
            expect(readBiomeChunkEntry(batched, i).biome).toBe(scalarBiome)
          })
        }, { concurrency: 'unbounded', discard: true })
      })
    )
  })
})
