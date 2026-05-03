// Shared test utilities for chunk-manager-service tests
import { Array as Arr, Brand, Effect, Layer, MutableHashMap } from 'effect'
import { StorageServicePort } from '@ts-minecraft/terrain'
import type { ChunkStorageValue } from '@ts-minecraft/terrain'
import { StorageError, FLUID_BYTE_LENGTH, LIGHT_BYTE_LENGTH } from '@ts-minecraft/world-state'
import { NoiseServicePort } from '@ts-minecraft/terrain'
import { NoiseServiceLive } from '@ts-minecraft/terrain'
import { TerrainWorkerPoolPort } from '@ts-minecraft/terrain'
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/app'
import { generateTerrain as legacyGenerateTerrain } from '@ts-minecraft/terrain'
import { BiomeService, BiomeServiceLive } from '@ts-minecraft/terrain'
import { LightEngineService } from '@ts-minecraft/terrain'
import { ChunkService, ChunkServiceLive } from '../domain/chunk'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { ChunkManagerServiceLive } from '@ts-minecraft/terrain'
import { DEFAULT_WORLD_ID, type WorldId } from '@ts-minecraft/kernel'

// ---------------------------------------------------------------------------
// In-memory StorageService mock (no IndexedDB)
// ---------------------------------------------------------------------------

type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>
const ChunkStorageKey = Brand.nominal<ChunkStorageKey>()
const storageKey = (worldId: WorldId, coord: { x: number; z: number }): ChunkStorageKey =>
  ChunkStorageKey(`${worldId}:${coord.x}:${coord.z}`)

export const makeInMemoryStorage = () => {
  const chunks = MutableHashMap.empty<ChunkStorageKey, ChunkStorageValue>()

  return StorageServicePort.of({
    _tag: '@minecraft/application/storage/StorageServicePort' as const,
    saveChunk: (worldId, coord, data) =>
      Effect.sync(() => {
        MutableHashMap.set(chunks, storageKey(worldId, coord), data)
      }) as Effect.Effect<undefined, StorageError>,
    loadChunk: (worldId, coord) =>
      Effect.sync(() => MutableHashMap.get(chunks, storageKey(worldId, coord))),
  })
}

// ---------------------------------------------------------------------------
// No-op LightEngine mock — skips BFS for tests that don't exercise lighting
// ---------------------------------------------------------------------------

export const LightEngineNoopLive = Layer.succeed(LightEngineService, {
  _tag: '@minecraft/application/LightEngineService' as const,
  computeLight: (_chunk: unknown) => Effect.sync(() => ({ skyLight: new Uint8Array(LIGHT_BYTE_LENGTH), blockLight: new Uint8Array(LIGHT_BYTE_LENGTH) })),
  updateLight: (_chunk: unknown) => Effect.sync(() => ({ skyLight: new Uint8Array(LIGHT_BYTE_LENGTH), blockLight: new Uint8Array(LIGHT_BYTE_LENGTH) })),
  getSkyLight: (_chunk: unknown, _lx: number, _y: number, _lz: number) => 15,
  getBlockLight: (_chunk: unknown, _lx: number, _y: number, _lz: number) => 0,
} as unknown as LightEngineService)

// ---------------------------------------------------------------------------
// Custom TerrainWorkerPoolPort layer that delegates back to the legacy generator
// using the test-provided BiomeService + NoiseServicePort. This preserves the
// pre-FR-001 contract for tests that inject custom biome/noise to drive terrain
// output. The default TerrainWorkerPool ignores those services (it builds its
// own seeded primitives), so tests using custom biome/noise must use this layer.
// Caller must provide ChunkService, BiomeService, and NoiseServicePort — the
// `buildLegacyTerrainPoolLayer` helper composes them in for ergonomic use.
// ---------------------------------------------------------------------------

export const buildLegacyTerrainPoolLayer = (
  deps: Layer.Layer<ChunkService | BiomeService | NoiseServicePort>,
): Layer.Layer<TerrainWorkerPoolPort> =>
  Layer.effect(
    TerrainWorkerPoolPort,
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const biomeService = yield* BiomeService
      const noiseService = yield* NoiseServicePort
      return {
        _tag: '@minecraft/application/terrain/TerrainWorkerPoolPort' as const,
        generateTerrain: (coord: { readonly x: number; readonly z: number }, _options: { seaLevel: number; lakeLevel: number; seed: number }) =>
          legacyGenerateTerrain(chunkService, biomeService, noiseService, coord).pipe(
            Effect.map((chunk) => ({
              blocks: chunk.blocks,
              skyLight: new Uint8Array(LIGHT_BYTE_LENGTH),
              blockLight: new Uint8Array(LIGHT_BYTE_LENGTH),
            })),
          ),
      } as unknown as TerrainWorkerPoolPort
    }),
  ).pipe(Layer.provide(deps))

// ---------------------------------------------------------------------------
// Test layer composition
// ---------------------------------------------------------------------------

export const buildTestLayer = () => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  const TestLayer = ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
    Layer.provide(NoiseServiceLive),
    Layer.provide(TerrainWorkerPoolPortLayer),
    Layer.provide(LightEngineNoopLive),
  )

  return { TestLayer, storage }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const EXPECTED_BLOCKS_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export const buildTestLayerWithStoredChunks = (coords: ReadonlyArray<{ readonly x: number; readonly z: number }>) => {
  const storage = makeInMemoryStorage()
  const minimalBlocks = new Uint8Array(EXPECTED_BLOCKS_LENGTH)

  const seedStorage = Effect.forEach(
    coords,
    (coord) => storage.saveChunk(DEFAULT_WORLD_ID, coord, minimalBlocks),
    { concurrency: 1, discard: true },
  )

  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  const TestLayer = ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
    Layer.provide(NoiseServiceLive),
    Layer.provide(TerrainWorkerPoolPortLayer),
    Layer.provide(LightEngineNoopLive),
  )

  return { TestLayer, storage, seedStorage }
}

export const chunkStorageBlocks = (value: ChunkStorageValue): Uint8Array<ArrayBufferLike> =>
  value instanceof Uint8Array ? value : value.blocks
