import { Effect, Option, Ref, Schema, Schedule, Duration } from 'effect'
import { openDatabase, DBSchema, TypedIDBDatabase } from './idb-utils'
import { WorldId } from '@/shared/kernel'
import { StorageError } from '@/domain/errors'
import type { ChunkCoord } from '@/domain/chunk'

export type { ChunkCoord }

/**
 * Schema for world metadata persisted to IndexedDB.
 * Note: uses Schema.DateFromSelf (JS Date instances), not Schema.Date (ISO string).
 */
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
export type WorldMetadata = Schema.Schema.Type<typeof WorldMetadataSchema>

/**
 * IndexedDB schema definition
 */
interface MinecraftWorldsDB extends DBSchema {
  chunks: {
    key: string
    value: Uint8Array
  }
  metadata: {
    key: string
    value: WorldMetadata
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
 * Helper to wrap IndexedDB operations with exponential backoff retry.
 * Retries up to 3 times with exponential delay, but skips retry for QuotaExceededError.
 */
const tryCatchStorageWithRetry = <A>(operation: string, fn: () => Promise<A>): Effect.Effect<A, StorageError> =>
  tryCatchStorage(operation, fn).pipe(
    Effect.retry({
      while: (e: StorageError) => !isQuotaExceeded(e.cause),
      times: 3,
      schedule: Schedule.exponential(Duration.millis(100)),
    })
  )

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
      const dbRef = yield* Ref.make<Option.Option<TypedIDBDatabase<MinecraftWorldsDB>>>(Option.none())

      const initialize: Effect.Effect<void, StorageError> = Effect.gen(function* () {
        yield* Option.match(yield* Ref.get(dbRef), {
          onSome: () => Effect.void,
          onNone: () => Effect.gen(function* () {
            const newDb = yield* tryCatchStorage('open database', () =>
              openDatabase<MinecraftWorldsDB>(DB_NAME, DB_VERSION, (db, oldVersion) => {
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
              }),
            )
            yield* Ref.set(dbRef, Option.some(newDb))
          }),
        })
      })

      const saveChunk = (worldId: WorldId, chunkCoord: ChunkCoord, data: Uint8Array) =>
        Effect.gen(function* () {
          yield* initialize
          yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'saveChunk', cause: 'Database not initialized' })),
            onSome: (db) => Effect.gen(function* () {
              const key = chunkKey(worldId, chunkCoord)
              yield* tryCatchStorageWithRetry('saveChunk', () => db.put(STORE_CHUNKS, data, key))
            }),
          })
        })

      const loadChunk = (worldId: WorldId, chunkCoord: ChunkCoord) =>
        Effect.gen(function* () {
          yield* initialize
          return yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'loadChunk', cause: 'Database not initialized' })),
            onSome: (db) => Effect.gen(function* () {
              const key = chunkKey(worldId, chunkCoord)
              const result = yield* tryCatchStorageWithRetry('loadChunk', () => db.get(STORE_CHUNKS, key))
              return Option.fromNullable(result)
            }),
          })
        })

      const saveWorldMetadata = (worldId: WorldId, metadata: WorldMetadata) =>
        Effect.gen(function* () {
          yield* initialize
          yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'saveWorldMetadata', cause: 'Database not initialized' })),
            onSome: (db) => tryCatchStorageWithRetry('saveWorldMetadata', () =>
              db.put(STORE_METADATA, metadata, worldId),
            ),
          })
        })

      const loadWorldMetadata = (worldId: WorldId) =>
        Effect.gen(function* () {
          yield* initialize
          return yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'loadWorldMetadata', cause: 'Database not initialized' })),
            onSome: (db) => Effect.gen(function* () {
              const result = yield* tryCatchStorageWithRetry('loadWorldMetadata', () => db.get(STORE_METADATA, worldId))
              return yield* Option.match(Option.fromNullable(result), {
                onNone: () => Effect.succeed(Option.none<WorldMetadata>()),
                onSome: (r) => Schema.decodeUnknown(WorldMetadataSchema)(r).pipe(
                  Effect.map(Option.some),
                  Effect.mapError((e) => new StorageError({ operation: 'loadWorldMetadata', cause: e }))
                ),
              })
            }),
          })
        })

      const deleteWorld = (worldId: WorldId) =>
        Effect.gen(function* () {
          yield* initialize
          yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'deleteWorld', cause: 'Database not initialized' })),
            onSome: (db) => Effect.gen(function* () {
              // Delete all chunks for this world
              const chunkKeys: ReadonlyArray<string> = yield* Effect.tryPromise({
                try: async () => {
                  const keys: string[] = []
                  for await (const cursor of db.openCursor(STORE_CHUNKS)) {
                    if (cursor.key.toString().startsWith(`${worldId}:`)) {
                      keys.push(cursor.key.toString())
                    }
                  }
                  return keys
                },
                catch: (cause) => new StorageError({ operation: 'deleteWorld', cause }),
              })
              yield* Effect.forEach(
                chunkKeys,
                (key) => tryCatchStorage('deleteWorld', () => db.delete(STORE_CHUNKS, key)),
                { concurrency: 1 }
              )
              // Delete metadata
              yield* tryCatchStorage('deleteWorld', () => db.delete(STORE_METADATA, worldId))
            }),
          })
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
export const StorageServiceLive = StorageService.Default
