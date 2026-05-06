import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, MutableHashMap } from 'effect'
import type { BiomeGeneratorPort } from '../domain/biome-generator-port'
import { computeColumnYFromValues } from '../domain/density-function'
import { peaksAndValleysFromWeirdness } from '../domain/biome-classifier'
import { createBlockIndices } from '../domain/terrain/generator-coordinates'
import { createTreeColumnContextResolver } from '../domain/terrain/generator-pipeline'
import { NoiseServicePort } from '../domain/noise-service-port'

describe('terrain/generator-pipeline', () => {
  it.effect('tree column context uses peaks-and-valleys semantics instead of raw weirdness for surface height', () =>
    Effect.gen(function* () {
      const rawWeirdness = 0
      const continentalness = 0.72
      const erosion = 0.18
      const jaggedness = 0.35
      const pv = peaksAndValleysFromWeirdness(rawWeirdness)

      const biomeService: BiomeGeneratorPort = {
        getBiome: () => Effect.succeed('FOREST'),
        getBiomeProperties: () => Effect.succeed({
          surfaceBlock: 'GRASS',
          subSurfaceBlock: 'DIRT',
          treeDensity: 1,
          temperature: 0.5,
          humidity: 0.6,
        }),
        getBiomesAndPropertiesForChunk: () => Effect.succeed([]),
      }

      const noiseService = NoiseServicePort.of({
        _tag: '@minecraft/application/noise/NoiseServicePort' as const,
        noise2D: () => Effect.succeed(0),
        octaveNoise2D: () => Effect.succeed(0.5),
        setSeed: () => Effect.void,
        getSeed: Effect.succeed(0),
        octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
          Effect.succeed(points.map(() => 0.5)),
        octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
        noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
          Effect.succeed(points.map(() => 0)),
        noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0)),
        noise3D: () => Effect.succeed(0),
        noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0)),
        continentalness: () => Effect.succeed(continentalness),
        erosion: () => Effect.succeed(erosion),
        weirdness: () => Effect.succeed(rawWeirdness),
        jaggedness: () => Effect.succeed(jaggedness),
        sampleTerrainChannels: () => Effect.succeed({
          continentalness: new Float64Array(256).fill(continentalness),
          erosion: new Float64Array(256).fill(erosion),
          pv: new Float64Array(256).fill(pv),
          jaggedness: new Float64Array(256).fill(jaggedness),
        }),
      })

      const resolveTreeColumnContext = createTreeColumnContextResolver({
        biomeService,
        noiseService,
        treeColumnContextCache: MutableHashMap.empty(),
        blockIndices: createBlockIndices(),
      })

      const expectedSurfaceY = computeColumnYFromValues(continentalness, erosion, pv, jaggedness)
      const rawSurfaceY = computeColumnYFromValues(continentalness, erosion, rawWeirdness, jaggedness)
      const context = yield* resolveTreeColumnContext(12, 34)

      expect(context.surfaceY).toBe(expectedSurfaceY)
      expect(context.surfaceY).not.toBe(rawSurfaceY)
    })
  )
})
