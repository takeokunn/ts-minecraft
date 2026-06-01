import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashSet, Layer } from 'effect'
import { BiomeService, ChunkManagerService, ChunkManagerServiceLive, NoiseServiceLive, NoiseServicePort, StorageServicePort, computeColumnY, type BiomeProperties, type BiomeType } from '@ts-minecraft/world'
import { ChunkServiceLive } from '@ts-minecraft/world/application/chunk-service'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { LightEngineNoopLive, buildInlineTerrainPoolLayer, makeInMemoryStorage } from './chunk-manager-test-utils'

const STONE = 2
const GRANITE = 12
const DIORITE = 13
const ANDESITE = 14
const DEEPSLATE = 15
const DEFAULT_TREE_WEIRDNESS = 0.4
const idx = (lx: number, y: number, lz: number): number => y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
const terrainIndex = (lx: number, lz: number): number => lz * CHUNK_SIZE + lx
const makeBiomeColumn = (biome: BiomeType, treeDensity = 0): { biome: BiomeType; props: BiomeProperties } => ({
  biome,
  props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.5, humidity: 0.3 },
})
const makeTerrainChannels = () => ({
  continentalness: new Float64Array(256).fill(0.7),
  erosion: new Float64Array(256).fill(0.8),
  pv: new Float64Array(256).fill(0.2),
  jaggedness: new Float64Array(256),
})
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
  return ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive), Layer.provide(Layer.succeed(StorageServicePort, makeInMemoryStorage())),
    Layer.provide(CustomBiomeLayer), Layer.provide(CustomNoise), Layer.provide(NoiseServiceLive),
    Layer.provide(buildInlineTerrainPoolLayer(Layer.mergeAll(ChunkServiceLive, CustomBiomeLayer, CustomNoise))), Layer.provide(LightEngineNoopLive),
  )
}
const loadChunk = Effect.gen(function* () { return yield* (yield* ChunkManagerService).getChunk({ x: 0, z: 0 }) })
const hasOverhangAbove = (blocks: Uint8Array, terrainChannels: ReturnType<typeof makeTerrainChannels>, lx: number, lz: number): boolean => {
  const baseSurfaceY = computeColumnY(terrainChannels, lx, lz)
  const overhangBlockSet = HashSet.make(STONE, DEEPSLATE, GRANITE, DIORITE, ANDESITE)
  const top = Math.min(baseSurfaceY + 14, CHUNK_HEIGHT)
  return Arr.some(Arr.makeBy(top - (baseSurfaceY + 2), (i) => baseSurfaceY + 2 + i), (y) => HashSet.has(overhangBlockSet, blocks[idx(lx, y, lz)]!))
}

describe('terrain/chunk-terrain-overhang', () => {
  it('adds stone overhangs above the base surface in rugged mountain terrain', () => {
    const biomeColumns = Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => makeBiomeColumn('MOUNTAINS', 0))
    const terrainChannels = makeTerrainChannels()
    terrainChannels.jaggedness.fill(0.9)
    return Effect.runPromise(Effect.gen(function* () {
      const chunk = yield* loadChunk.pipe(Effect.provide(buildLayer(biomeColumns, terrainChannels)))
      expect(hasOverhangAbove(chunk.blocks, terrainChannels, 8, 8)).toBe(true)
    }))
  })

  it('keeps overhang placement aligned to x-major column states instead of transposing x/z', () => {
    const biomeColumns = Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => makeBiomeColumn('FOREST', 0))
    const terrainChannels = makeTerrainChannels()
    terrainChannels.continentalness[terrainIndex(3, 10)] = 0.8
    terrainChannels.erosion[terrainIndex(3, 10)] = -0.8
    terrainChannels.pv[terrainIndex(3, 10)] = 0.9
    terrainChannels.jaggedness[terrainIndex(3, 10)] = 1.0
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
