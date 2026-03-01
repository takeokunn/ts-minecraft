import { Effect, Option, Schema } from 'effect'
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { WorldId, Position } from '@/shared/kernel'
import { StorageError } from '@/domain/errors'
import type { ChunkCoord } from '@/domain/chunk'

export type { ChunkCoord }

/**
 * World metadata for persistence
 */
export interface WorldMetadata {
  readonly seed: number
  readonly createdAt: Date
  readonly lastPlayed: Date
  readonly playerSpawn: Position
}

export const WorldMetadataSchema = Schema.Struct({
  seed: Schema.Number,
  createdAt: Schema.DateFromSelf,
  lastPlayed: Schema.DateFromSelf,
  playerSpawn: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
})
export type WorldMetadataType = Schema.Schema.Type<typeof WorldMetadataSchema>

/**
 * IndexedDB schema definition
 */
interface MinecraftWorldsDB extends DBSchema {
  chunks: {
    key: string
    value: Uint8Array
    indexes: {}
  }
  metadata: {
    key: string
    value: WorldMetadata
    indexes: {}
  }
}

/**
 * Database configuration
 */
const DB_NAME = 'minecraft-worlds'
const DB_VERSION = 2  // v2: added SNOW/GRAVEL/COBBLESTONE block types; existing chunk data cleared on upgrade
const STORE_CHUNKS = 'chunks'
const STORE_METADATA = 'metadata'

/**
 * Internal interface for database reference
 */
interface StorageState {
  db: IDBPDatabase<MinecraftWorldsDB> | null
}

/**
 * Helper to create chunk key from worldId and chunk coordinates
 */
const chunkKey = (worldId: WorldId, chunkCoord: ChunkCoord): string =>
  `${worldId}:${chunkCoord.x}:${chunkCoord.z}`

/**
 * Helper to check if error is quota exceeded
 */
const isQuotaExceeded = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22
  }
  return false
}

/**
 * Helper to wrap IndexedDB operations in Effect
 */
const tryCatchStorage = <A>(operation: string, fn: () => Promise<A>): Effect.Effect<A, StorageError> =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) => {
      if (isQuotaExceeded(cause)) {
        return new StorageError({ operation, cause: 'Storage quota exceeded. Please clear some data.' })
      }
      return new StorageError({ operation, cause })
    },
  })

/**
 * StorageService — IndexedDB persistence for chunk and world metadata
 *
 * Provides low-level chunk and world metadata persistence using IndexedDB.
 * This is an infrastructure layer service that abstracts browser storage.
 */
export class StorageService extends Effect.Service<StorageService>()(
  '@minecraft/infrastructure/storage/StorageService',
  {
    effect: Effect.gen(function* () {
      const state: StorageState = { db: null }

      const initialize = Effect.gen(function* () {
        if (state.db) {
          return
        }

        state.db = yield* tryCatchStorage('open database', () =>
          openDB<MinecraftWorldsDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
              if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
                db.createObjectStore(STORE_CHUNKS)
              }
              if (!db.objectStoreNames.contains(STORE_METADATA)) {
                db.createObjectStore(STORE_METADATA)
              }
              // v1→v2: block type indices changed (SNOW=9, GRAVEL=10, COBBLESTONE=11 added)
              // Clear all saved chunks to prevent corrupt block type decoding
              if (oldVersion < 2 && db.objectStoreNames.contains(STORE_CHUNKS)) {
                db.deleteObjectStore(STORE_CHUNKS)
                db.createObjectStore(STORE_CHUNKS)
              }
            },
          }),
        )
      })

      const saveChunk = (worldId: WorldId, chunkCoord: ChunkCoord, data: Uint8Array) =>
        Effect.gen(function* () {
          yield* initialize
          if (!state.db) {
            return yield* Effect.fail(new StorageError({ operation: 'saveChunk', cause: 'Database not initialized' }))
          }

          const key = chunkKey(worldId, chunkCoord)
          yield* tryCatchStorage('saveChunk', () => state.db!.put(STORE_CHUNKS, data, key))
        })

      const loadChunk = (worldId: WorldId, chunkCoord: ChunkCoord) =>
        Effect.gen(function* () {
          yield* initialize
          if (!state.db) {
            return yield* Effect.fail(new StorageError({ operation: 'loadChunk', cause: 'Database not initialized' }))
          }

          const key = chunkKey(worldId, chunkCoord)
          const result = yield* tryCatchStorage('loadChunk', () => state.db!.get(STORE_CHUNKS, key))

          return result !== undefined ? Option.some(result) : Option.none()
        })

      const saveWorldMetadata = (worldId: WorldId, metadata: WorldMetadata) =>
        Effect.gen(function* () {
          yield* initialize
          if (!state.db) {
            return yield* Effect.fail(new StorageError({ operation: 'saveWorldMetadata', cause: 'Database not initialized' }))
          }

          yield* tryCatchStorage('saveWorldMetadata', () =>
            state.db!.put(STORE_METADATA, metadata, worldId),
          )
        })

      const loadWorldMetadata = (worldId: WorldId) =>
        Effect.gen(function* () {
          yield* initialize
          if (!state.db) {
            return yield* Effect.fail(new StorageError({ operation: 'loadWorldMetadata', cause: 'Database not initialized' }))
          }

          const result = yield* tryCatchStorage('loadWorldMetadata', () => state.db!.get(STORE_METADATA, worldId))

          return result !== undefined ? Option.some(result) : Option.none()
        })

      const deleteWorld = (worldId: WorldId) =>
        Effect.gen(function* () {
          yield* initialize
          if (!state.db) {
            return yield* Effect.fail(new StorageError({ operation: 'deleteWorld', cause: 'Database not initialized' }))
          }

          // Delete all chunks for this world
          const chunkKeys: string[] = yield* Effect.tryPromise({
            try: async () => {
              const keys: string[] = []
              let cursor = await state.db!.transaction(STORE_CHUNKS).store.openCursor()
              while (cursor) {
                if (cursor.key.toString().startsWith(`${worldId}:`)) {
                  keys.push(cursor.key.toString())
                }
                cursor = await cursor.continue()
              }
              return keys
            },
            catch: (cause) => new StorageError({ operation: 'deleteWorld', cause }),
          })

          for (const key of chunkKeys) {
            yield* tryCatchStorage('deleteWorld', () => state.db!.delete(STORE_CHUNKS, key))
          }

          // Delete metadata
          yield* tryCatchStorage('deleteWorld', () => state.db!.delete(STORE_METADATA, worldId))
        })

      return {
        initialize,
        saveChunk,
        loadChunk,
        saveWorldMetadata,
        loadWorldMetadata,
        deleteWorld,
      }
    }),
  }
) {}
export { StorageService as StorageServiceLive }
