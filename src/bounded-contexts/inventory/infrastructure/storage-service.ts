import { Schema } from '@effect/schema'
import { Clock, Effect, Layer, Match, Option, Random, pipe } from 'effect'
import type { Inventory, InventoryState, PlayerId } from '@mc/bc-inventory/domain/inventory-types'
import {
  BackupKey,
  BackupKeySchema,
  BackupSnapshot,
  InventoryStorageService,
  InventoryStoragePort,
  Milliseconds,
  MillisecondsSchema,
  StorageBackend,
  StorageBackendSchema,
  StorageConfig,
  StorageConfigSchema,
  StorageError,
  StorageErrors,
  StorageInfo,
  StorageKey,
  StorageKeySchema,
  defaultStorageConfig,
  decodeWith,
  formatParseError,
  toCorrupted,
  toLoadFailed,
  toNotAvailable,
  toQuotaExceeded,
  toSaveFailed,
} from '@mc/bc-inventory/domain/ports/storage'
import { InventorySchema, InventoryStateSchema, PlayerIdSchema } from '@mc/bc-inventory/domain/inventory-types'

export {
  BackupKey,
  BackupKeySchema,
  BackupSnapshot,
  InventoryStoragePort,
  InventoryStorageService,
  Milliseconds,
  MillisecondsSchema,
  StorageBackend,
  StorageBackendSchema,
  StorageConfig,
  StorageConfigSchema,
  StorageError,
  StorageErrors,
  StorageInfo,
  StorageKey,
  StorageKeySchema,
  defaultStorageConfig,
  toCorrupted,
  toLoadFailed,
  toNotAvailable,
  toQuotaExceeded,
  toSaveFailed,
} from '@mc/bc-inventory/domain/ports/storage'

const backend = Schema.decodeUnknownSync(StorageBackendSchema)('localStorage')

const inventoryPrefix = 'minecraft:inventory:'
const backupPrefix = 'minecraft:inventory:backup:'
const statePrefix = 'minecraft:inventory:state:'

const availabilityProbe = Effect.try({
  try: () => {
    const probeKey = `${inventoryPrefix}__probe__`
    localStorage.setItem(probeKey, 'probe')
    localStorage.removeItem(probeKey)
    return true
  },
  catch: (cause) => toNotAvailable(backend, 'LocalStorage is not accessible', cause),
})

const requireAvailability = availabilityProbe.pipe(
  Effect.flatMap((available) =>
    pipe(
      Match.value(available),
      Match.when(false, () => Effect.fail(toNotAvailable(backend, 'LocalStorage unavailable'))),
      Match.when(true, () => Effect.void),
      Match.exhaustive
    )
  )
)

const decodeJson = <A>(value: string, schema: Schema.Schema<A>, context: string) =>
  Effect.try({
    try: () => JSON.parse(value),
    catch: (cause) => toCorrupted(backend, `${context}: JSON decode failed`, cause),
  }).pipe(
    Effect.flatMap((raw) =>
      decodeWith(schema, raw, backend, context)
    )
  )

const encodeJson = <A>(value: A, schema: Schema.Schema<A>, context: string) =>
  Schema.encode(schema)(value).pipe(
    Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error)),
    Effect.flatMap((encoded) =>
      Effect.try({
        try: () => JSON.stringify(encoded),
        catch: (cause) => toSaveFailed(backend, `${context}: JSON encode failed`, 'Failed to serialise value', cause),
      })
    )
  )

const readItem = <A>(key: string, schema: Schema.Schema<A>, context: string) =>
  Effect.try({
    try: () => localStorage.getItem(key),
    catch: (cause) => toLoadFailed(backend, context, 'Failed to read LocalStorage item', cause),
  }).pipe(
    Effect.flatMap((raw) =>
      pipe(
        Option.fromNullable(raw),
        Option.match({
          onNone: () => Effect.succeed(Option.none<A>()),
          onSome: (value) =>
            decodeJson(value, schema, context).pipe(Effect.map((decoded) => Option.some(decoded))),
        })
      )
    )
  )

const writeItem = <A>(key: string, value: A, schema: Schema.Schema<A>, context: string) =>
  encodeJson(value, schema, context).pipe(
    Effect.flatMap((serialized) =>
      Effect.try({
        try: () => localStorage.setItem(key, serialized),
        catch: (cause) => toSaveFailed(backend, context, 'Failed to write LocalStorage item', cause),
      })
    )
  )

const removeItems = (keys: ReadonlyArray<string>, context: string) =>
  Effect.forEach(keys, (key) =>
    Effect.try({
      try: () => localStorage.removeItem(key),
      catch: (cause) => toSaveFailed(backend, context, `Failed to remove key ${key}`, cause),
    })
  , { concurrency: 'unbounded' }).pipe(Effect.asVoid)

const decodePlayerIdFromKey = (key: string): Effect.Effect<PlayerId, StorageError> =>
  pipe(
    key.startsWith(inventoryPrefix),
    Match.value,
    Match.when(false, () => Effect.fail(toCorrupted(backend, `Unexpected key format: ${key}`))),
    Match.when(true, () =>
      pipe(
        key.slice(inventoryPrefix.length),
        (raw) => Schema.decodeUnknown(PlayerIdSchema)(raw),
        Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
      )
    )
  )

export const makeStorageKey = (playerId: PlayerId): Effect.Effect<StorageKey, StorageError> =>
  pipe(
    Schema.encode(PlayerIdSchema)(playerId),
    Effect.map((encoded) => `${inventoryPrefix}${encoded}`),
    Effect.flatMap((raw) => decodeWith(StorageKeySchema, raw, backend, 'storage-key'))
  )

export const makeBackupKey = (
  playerId: PlayerId,
  timestamp: Milliseconds,
  nonce: string
): Effect.Effect<BackupKey, StorageError> =>
  Effect.gen(function* () {
    const encodedPlayerId = yield* Schema.encode(PlayerIdSchema)(playerId)
    const encodedMillis = yield* Schema.encode(MillisecondsSchema)(timestamp)
    const raw = `${backupPrefix}${encodedPlayerId}:${encodedMillis}:${nonce}`
    return yield* decodeWith(BackupKeySchema, raw, backend, 'backup-key')
  })

const takeSnapshot = (
  playerId: PlayerId,
  inventory: Inventory
): Effect.Effect<BackupSnapshot & { readonly payload: Inventory }, StorageError> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const nonce = yield* Random.nextString(9)
    const key = yield* makeBackupKey(playerId, now as Milliseconds, nonce)
    return { key, createdAt: now as Milliseconds, payload: inventory }
  })

const baseService = (
  config: StorageConfig
): InventoryStorageService => ({
  backend,
  config,
  saveInventory: (playerId, inventory) =>
    Effect.flatMap(makeStorageKey(playerId), (key) =>
      encodeJson(inventory, InventorySchema, `inventory:${playerId}`).pipe(
        Effect.flatMap((payload) => writeItem(key, payload, Schema.String, `inventory:${playerId}`))
      )
    ),
  loadInventory: (playerId) =>
    Effect.flatMap(makeStorageKey(playerId), (key) =>
      readItem(key, InventorySchema, `inventory:${playerId}`)
    ),
  saveInventoryState: (state) =>
    encodeJson(state, InventoryStateSchema, `state:${state.playerId}`).pipe(
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => localStorage.setItem(`${statePrefix}${state.playerId}`, payload),
          catch: (cause) => toSaveFailed(backend, `state:${state.playerId}`, 'Failed to persist inventory state', cause),
        })
      )
    ),
  loadInventoryState: (playerId) =>
    Effect.try({
      try: () => localStorage.getItem(`${statePrefix}${playerId}`),
      catch: (cause) => toLoadFailed(backend, `state:${playerId}`, 'Failed to load inventory state', cause),
    }).pipe(
      Effect.flatMap((raw) =>
        pipe(
          Option.fromNullable(raw),
          Option.match({
            onNone: () => Effect.succeed(Option.none<InventoryState>()),
            onSome: (value) =>
              decodeJson(value, InventoryStateSchema, `state:${playerId}`).pipe(
                Effect.map((decoded) => Option.some(decoded))
              ),
          })
        )
      )
    ),
  deleteInventory: (playerId) =>
    Effect.flatMap(makeStorageKey(playerId), (key) =>
      Effect.try({
        try: () => {
          localStorage.removeItem(key)
          localStorage.removeItem(`${statePrefix}${playerId}`)
        },
        catch: (cause) => toSaveFailed(backend, `inventory:${playerId}`, 'Failed to delete inventory', cause),
      })
    ),
  listStoredInventories: () =>
    Effect.try({
      try: () => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean) as string[],
      catch: (cause) => toLoadFailed(backend, 'inventory:list', 'Failed to list stored inventories', cause),
    }).pipe(
      Effect.flatMap((keys) =>
        Effect.forEach(keys, decodePlayerIdFromKey, { concurrency: 'unbounded' })
      )
    ),
  createBackup: (playerId) =>
    Effect.gen(function* () {
      const inventory = yield* pipe(
        Effect.flatMap(makeStorageKey(playerId), (key) => readItem(key, InventorySchema, `inventory:${playerId}`)),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(toLoadFailed(backend, `inventory:${playerId}`, 'Inventory not found')),
            onSome: Effect.succeed,
          })
        )
      )
      const snapshot = yield* takeSnapshot(playerId, inventory)
      yield* writeItem(snapshot.key, snapshot.payload, InventorySchema, `backup:${playerId}`)
      return snapshot
    }),
  restoreBackup: (playerId, snapshot) =>
    writeItem(snapshot.key, snapshot.payload, InventorySchema, `backup:${playerId}`).pipe(
      Effect.flatMap(() =>
        writeItem(`${inventoryPrefix}${playerId}`, snapshot.payload, InventorySchema, `inventory:${playerId}`)
      ),
      Effect.map(() => snapshot.payload)
    ),
  clearAllData: () =>
    Effect.try({
      try: () => localStorage.clear(),
      catch: (cause) => toSaveFailed(backend, 'inventory:clear', 'Failed to clear LocalStorage', cause),
    }),
  getStorageInfo: () =>
    Effect.try({
      try: () => ({
        totalSize: JSON.stringify(localStorage).length,
        availableSpace: Number.POSITIVE_INFINITY,
        itemCount: localStorage.length,
      }),
      catch: (cause) => toLoadFailed(backend, 'inventory:info', 'Failed to inspect LocalStorage', cause),
    }),
})

export const LocalStorageInventoryService = Layer.scoped(InventoryStorageService, (scope) =>
  Effect.gen(function* () {
    yield* requireAvailability
    const config = defaultStorageConfig
    const service = baseService(config)
    return yield* Layer.succeed(InventoryStorageService, service)(scope)
  })
)

export const IndexedDBInventoryService = LocalStorageInventoryService
export const HybridInventoryStorageService = IndexedDBInventoryService
