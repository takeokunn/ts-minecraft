import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, MutableHashMap } from 'effect'
import { CHUNK_SIZE, SEA_LEVEL, blockTypeToIndex } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import type { BiomeGeneratorPort } from '../domain/biome-generator-port'
import { computeColumnYFromValues } from '../domain/density-function'
import { peaksAndValleysFromWeirdness } from '../domain/biome-classifier'
import { createBlockIndices } from '../domain/terrain/generator-coordinates'
import { buildColumnStates, createTreeColumnContextResolver } from '../domain/terrain/generator-pipeline'
import type { BiomeProperties } from '../domain/biome'
import type { ColumnState, ColumnStateBuildArgs } from '../domain/terrain/generator-types'
import { NoiseServicePort } from '../domain/noise-service-port'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'
import { makeChunkColumnArray, makeTerrainChannelSamples } from './terrain-channel-test-utils'

const columnStateAt = (columnStates: ReadonlyArray<ColumnState>, index: number): ColumnState =>
  columnStates[index] as ColumnState

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
        sampleTerrainChannels: () => Effect.succeed(makeTerrainChannelSamples({ continentalness, erosion, pv, jaggedness })),
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

  it('promotes rocky outcrops on continental peak columns while flat inland columns stay grassy', () => {
    const blockIndices = createBlockIndices()
    const terrainIndex = (lx: number, lz: number): number => lz * CHUNK_SIZE + lx
    const elevatedSurfaceY = SEA_LEVEL + 16

    const props: BiomeProperties = {
      surfaceBlock: 'GRASS',
      subSurfaceBlock: 'DIRT',
      treeDensity: 0,
      temperature: 0.5,
      humidity: 0.6,
    }

    const biomeColumns: ColumnStateBuildArgs['biomeColumns'] = makeChunkColumnArray(() => ({ biome: 'FOREST' as const, props }))
    const terrainChannels = makeTerrainChannelSamples({ continentalness: 0.1, erosion: 0.2, pv: 0, jaggedness: 0.1 })

    const lowColumn = terrainIndex(3, 3)
    const highColumn = terrainIndex(12, 12)
    terrainChannels.continentalness[lowColumn] = -0.4
    terrainChannels.pv[lowColumn] = 0
    terrainChannels.continentalness[highColumn] = 0.9
    terrainChannels.pv[highColumn] = 1

    const blocks = makeChunkBlockBuffer()
    const columnStates = buildColumnStates({
      blocks,
      baseWorldX: 0,
      baseWorldZ: 0,
      biomeColumns,
      terrainChannels,
      initialSurfaceYs: Int32Array.from(makeChunkColumnArray(() => elevatedSurfaceY)),
      lakeNoiseVals: makeChunkColumnArray(() => 0),
      graniteNoiseVals: makeChunkColumnArray(() => 0),
      dioriteNoiseVals: makeChunkColumnArray(() => 0),
      andesiteNoiseVals: makeChunkColumnArray(() => 0),
      treeColumnContextCache: MutableHashMap.empty(),
      blockIndices,
    })

    const grassIndex = blockTypeToIndex('GRASS')
    const dirtIndex = blockTypeToIndex('DIRT')
    const gravelIndex = blockTypeToIndex('GRAVEL')
    const stoneIndex = blockTypeToIndex('STONE')

    expect(columnStateAt(columnStates, lowColumn).ruggedness).toBeLessThan(0.4)
    expect(columnStateAt(columnStates, highColumn).ruggedness).toBeGreaterThan(0.56)
    expect(blocks[chunkBlockIndexUnchecked(3, elevatedSurfaceY, 3)]).toBe(grassIndex)
    expect(blocks[chunkBlockIndexUnchecked(3, elevatedSurfaceY - 1, 3)]).toBe(dirtIndex)
    expect(blocks[chunkBlockIndexUnchecked(12, elevatedSurfaceY, 12)]).toBe(gravelIndex)
    expect(blocks[chunkBlockIndexUnchecked(12, elevatedSurfaceY - 1, 12)]).toBe(stoneIndex)
  })

  it('fills ocean columns below sea level with WATER up to SEA_LEVEL', () => {
    const blockIndices = createBlockIndices()
    const props: BiomeProperties = {
      surfaceBlock: 'SAND',
      subSurfaceBlock: 'SAND',
      treeDensity: 0,
      temperature: 0.5,
      humidity: 0.5,
    }
    const biomeColumns: ColumnStateBuildArgs['biomeColumns'] = makeChunkColumnArray(() => ({ biome: 'OCEAN' as const, props }))
    const terrainChannels = makeTerrainChannelSamples({ continentalness: 0.5, erosion: 0.5, pv: 0.5, jaggedness: 0.5 })
    const blocks = makeChunkBlockBuffer()
    // Ocean floor below sea level → determineWaterLevel floods up to SEA_LEVEL.
    const oceanFloorY = SEA_LEVEL - 5

    buildColumnStates({
      blocks,
      baseWorldX: 0,
      baseWorldZ: 0,
      biomeColumns,
      terrainChannels,
      initialSurfaceYs: Int32Array.from(makeChunkColumnArray(() => oceanFloorY)),
      lakeNoiseVals: makeChunkColumnArray(() => 1),
      graniteNoiseVals: makeChunkColumnArray(() => 0),
      dioriteNoiseVals: makeChunkColumnArray(() => 0),
      andesiteNoiseVals: makeChunkColumnArray(() => 0),
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

  it('freezes the top water block in cold biome columns', () => {
    const blockIndices = createBlockIndices()
    const props: BiomeProperties = {
      surfaceBlock: 'SNOW',
      subSurfaceBlock: 'DIRT',
      treeDensity: 0,
      temperature: 0.05,
      humidity: 0.5,
    }
    const biomeColumns: ColumnStateBuildArgs['biomeColumns'] = makeChunkColumnArray(() => ({ biome: 'SNOW' as const, props }))
    const terrainChannels = makeTerrainChannelSamples({ continentalness: 0.5, erosion: 0.5, pv: 0.5, jaggedness: 0.5 })
    const blocks = makeChunkBlockBuffer()
    const frozenFloorY = SEA_LEVEL - 4

    buildColumnStates({
      blocks,
      baseWorldX: 0,
      baseWorldZ: 0,
      biomeColumns,
      terrainChannels,
      initialSurfaceYs: Int32Array.from(makeChunkColumnArray(() => frozenFloorY)),
      lakeNoiseVals: makeChunkColumnArray(() => 1),
      graniteNoiseVals: makeChunkColumnArray(() => 0),
      dioriteNoiseVals: makeChunkColumnArray(() => 0),
      andesiteNoiseVals: makeChunkColumnArray(() => 0),
      treeColumnContextCache: MutableHashMap.empty(),
      blockIndices,
    })

    const waterIndex = blockTypeToIndex('WATER')
    const iceIndex = blockTypeToIndex('ICE')

    expect(blocks[chunkBlockIndexUnchecked(0, frozenFloorY + 1, 0)]).toBe(waterIndex)
    expect(blocks[chunkBlockIndexUnchecked(0, SEA_LEVEL - 1, 0)]).toBe(waterIndex)
    expect(blocks[chunkBlockIndexUnchecked(0, SEA_LEVEL, 0)]).toBe(iceIndex)
    expect(blocks[chunkBlockIndexUnchecked(0, SEA_LEVEL + 1, 0)]).not.toBe(iceIndex)
  })
})
