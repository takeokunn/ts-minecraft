import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { BiomeService, ChunkManagerService, NoiseService, NoiseServicePort, StorageServicePort, computeColumnY, type BiomeProperties, type BiomeType } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { LightEngineNoopLayer, buildInlineTerrainPoolLayer, makeInMemoryStorage } from './chunk-manager-test-utils'
import { makeChunkColumnArray, makeTerrainChannelSamples } from './terrain-channel-test-utils'

const STONE = 2
const GRANITE = 12
const DIORITE = 13
const ANDESITE = 14
const DEEPSLATE = 15
const DEFAULT_TREE_WEIRDNESS = 0.4
const idx = (lx: number, y: number, lz: number): number => y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
const terrainIndex = (lx: number, lz: number): number => lz * CHUNK_SIZE + lx
const readBlock = (blocks: Uint8Array, blockIndex: number): number => blocks[blockIndex] as number
const makeBiomeColumn = (biome: BiomeType, treeDensity = 0): { biome: BiomeType; props: BiomeProperties } => ({
  biome,
  props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.5, humidity: 0.3 },
})
const makeBiomeColumns = (biome: BiomeType): ReadonlyArray<{ biome: BiomeType; props: BiomeProperties }> =>
  makeChunkColumnArray(() => makeBiomeColumn(biome, 0))
const makeTerrainChannels = () => makeTerrainChannelSamples({ continentalness: 0.7, erosion: 0.8, pv: 0.2 })
const buildLayer = (biomeColumns: ReadonlyArray<{ biome: BiomeType; props: BiomeProperties }>, terrainChannels: ReturnType<typeof makeTerrainChannels>) => {
  const CustomBiomeLayer = Layer.succeed(BiomeService, BiomeService.of({
    _tag: '@minecraft/application/BiomeService' as const,
    getBiome: () => Effect.succeed('PLAINS' as const), getBiomeProperties: (biome: BiomeType) => Effect.succeed(makeBiomeColumn(biome).props),
    getTemperature: () => Effect.succeed(0.5), getHumidity: () => Effect.succeed(0.5), getBiomesAndPropertiesForChunk: () => Effect.succeed(biomeColumns),
  }))
  const CustomNoise = Layer.succeed(NoiseServicePort, NoiseServicePort.of({
    _tag: '@minecraft/application/noise/NoiseServicePort' as const,
    noise2D: () => Effect.succeed(0.0), octaveNoise2D: () => Effect.succeed(0.5), setSeed: () => Effect.void, getSeed: Effect.succeed(0),
    octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) => Effect.succeed(points.map(() => 0.5)),
    octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
    noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) => Effect.succeed(points.map(() => 0.0)),
    noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.0)),
    noise3D: () => Effect.succeed(1.0), noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 1.0)),
    continentalness: () => Effect.succeed(0.0), erosion: () => Effect.succeed(0.0), weirdness: () => Effect.succeed(DEFAULT_TREE_WEIRDNESS),
    jaggedness: () => Effect.succeed(0.0), sampleTerrainChannels: () => Effect.succeed(terrainChannels),
  }))
  return ChunkManagerService.Default.pipe(
    Layer.provide(ChunkService.Default), Layer.provide(Layer.succeed(StorageServicePort, makeInMemoryStorage())),
    Layer.provide(CustomBiomeLayer), Layer.provide(CustomNoise), Layer.provide(NoiseService.Default),
    Layer.provide(buildInlineTerrainPoolLayer(Layer.mergeAll(ChunkService.Default, CustomBiomeLayer, CustomNoise))), Layer.provide(LightEngineNoopLayer),
  )
}
const loadChunk = Effect.gen(function* () { return yield* (yield* ChunkManagerService).getChunk({ x: 0, z: 0 }) })
const hasOverhangAbove = (blocks: Uint8Array, terrainChannels: ReturnType<typeof makeTerrainChannels>, lx: number, lz: number): boolean => {
  const baseSurfaceY = computeColumnY(terrainChannels, lx, lz)
  const overhangBlockSet = new Set([STONE, DEEPSLATE, GRANITE, DIORITE, ANDESITE])
  const top = Math.min(baseSurfaceY + 14, CHUNK_HEIGHT)
  const overhangSpan = Math.max(0, top - (baseSurfaceY + 2))
  return Array.from({ length: overhangSpan }, (_, i) => baseSurfaceY + 2 + i)
    .some((y) => overhangBlockSet.has(readBlock(blocks, idx(lx, y, lz))))
}

describe('terrain/chunk-terrain-overhang', () => {
  it('adds stone overhangs above the base surface in rugged mountain terrain', () => {
    const biomeColumns = makeBiomeColumns('MOUNTAINS')
    const terrainChannels = makeTerrainChannels()
    terrainChannels.jaggedness.fill(0.9)
    return Effect.runPromise(Effect.gen(function* () {
      const chunk = yield* loadChunk.pipe(Effect.provide(buildLayer(biomeColumns, terrainChannels)))
      expect(hasOverhangAbove(chunk.blocks, terrainChannels, 8, 8)).toBe(true)
    }))
  })

  it('keeps overhang placement aligned to x-major column states instead of transposing x/z', () => {
    const biomeColumns = makeBiomeColumns('FOREST')
    const terrainChannels = makeTerrainChannels()
    terrainChannels.continentalness[terrainIndex(3, 10)] = 0.8
    terrainChannels.erosion[terrainIndex(3, 10)] = -0.8
    terrainChannels.pv[terrainIndex(3, 10)] = 0.9
    terrainChannels.jaggedness[terrainIndex(3, 10)] = 1.0
    // A taller cliff neighbour at (4,10): overhang voxels above (3,10) now have solid
    // horizontal support, so the connectivity guard (anti-floating) keeps them — this is a
    // real cliff overhang, not an isolated floating block.
    terrainChannels.continentalness[terrainIndex(4, 10)] = 0.95
    terrainChannels.erosion[terrainIndex(4, 10)] = -0.95
    terrainChannels.pv[terrainIndex(4, 10)] = 1.0
    terrainChannels.jaggedness[terrainIndex(4, 10)] = 1.0
    terrainChannels.continentalness[terrainIndex(10, 3)] = 0.8
    terrainChannels.erosion[terrainIndex(10, 3)] = 0.9
    terrainChannels.pv[terrainIndex(10, 3)] = 0.5
    return Effect.runPromise(Effect.gen(function* () {
      const chunk = yield* loadChunk.pipe(Effect.provide(buildLayer(biomeColumns, terrainChannels)))
      expect(hasOverhangAbove(chunk.blocks, terrainChannels, 3, 10)).toBe(true)
      expect(hasOverhangAbove(chunk.blocks, terrainChannels, 10, 3)).toBe(false)
    }))
  })
})
