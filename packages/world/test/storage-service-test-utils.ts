import { Array as Arr, Effect, Layer, MutableHashMap, MutableRef, Option } from 'effect'
import { StorageService, WorldMetadata, ChunkStorageKey } from '@ts-minecraft/world'
import type { ChunkStorageValue } from '@ts-minecraft/world'
import { WorldId } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'

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
  value.blocks

export const chunkStorageValue = (blocks: Uint8Array<ArrayBufferLike>, fluid?: Uint8Array<ArrayBufferLike>): ChunkStorageValue => ({
  blocks,
  fluid: fluid ?? undefined,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPlayerSpawn = (value: unknown): value is WorldMetadata['playerSpawn'] =>
  isRecord(value)
    && typeof value['x'] === 'number'
    && typeof value['y'] === 'number'
    && typeof value['z'] === 'number'

const isWorldMetadata = (value: unknown): value is WorldMetadata =>
  isRecord(value)
    && typeof value['seed'] === 'number'
    && value['createdAt'] instanceof Date
    && value['lastPlayed'] instanceof Date
    && isPlayerSpawn(value['playerSpawn'])
    && (value['gameMode'] === 'survival' || value['gameMode'] === 'creative')
    && typeof value['saveVersion'] === 'number'

// Build an in-memory StorageService for contract testing.
// Uses MutableHashMap to simulate the IndexedDB storage contract without requiring
// a real browser environment.
export const makeInMemoryStorageService = () => {
  const chunkStore = MutableHashMap.empty<ChunkStorageKey, ChunkStorageValue>()
  const metaStore = MutableHashMap.empty<WorldId, unknown>()
  const initializedRef = MutableRef.make(false)

  const chunkKey = (worldId: WorldId, coord: ChunkCoord): ChunkStorageKey =>
    ChunkStorageKey(`${worldId}:${coord.x}:${coord.z}`)

  const storageService = StorageService.of({
    _tag: '@minecraft/infrastructure/storage/StorageService' as const,

    initialize: Effect.sync(() => {
      MutableRef.set(initializedRef, true)
    }),

    saveChunk: (worldId: WorldId, chunkCoord: ChunkCoord, data: ChunkStorageValue) =>
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
      Effect.sync(() => Option.filter(MutableHashMap.get(metaStore, worldId), isWorldMetadata)),

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
          if (isWorldMetadata(raw)) {
            valid.push({ worldId, metadata: raw })
          } else {
            corrupt.push(worldId)
          }
        })
      })
      return {
        valid: valid as ReadonlyArray<{ worldId: WorldId; metadata: WorldMetadata }>,
        corrupt: corrupt as ReadonlyArray<WorldId>,
      }
    }),

  })

  const service = {
    ...storageService,
    // Expose internal state for assertions in tests
    _initialized: () => MutableRef.get(initializedRef),
    _chunkStore: chunkStore,
    _metaStore: metaStore,
  }

  const TestLayer = Layer.succeed(StorageService, storageService)

  return { service, TestLayer }
}

// Build a failing StorageService that calls throwOnSave() on each saveChunk.
// Used to test error handling and call-count verification.
export const makeFailingStorageService = (throwOnSave: () => void) => {
  const chunkStore = MutableHashMap.empty<string, ChunkStorageValue>()
  const metaStore = MutableHashMap.empty<WorldId, WorldMetadata>()
  const saveCallCountRef = MutableRef.make(0)

  const chunkKey = (worldId: WorldId, coord: ChunkCoord): string =>
    `${worldId}:${coord.x}:${coord.z}`

  const storageService = StorageService.of({
    _tag: '@minecraft/infrastructure/storage/StorageService' as const,

    initialize: Effect.void,

    saveChunk: (worldId: WorldId, chunkCoord: ChunkCoord, data: ChunkStorageValue) =>
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

    listWorldMetadata: Effect.sync(() => ({
      valid: Arr.filterMap(Arr.fromIterable(MutableHashMap.keys(metaStore)), (worldId) =>
        Option.map(MutableHashMap.get(metaStore, worldId), (metadata) => ({ worldId, metadata })),
      ),
      corrupt: [],
    })),

  })

  const service = {
    ...storageService,
    _saveCallCount: () => MutableRef.get(saveCallCountRef),
  }

  const TestLayer = Layer.succeed(StorageService, storageService)
  return { service, TestLayer }
}
