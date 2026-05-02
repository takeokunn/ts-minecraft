import { Brand, Effect, Option, Ref, Schema, Schedule, Duration } from 'effect'
import { deleteDatabase, openDatabase, DBSchema, TypedIDBDatabase } from './idb-utils'
import { WorldId } from '@ts-minecraft/kernel'
import { StorageError } from '@ts-minecraft/domain'
import { WORLD_SCHEMA_VERSION, type ChunkCoord } from '@ts-minecraft/domain'
import type { ChunkStorageValue } from './storage-service-port'
import { PositionSchema } from '@ts-minecraft/kernel'
import { InventorySaveDataSchema } from '@ts-minecraft/domain'
import { BlockTypeSchema } from '@ts-minecraft/domain'
import { RecipeIdSchema } from '@ts-minecraft/kernel'
import { GameModeSchema } from '@ts-minecraft/game-mode'

/**
 * Latest WorldMetadata save version. Bumped on schema-shape changes that the
 * decoder cannot reconstruct from defaults alone (e.g. semantic field rename,
 * value transforms). Adding optional fields with defaults does NOT require a
 * version bump — the optionalWith default fills in legacy data automatically.
 */
export const CURRENT_WORLD_SAVE_VERSION = 1

const FurnaceItemStackSchema = Schema.Struct({
  blockType: BlockTypeSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
})

const FurnaceStateSchema = Schema.Struct({
  position: PositionSchema,
  input: Schema.NullOr(FurnaceItemStackSchema),
  fuel: Schema.NullOr(FurnaceItemStackSchema),
  output: Schema.NullOr(FurnaceItemStackSchema),
  activeRecipeId: Schema.NullOr(RecipeIdSchema),
  progressSecs: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
})

export type { ChunkCoord }

/**
 * Schema for world metadata persisted to IndexedDB.
 *
 * Note: uses Schema.DateFromSelf (JS Date instances), not Schema.Date (ISO string).
 *
 * Backward compatibility: `gameMode` and `saveVersion` are `Schema.optionalWith` —
 * legacy saves missing these fields decode cleanly with defaults applied
 * (`gameMode='survival'`, `saveVersion=1`). New writes always include both.
 */
export const WorldMetadataSchema = Schema.Struct({
  seed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  createdAt: Schema.DateFromSelf,
  lastPlayed: Schema.DateFromSelf,
  playerSpawn: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    y: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    z: Schema.Number.pipe(Schema.int()),
  }),
  playerState: Schema.optional(
    Schema.Struct({
      position: PositionSchema,
      health: Schema.Number.pipe(Schema.int(), Schema.between(0, 20)),
      inventory: InventorySaveDataSchema,
      timeOfDay: Schema.Number.pipe(Schema.finite(), Schema.between(0, 0.9999)),
    }),
  ),
  furnaceStates: Schema.optional(Schema.Array(FurnaceStateSchema)),
  /** Active game mode for the world. Pre-Phase-1 saves default to 'survival'. */
  gameMode: Schema.optionalWith(GameModeSchema, { default: () => 'survival' as const }),
  /** Save schema version for future migrations. Pre-Phase-1 saves default to 1. */
  saveVersion: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => CURRENT_WORLD_SAVE_VERSION,
  }),
})
export type WorldMetadata = Schema.Schema.Type<typeof WorldMetadataSchema>

/**
 * IndexedDB schema definition
 */
type MinecraftWorldsDB = DBSchema & {
  chunks: {
    key: string
    value: ChunkStorageValue
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
 * `localStorage` key recording the last WORLD_SCHEMA_VERSION successfully
 * associated with the `minecraft-worlds` IndexedDB database.
 *
 * The key is namespaced with the IndexedDB database name (`minecraft-worlds`)
 * so it cannot collide with unrelated apps sharing the same origin — only code
 * that targets the same DB reads/writes this key. The `.schema-version`
 * suffix further distinguishes it from any future gameplay keys that might
 * reuse the `minecraft-worlds` prefix.
 */
const SCHEMA_VERSION_LS_KEY = `${DB_NAME}.schema-version`

/**
 * Safe `localStorage` accessor. Returns `Option.none()` when localStorage is
 * unavailable (e.g. SSR, sandboxed tests, or when the access throws due to
 * strict privacy settings).
 */
const safeLocalStorage: Effect.Effect<Option.Option<Storage>> = Effect.sync(() => {
  try {
    return typeof localStorage !== 'undefined' ? Option.some(localStorage) : Option.none()
  } catch {
    return Option.none()
  }
})

/**
 * Version-gate subroutine. Checks the stored schema version under
 * `SCHEMA_VERSION_LS_KEY` and, if it differs from `WORLD_SCHEMA_VERSION`,
 * deletes the IndexedDB `minecraft-worlds` database so the fresh open/upgrade
 * path runs from scratch. Failures of `deleteDatabase` are logged (not
 * propagated as defects) so startup can still proceed — a subsequent open
 * will either succeed or surface its own error through the normal open path.
 *
 * When `localStorage` is unavailable, the gate is skipped with a warning.
 */
const runSchemaVersionGate: Effect.Effect<void> = Effect.gen(function* () {
  const storageOpt = yield* safeLocalStorage
  yield* Option.match(storageOpt, {
    onNone: () =>
      Effect.logWarning(
        `localStorage unavailable — skipping world schema version gate (expected v${WORLD_SCHEMA_VERSION})`,
      ),
    onSome: (ls) =>
      Effect.gen(function* () {
        const stored = yield* Effect.sync(() => Option.fromNullable(ls.getItem(SCHEMA_VERSION_LS_KEY)))
        const matches = Option.match(stored, {
          onNone: () => false,
          onSome: (value) => value === String(WORLD_SCHEMA_VERSION),
        })
        if (matches) return

        const label = Option.getOrElse(stored, () => 'unknown')
        yield* deleteDatabase(DB_NAME).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              ls.setItem(SCHEMA_VERSION_LS_KEY, String(WORLD_SCHEMA_VERSION))
            }),
          ),
          Effect.tap(() =>
            Effect.logInfo(
              `Wiped legacy v${label} world database (expected v${WORLD_SCHEMA_VERSION})`,
            ),
          ),
          Effect.catchAll((cause) =>
            Effect.logWarning(
              `Failed to wipe legacy v${label} world database: ${String(cause)} — continuing startup`,
            ),
          ),
        )
      }),
  })
})

/**
 * Branded composite key for IndexedDB chunk storage ("worldId:x:z" format).
 * Prevents accidental use of arbitrary strings as storage keys.
 */
export type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>
export const ChunkStorageKey = Brand.nominal<ChunkStorageKey>()

/**
 * Helper to create chunk key from worldId and chunk coordinates
 */
const chunkKey = (worldId: WorldId, chunkCoord: ChunkCoord): ChunkStorageKey =>
  ChunkStorageKey(`${worldId}:${chunkCoord.x}:${chunkCoord.z}`)

/**
 * Helper to check if error is quota exceeded
 */
const isQuotaExceeded = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError'
  }
  return false
}

/**
 * Helper to wrap IndexedDB operations in Effect
 */
const tryCatchStorage = <A>(operation: string, effect: Effect.Effect<A, unknown>): Effect.Effect<A, StorageError> =>
  effect.pipe(
    Effect.mapError((cause) => {
      if (isQuotaExceeded(cause)) {
        return new StorageError({ operation, cause: 'Storage quota exceeded. Please clear some data.' })
      }
      return new StorageError({ operation, cause })
    })
  )

/**
 * Helper to wrap IndexedDB operations with exponential backoff retry.
 * Retries up to 3 times with exponential delay, but skips retry for QuotaExceededError.
 */
const tryCatchStorageWithRetry = <A>(operation: string, effect: Effect.Effect<A, unknown>): Effect.Effect<A, StorageError> =>
  tryCatchStorage(operation, effect).pipe(
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
    effect: Ref.make<Option.Option<TypedIDBDatabase<MinecraftWorldsDB>>>(Option.none()).pipe(Effect.map((dbRef) => {

      const initialize: Effect.Effect<void, StorageError> = Effect.gen(function* () {
        yield* Option.match(yield* Ref.get(dbRef), {
          onSome: () => Effect.void,
          onNone: () => Effect.gen(function* () {
            yield* runSchemaVersionGate
            const newDb = yield* openDatabase<MinecraftWorldsDB>(DB_NAME, DB_VERSION, (db, oldVersion) => {
              if (!db.objectStoreNames.includes(STORE_CHUNKS)) {
                db.createObjectStore(STORE_CHUNKS)
              }
              if (!db.objectStoreNames.includes(STORE_METADATA)) {
                db.createObjectStore(STORE_METADATA)
              }
              // v1→v2: block type indices changed (SNOW=9, GRAVEL=10, COBBLESTONE=11 added)
              // Clear all saved chunks to prevent corrupt block type decoding
              if (oldVersion < 2 && db.objectStoreNames.includes(STORE_CHUNKS)) {
                db.deleteObjectStore(STORE_CHUNKS)
                db.createObjectStore(STORE_CHUNKS)
              }
            }).pipe(
              Effect.mapError((cause) => new StorageError({ operation: 'open database', cause }))
            )
            yield* Ref.set(dbRef, Option.some(newDb))
          }),
        })
      })

      const saveChunk = (worldId: WorldId, chunkCoord: ChunkCoord, data: ChunkStorageValue) =>
        Effect.gen(function* () {
          yield* initialize
          yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'saveChunk', cause: 'Database not initialized' })),
            onSome: (db) => Effect.gen(function* () {
              const key = chunkKey(worldId, chunkCoord)
              yield* tryCatchStorageWithRetry('saveChunk', db.put(STORE_CHUNKS, data, key))
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
              const result = yield* tryCatchStorageWithRetry('loadChunk', db.get(STORE_CHUNKS, key))
              return Option.fromNullable(result)
            }),
          })
        })

      const saveWorldMetadata = (worldId: WorldId, metadata: WorldMetadata) =>
        Effect.gen(function* () {
          yield* initialize
          yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'saveWorldMetadata', cause: 'Database not initialized' })),
            onSome: (db) => tryCatchStorageWithRetry('saveWorldMetadata', db.put(STORE_METADATA, metadata, worldId)),
          })
        })

      const loadWorldMetadata = (worldId: WorldId) =>
        Effect.gen(function* () {
          yield* initialize
          return yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'loadWorldMetadata', cause: 'Database not initialized' })),
            onSome: (db) => Effect.gen(function* () {
              const result = yield* tryCatchStorageWithRetry('loadWorldMetadata', db.get(STORE_METADATA, worldId))
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
              const keys: string[] = []
              yield* tryCatchStorage(
                'deleteWorld',
                db.forEachCursor(STORE_CHUNKS, (cursor) =>
                  Effect.sync(() => {
                    if (cursor.key.toString().startsWith(`${worldId}:`)) {
                      keys.push(cursor.key.toString())
                    }
                  })
                ),
              )
              yield* Effect.forEach(
                keys,
                (key) => tryCatchStorage('deleteWorld', db.delete(STORE_CHUNKS, key)),
                { concurrency: 1 }
              )
              // Delete metadata
              yield* tryCatchStorage('deleteWorld', db.delete(STORE_METADATA, worldId))
            }),
          })
        })

      /**
       * Enumerate every world metadata record. Decoding failures (corrupt rows)
       * do NOT abort the listing — they are collected into `corrupt` so the
       * main-menu UI can offer a "Corrupt: delete?" recovery row.
       *
       * Returned arrays are unsorted. The caller (main menu) is responsible for
       * sorting `valid` by `lastPlayed desc` for display.
       */
      const listWorldMetadata: Effect.Effect<{
        readonly valid: ReadonlyArray<{ readonly worldId: WorldId; readonly metadata: WorldMetadata }>
        readonly corrupt: ReadonlyArray<WorldId>
      }, StorageError> =
        Effect.gen(function* () {
          yield* initialize
          return yield* Option.match(yield* Ref.get(dbRef), {
            onNone: () => Effect.fail(new StorageError({ operation: 'listWorldMetadata', cause: 'Database not initialized' })),
            onSome: (db) => Effect.gen(function* () {
              const raw: Array<{ key: string; value: unknown }> = []
              yield* tryCatchStorage(
                'listWorldMetadata',
                db.forEachCursor(STORE_METADATA, (cursor) =>
                  Effect.sync(() => {
                    raw.push({ key: cursor.key.toString(), value: cursor.value })
                  }),
                ),
              )
              const valid: Array<{ worldId: WorldId; metadata: WorldMetadata }> = []
              const corrupt: Array<WorldId> = []
              yield* Effect.forEach(
                raw,
                (row) =>
                  Schema.decodeUnknown(WorldMetadataSchema)(row.value).pipe(
                    Effect.match({
                      onSuccess: (metadata) => {
                        valid.push({ worldId: row.key as WorldId, metadata })
                      },
                      onFailure: () => {
                        corrupt.push(row.key as WorldId)
                      },
                    }),
                  ),
                { concurrency: 1 },
              )
              return { valid: valid as ReadonlyArray<{ worldId: WorldId; metadata: WorldMetadata }>, corrupt: corrupt as ReadonlyArray<WorldId> }
            }),
          })
        })

      return {
        initialize,
        saveChunk,
        loadChunk,
        saveWorldMetadata,
        loadWorldMetadata,
        listWorldMetadata,
        deleteWorld,
      }
    })),
  }
) {}
export const StorageServiceLive = StorageService.Default
