import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, MutableHashMap } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, SEA_LEVEL, blockTypeToIndex } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import type { BiomeGeneratorPort } from '../domain/biome-generator-port'
import { computeColumnYFromValues } from '../domain/density-function'
import { peaksAndValleysFromWeirdness } from '../domain/biome-classifier'
import { createBlockIndices } from '../domain/terrain/generator-coordinates'
import { buildColumnStates, createTreeColumnContextResolver } from '../domain/terrain/generator-pipeline'
import type { BiomeProperties } from '../domain/biome'
import type { ColumnStateBuildArgs } from '../domain/terrain/generator-types'
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

  it('fills ocean columns below sea level with WATER up to SEA_LEVEL', () => {
    const blockIndices = createBlockIndices()
    const columnCount = CHUNK_SIZE * CHUNK_SIZE
    const props: BiomeProperties = {
      surfaceBlock: 'SAND',
      subSurfaceBlock: 'SAND',
      treeDensity: 0,
      temperature: 0.5,
      humidity: 0.5,
    }
    const biomeColumns: ColumnStateBuildArgs['biomeColumns'] = Array.from(
      { length: columnCount },
      () => ({ biome: 'OCEAN' as const, props }),
    )
    const terrainChannels = {
      continentalness: new Float64Array(columnCount).fill(0.5),
      erosion: new Float64Array(columnCount).fill(0.5),
      pv: new Float64Array(columnCount).fill(0.5),
      jaggedness: new Float64Array(columnCount).fill(0.5),
    }
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    // Ocean floor below sea level → determineWaterLevel floods up to SEA_LEVEL.
    const oceanFloorY = SEA_LEVEL - 5

    buildColumnStates({
      blocks,
      baseWorldX: 0,
      baseWorldZ: 0,
      biomeColumns,
      terrainChannels,
      initialSurfaceYs: new Int32Array(columnCount).fill(oceanFloorY),
      lakeNoiseVals: Array.from({ length: columnCount }, () => 1),
      graniteNoiseVals: Array.from({ length: columnCount }, () => 0),
      dioriteNoiseVals: Array.from({ length: columnCount }, () => 0),
      andesiteNoiseVals: Array.from({ length: columnCount }, () => 0),
      treeColumnContextCache: MutableHashMap.empty(),
      blockIndices,
    })

    const waterIndex = blockTypeToIndex('WATER')
    // Water is now generated (regression guard: this used to be entirely absent).
    expect(blocks.includes(waterIndex)).toBe(true)
    // Column (0,0): solid floor at oceanFloorY, water from floor+1 up to SEA_LEVEL, air above.
    expect(blocks[chunkBlockIndexUnchecked(0, oceanFloorY, 0)]).not.toBe(waterIndex)
    expect(blocks[chunkBlockIndexUnchecked(0, oceanFloorY + 1, 0)]).toBe(waterIndex)
    expect(blocks[chunkBlockIndexUnchecked(0, SEA_LEVEL, 0)]).toBe(waterIndex)
    expect(blocks[chunkBlockIndexUnchecked(0, SEA_LEVEL + 1, 0)]).not.toBe(waterIndex)
  })
})
