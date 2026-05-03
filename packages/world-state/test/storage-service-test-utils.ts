import { Array as Arr, Effect, Either, Layer, MutableHashMap, MutableRef, Option, Schema } from 'effect'
import { StorageService, WorldMetadataSchema, WorldMetadata, ChunkStorageKey } from '@ts-minecraft/world-state'
import type { ChunkStorageValue } from '@ts-minecraft/world-state'
import { StorageError } from '../domain/errors'
import { WorldId } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'

// ---------------------------------------------------------------------------
// Shared test constants
// ---------------------------------------------------------------------------

export const testWorldId = 'test-world' as WorldId
export const anotherWorldId = 'another-world' as WorldId
export const testCoord: ChunkCoord = { x: 0, z: 0 }

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

export const chunkStorageBlocks = (value: ChunkStorageValue): Uint8Array<ArrayBufferLike> =>
  value instanceof Uint8Array ? value : value.blocks

// Build an in-memory StorageService for contract testing.
// Uses MutableHashMap to simulate the IndexedDB storage contract without requiring
// a real browser environment.
export const makeInMemoryStorageService = () => {
  const chunkStore = MutableHashMap.empty<ChunkStorageKey, Uint8Array>()
  const metaStore = MutableHashMap.empty<WorldId, WorldMetadata>()
  const initializedRef = MutableRef.make(false)

  const chunkKey = (worldId: WorldId, coord: ChunkCoord): ChunkStorageKey =>
    ChunkStorageKey(`${worldId}:${coord.x}:${coord.z}`)

  const service = {
    initialize: Effect.sync(() => {
      MutableRef.set(initializedRef, true)
    }),

    saveChunk: (worldId: WorldId, chunkCoord: ChunkCoord, data: Uint8Array) =>
      Effect.sync(() => {
        MutableHashMap.set(chunkStore, chunkKey(worldId, chunkCoord), data)
      }),

    loadChunk: (worldId: WorldId, chunkCoord: ChunkCoord) =>
      Effect.sync(() => MutableHashMap.get(chunkStore, chunkKey(worldId, chunkCoord))),

    saveWorldMetadata: (worldId: WorldId, metadata: WorldMetadata) =>
      Effect.sync(() => {
        MutableHashMap.set(metaStore, worldId, metadata)
      }),

    loadWorldMetadata: (worldId: WorldId) =>
      Effect.sync(() => MutableHashMap.get(metaStore, worldId)),

    deleteWorld: (worldId: WorldId) =>
      Effect.sync(() => {
        const prefix = `${worldId}:`
        const keysToDelete = Arr.filter(Arr.fromIterable(MutableHashMap.keys(chunkStore)), k => k.startsWith(prefix))
        Arr.forEach(keysToDelete, key => {
          MutableHashMap.remove(chunkStore, key)
        })
        MutableHashMap.remove(metaStore, worldId)
      }),

    listWorldMetadata: Effect.sync(() => {
      const valid: Array<{ worldId: WorldId; metadata: WorldMetadata }> = []
      const corrupt: Array<WorldId> = []
      Arr.forEach(Arr.fromIterable(MutableHashMap.keys(metaStore)), (worldId) => {
        const metaOpt = MutableHashMap.get(metaStore, worldId)
        Option.map(metaOpt, (raw) => {
          const decoded = Schema.decodeUnknownEither(WorldMetadataSchema)(raw)
          Either.match(decoded, {
            onLeft: () => { corrupt.push(worldId) },
            onRight: (metadata) => { valid.push({ worldId, metadata }) },
          })
        })
      })
      return {
        valid: valid as ReadonlyArray<{ worldId: WorldId; metadata: WorldMetadata }>,
        corrupt: corrupt as ReadonlyArray<WorldId>,
      }
    }),

    // Expose internal state for assertions in tests
    _initialized: () => MutableRef.get(initializedRef),
    _chunkStore: chunkStore,
    _metaStore: metaStore,
  }

  const TestLayer = Layer.succeed(StorageService, service as unknown as StorageService)

  return { service, TestLayer }
}

// Build a failing StorageService that calls throwOnSave() on each saveChunk.
// Used to test error handling and call-count verification.
export const makeFailingStorageService = (throwOnSave: () => void) => {
  const chunkStore = MutableHashMap.empty<string, Uint8Array>()
  const metaStore = MutableHashMap.empty<string, WorldMetadata>()
  const saveCallCountRef = MutableRef.make(0)

  const chunkKey = (worldId: WorldId, coord: ChunkCoord): string =>
    `${worldId}:${coord.x}:${coord.z}`

  const service = {
    initialize: Effect.void,

    saveChunk: (worldId: WorldId, chunkCoord: ChunkCoord, data: Uint8Array) =>
      Effect.sync(() => {
        MutableRef.updateAndGet(saveCallCountRef, n => n + 1)
        throwOnSave()
        MutableHashMap.set(chunkStore, chunkKey(worldId, chunkCoord), data)
      }),

    loadChunk: (worldId: WorldId, chunkCoord: ChunkCoord) =>
      Effect.sync(() => MutableHashMap.get(chunkStore, chunkKey(worldId, chunkCoord))),

    saveWorldMetadata: (worldId: WorldId, metadata: WorldMetadata) =>
      Effect.sync(() => {
        MutableHashMap.set(metaStore, worldId, metadata)
      }),

    loadWorldMetadata: (worldId: WorldId) =>
      Effect.sync(() => MutableHashMap.get(metaStore, worldId)),

    deleteWorld: (worldId: WorldId) =>
      Effect.sync(() => {
        const prefix = `${worldId}:`
        const keysToDelete = Arr.filter(Arr.fromIterable(MutableHashMap.keys(chunkStore)), k => k.startsWith(prefix))
        Arr.forEach(keysToDelete, key => {
          MutableHashMap.remove(chunkStore, key)
        })
        MutableHashMap.remove(metaStore, worldId)
      }),

    _saveCallCount: () => MutableRef.get(saveCallCountRef),
  }

  const TestLayer = Layer.succeed(StorageService, service as unknown as StorageService)
  return { service, TestLayer }
}
