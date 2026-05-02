import { Brand, Effect, Option, Ref, Schema, Schedule, Duration } from 'effect'
import { deleteDatabase, openDatabase, DBSchema, TypedIDBDatabase } from './idb-utils'
import { WorldId } from '@ts-minecraft/kernel'
import { StorageError } from '../domain/errors'
import type { ChunkCoord } from '@ts-minecraft/kernel'

// Bumped from 2 → 3 for Phase 2.1 multi-noise. Must match terrain/domain/chunk.ts WORLD_SCHEMA_VERSION.
const WORLD_SCHEMA_VERSION = 3

type ChunkStorageValue =
  | Uint8Array<ArrayBufferLike>
  | {
      readonly blocks: Uint8Array<ArrayBufferLike>
      readonly fluid: Uint8Array<ArrayBufferLike> | undefined
    }
import { PositionSchema } from '@ts-minecraft/kernel'
import { InventorySaveDataSchema } from '@ts-minecraft/inventory'
import { BlockTypeSchema } from '@ts-minecraft/kernel'
import { RecipeIdSchema } from '@ts-minecraft/kernel'
import { GameModeSchema } from '@ts-minecraft/game'

// Bump when schema changes require migration (not just new optional fields with defaults).
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
  // pre-Phase-1 saves default to 'survival'
  gameMode: Schema.optionalWith(GameModeSchema, { default: () => 'survival' as const }),
  // pre-Phase-1 saves default to 1
  saveVersion: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => CURRENT_WORLD_SAVE_VERSION,
  }),
})
export type WorldMetadata = Schema.Schema.Type<typeof WorldMetadataSchema>

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

const DB_NAME = 'minecraft-worlds'
const DB_VERSION = 2  // v2: added SNOW/GRAVEL/COBBLESTONE block types; existing chunk data cleared on upgrade
const STORE_CHUNKS = 'chunks'
const STORE_METADATA = 'metadata'

// Namespaced to DB name to avoid collisions; `.schema-version` suffix avoids future gameplay key conflicts.
const SCHEMA_VERSION_LS_KEY = `${DB_NAME}.schema-version`

// Returns None when localStorage is unavailable (SSR, sandboxed tests, strict privacy).
const safeLocalStorage: Effect.Effect<Option.Option<Storage>> = Effect.sync(() => {
  try {
    return typeof localStorage !== 'undefined' ? Option.some(localStorage) : Option.none()
  } catch {
    return Option.none()
  }
})

// On schema mismatch, wipes the DB so the fresh open/upgrade path runs from scratch.
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

// "worldId:x:z" format; branded to prevent accidental plain-string usage.
export type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>
export const ChunkStorageKey = Brand.nominal<ChunkStorageKey>()

const chunkKey = (worldId: WorldId, chunkCoord: ChunkCoord): ChunkStorageKey =>
  ChunkStorageKey(`${worldId}:${chunkCoord.x}:${chunkCoord.z}`)

const isQuotaExceeded = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError'
  }
  return false
}

const tryCatchStorage = <A>(operation: string, effect: Effect.Effect<A, unknown>): Effect.Effect<A, StorageError> =>
  effect.pipe(
    Effect.mapError((cause) => {
      if (isQuotaExceeded(cause)) {
        return new StorageError({ operation, cause: 'Storage quota exceeded. Please clear some data.' })
      }
      return new StorageError({ operation, cause })
    })
  )

// Retries up to 3× with exponential backoff; skips retry for QuotaExceededError.
const tryCatchStorageWithRetry = <A>(operation: string, effect: Effect.Effect<A, unknown>): Effect.Effect<A, StorageError> =>
  tryCatchStorage(operation, effect).pipe(
    Effect.retry({
      while: (e: StorageError) => !isQuotaExceeded(e.cause),
      times: 3,
      schedule: Schedule.exponential(Duration.millis(100)),
    })
  )

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

      // Decoding failures do not abort — corrupt rows are collected for UI recovery display, not propagated.
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
