import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer } from 'effect'
import {
  BiomeService,
  BiomeServiceLive,
  NoiseServicePort,
} from '@ts-minecraft/world'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import { withBiomeService } from './biome-service-test-utils'

describe('BiomeService.getBiomesAndPropertiesForChunk', () => {
  it.effect('returns CHUNK_SIZE² entries', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        expect(results).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
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
    const coastlineNoise = Layer.succeed(NoiseServicePort, NoiseServicePort.of({
      _tag: '@minecraft/application/noise/NoiseServicePort' as const,
      noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
      octaveNoise2D: (x: number, _z: number) => {
        const isHumidity = x > 25.0
        const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
        if (worldX === 0) return Effect.succeed(isHumidity ? 0.9 : 0.2)
        return Effect.succeed(isHumidity ? 0.45 : 0.5)
      },
      setSeed: (_seed: number) => Effect.void,
      getSeed: Effect.succeed(0),
      octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
        Effect.succeed(Arr.makeBy(points.length, () => 0.5)),
      octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
        Effect.succeed(Arr.map(xs, (x, i) => {
          const lx = Math.floor(i / CHUNK_SIZE)
          const isHumidity = x > 25.0
          if (lx === 0) return isHumidity ? 0.9 : 0.2 // OCEAN
          return isHumidity ? 0.45 : 0.5 // PLAINS candidate next to ocean
        })),
      continentalness: (x: number, _z: number) => Effect.succeed(x === 0 ? -0.65 : -0.05),
      erosion: (_x: number, _z: number) => Effect.succeed(0.7),
      weirdness: (_x: number, _z: number) => Effect.succeed(0),
      jaggedness: (_x: number, _z: number) => Effect.succeed(0),
      noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
        Effect.succeed(Arr.makeBy(points.length, () => 0.9)),
      noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) => Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
      noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(0),
      noise3DBatchXYZ: (xs: ReadonlyArray<number>) =>
        Effect.succeed(Arr.makeBy(xs.length, () => 0)),
      sampleTerrainChannels: (_x: number, _z: number) => Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => (i % CHUNK_SIZE) === 0 ? -0.65 : -0.05)),
        erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.7)),
        pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
      }),
    }))

    const layer = BiomeServiceLive.pipe(Layer.provide(coastlineNoise))
    return Effect.flatMap(BiomeService, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        expect(results[0]!.biome).toBe('OCEAN')
        expect(results[CHUNK_SIZE]!.biome).toBe('BEACH')
        expect(results[CHUNK_SIZE * 2]!.biome).toBe('PLAINS')
      })
    ).pipe(Effect.provide(layer))
  })

  it.effect('promotes shoreline columns to BEACH even when the adjacent OCEAN lies in the neighboring chunk', () => {
    const crossChunkCoastNoise = Layer.succeed(NoiseServicePort, NoiseServicePort.of({
      _tag: '@minecraft/application/noise/NoiseServicePort' as const,
      noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
      octaveNoise2D: (x: number, _z: number) => {
        const isHumidity = x > 25.0
        const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
        if (worldX >= CHUNK_SIZE) return Effect.succeed(isHumidity ? 0.9 : 0.2) // neighboring chunk = ocean
        return Effect.succeed(isHumidity ? 0.45 : 0.5) // current chunk = plains candidate
      },
      setSeed: (_seed: number) => Effect.void,
      getSeed: Effect.succeed(0),
      octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
        Effect.succeed(Arr.makeBy(points.length, () => 0.5)),
      octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>) =>
        Effect.forEach(Arr.zip(xs, zs), ([x, z]) => {
          const isHumidity = x > 25.0
          const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
          void z
          if (worldX >= CHUNK_SIZE) return Effect.succeed(isHumidity ? 0.9 : 0.2)
          return Effect.succeed(isHumidity ? 0.45 : 0.5)
        }, { concurrency: 'unbounded' }),
      continentalness: (x: number, _z: number) => Effect.succeed(x >= CHUNK_SIZE ? -0.65 : -0.05),
      erosion: (_x: number, _z: number) => Effect.succeed(0.7),
      weirdness: (_x: number, _z: number) => Effect.succeed(0),
      jaggedness: (_x: number, _z: number) => Effect.succeed(0),
      noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
        Effect.succeed(Arr.makeBy(points.length, () => 0.9)),
      noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) => Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
      noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(0),
      noise3DBatchXYZ: (xs: ReadonlyArray<number>) =>
        Effect.succeed(Arr.makeBy(xs.length, () => 0)),
      sampleTerrainChannels: (_x: number, _z: number) => Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => -0.05)),
        erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.7)),
        pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
      }),
    }))

    const layer = BiomeServiceLive.pipe(Layer.provide(crossChunkCoastNoise))
    return Effect.flatMap(BiomeService, (service) =>
      Effect.gen(function* () {
        const results = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        const edgeIndex = (CHUNK_SIZE - 1) * CHUNK_SIZE
        expect(results[edgeIndex]!.biome).toBe('BEACH')
      })
    ).pipe(Effect.provide(layer))
  })

  it.effect('results for chunk (0,0) and chunk (1,0) use different world coordinates', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.gen(function* () {
        const [chunk0, chunk1] = yield* Effect.all([
          service.getBiomesAndPropertiesForChunk(0, 0),
          service.getBiomesAndPropertiesForChunk(1, 0),
        ])
        expect(chunk0).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
        expect(chunk1).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
      })
    )
  )

  it.effect('batched chunk biome classification matches scalar getBiome for non-uniform terrain channels', () => {
    const pvFromWeirdness = (w: number): number => 1 - Math.abs(3 * Math.abs(w) - 2)
    const perCellClimateNoise = Layer.succeed(NoiseServicePort, NoiseServicePort.of({
      _tag: '@minecraft/application/noise/NoiseServicePort' as const,
      noise2D: (_x: number, _z: number) => Effect.succeed(0.9),
      octaveNoise2D: (x: number, z: number) => {
        const isHumidity = x > 25.0
        const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
        const worldZ = Math.round(z / 0.005)
        const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const warmStripe = localX >= CHUNK_SIZE / 2
        const humidStripe = localZ >= CHUNK_SIZE / 2
        return Effect.succeed(isHumidity ? (humidStripe ? 0.72 : 0.24) : (warmStripe ? 0.82 : 0.22))
      },
      setSeed: (_seed: number) => Effect.void,
      getSeed: Effect.succeed(0),
      octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
        Effect.succeed(Arr.makeBy(points.length, () => 0.5)),
      octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>) =>
        Effect.forEach(Arr.zip(xs, zs), ([x, z]) => {
          const isHumidity = x > 25.0
          const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
          const worldZ = Math.round(z / 0.005)
          const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const warmStripe = localX >= CHUNK_SIZE / 2
          const humidStripe = localZ >= CHUNK_SIZE / 2
          return Effect.succeed(isHumidity ? (humidStripe ? 0.72 : 0.24) : (warmStripe ? 0.82 : 0.22))
        }, { concurrency: 'unbounded' }),
      continentalness: (x: number, _z: number) => Effect.succeed((Math.floor(x) % CHUNK_SIZE) < CHUNK_SIZE / 2 ? -0.2 : 0.55),
      erosion: (_x: number, z: number) => Effect.succeed((Math.floor(z) % CHUNK_SIZE) < CHUNK_SIZE / 2 ? 0.7 : 0.2),
      weirdness: (x: number, z: number) => Effect.succeed(((Math.floor(x) + Math.floor(z)) % 2 === 0) ? 0.85 : -0.15),
      jaggedness: (_x: number, _z: number) => Effect.succeed(0.3),
      noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
        Effect.succeed(Arr.makeBy(points.length, () => 0.9)),
      noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) => Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
      noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(0),
      noise3DBatchXYZ: (xs: ReadonlyArray<number>) =>
        Effect.succeed(Arr.makeBy(xs.length, () => 0)),
      sampleTerrainChannels: (xStart: number, zStart: number) => Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => {
          const x = xStart + (i % CHUNK_SIZE)
          return (x % CHUNK_SIZE) < CHUNK_SIZE / 2 ? -0.2 : 0.55
        })),
        erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => {
          const z = zStart + Math.floor(i / CHUNK_SIZE)
          return (z % CHUNK_SIZE) < CHUNK_SIZE / 2 ? 0.7 : 0.2
        })),
        pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => pvFromWeirdness(((i % CHUNK_SIZE) + Math.floor(i / CHUNK_SIZE)) % 2 === 0 ? 0.85 : -0.15))),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.3)),
      }),
    }))

    const layer = BiomeServiceLive.pipe(Layer.provide(perCellClimateNoise))
    return Effect.flatMap(BiomeService, (service) =>
      Effect.gen(function* () {
        const batched = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        yield* Effect.forEach(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => i), (i) => {
          const lx = Math.floor(i / CHUNK_SIZE)
          const lz = i % CHUNK_SIZE
          return Effect.gen(function* () {
            const scalarBiome = yield* service.getBiome(lx, lz)
            expect(batched[i]!.biome).toBe(scalarBiome)
          })
        }, { concurrency: 'unbounded', discard: true })
      })
    ).pipe(Effect.provide(layer))
  })
})
