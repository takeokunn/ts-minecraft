// Shared test utilities for chunk-manager-service tests
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/app'
import { CHUNK_HEIGHT,CHUNK_SIZE,DEFAULT_WORLD_ID,type WorldId } from '@ts-minecraft/kernel'
import type { ChunkStorageValue } from '@ts-minecraft/terrain'
import { BiomeService,BiomeServiceLive,ChunkManagerServiceLive,generateTerrain as generateChunkTerrain,LightEngineService,NoiseServiceLive,NoiseServicePort,StorageServicePort,TerrainWorkerPoolPort } from '@ts-minecraft/terrain'
import { LIGHT_BYTE_LENGTH,StorageError } from '@ts-minecraft/world-state'
import { Brand,Effect,Layer,MutableHashMap } from 'effect'
import { ChunkService,ChunkServiceLive,type Chunk } from '../domain/chunk'

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
  computeLight: (_chunk: Chunk) => Effect.sync(() => ({ skyLight: new Uint8Array(LIGHT_BYTE_LENGTH), blockLight: new Uint8Array(LIGHT_BYTE_LENGTH) })),
  updateLight: (_chunk: Chunk) => Effect.sync(() => ({ skyLight: new Uint8Array(LIGHT_BYTE_LENGTH), blockLight: new Uint8Array(LIGHT_BYTE_LENGTH) })),
  getSkyLight: (_chunk: Chunk, _lx: number, _y: number, _lz: number) => 15,
  getBlockLight: (_chunk: Chunk, _lx: number, _y: number, _lz: number) => 0,
})

// ---------------------------------------------------------------------------
// Custom TerrainWorkerPoolPort layer that delegates to the pure generator using
// test-provided BiomeService + NoiseServicePort. This keeps terrain tests focused
// on generation behavior without spawning browser workers.
// Caller must provide ChunkService, BiomeService, and NoiseServicePort — the
// `buildInlineTerrainPoolLayer` helper composes them in for ergonomic use.
// ---------------------------------------------------------------------------

export const buildInlineTerrainPoolLayer = (
  deps: Layer.Layer<ChunkService | BiomeService | NoiseServicePort>,
): Layer.Layer<TerrainWorkerPoolPort> =>
  Layer.effect(
    TerrainWorkerPoolPort,
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const biomeService = yield* BiomeService
      const noiseService = yield* NoiseServicePort
      return TerrainWorkerPoolPort.of({
        _tag: '@minecraft/application/terrain/TerrainWorkerPoolPort' as const,
        generateTerrain: (coord: { readonly x: number; readonly z: number }, _options: { seaLevel: number; lakeLevel: number; seed: number }) =>
          generateChunkTerrain(chunkService, biomeService, noiseService, coord).pipe(
            Effect.map((chunk) => ({
              blocks: chunk.blocks,
              skyLight: new Uint8Array(LIGHT_BYTE_LENGTH),
              blockLight: new Uint8Array(LIGHT_BYTE_LENGTH),
            })),
          ),
      })
    }),
  ).pipe(Layer.provide(deps))

// ---------------------------------------------------------------------------
// Test layer composition
// ---------------------------------------------------------------------------

export const buildTestLayer = () => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
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
    (coord) => storage.saveChunk(DEFAULT_WORLD_ID, coord, { blocks: minimalBlocks, fluid: undefined }),
    { concurrency: 1, discard: true },
  )

  const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
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
  value.blocks
