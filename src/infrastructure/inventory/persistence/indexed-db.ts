/**
 * IndexedDB ベースの Inventory 永続化サービス
 *
 * idb-keyval を Effect-TS ラッパーで包み、宣言的な API を提供する。
 */

import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Clock, Effect, Layer, Match, Option, Random, Schema, pipe } from 'effect'
import { clear, createStore, del, get, keys, set } from 'idb-keyval'
import type { StorageError } from '..'
import {
  InventoryStorageService,
  MillisecondsSchema,
  StorageBackendSchema,
  StorageConfig,
  StorageInfo,
  StorageKey,
  StorageKeySchema,
  makeBackupKey,
  makeStorageKey,
  toCorrupted,
  toLoadFailed,
  toNotAvailable,
  toSaveFailed,
  toStorageFailureCause,
} from '..'
import type { Inventory, InventoryState, PlayerId } from '../../../domain/inventory'
import { InventorySchema, InventoryStateSchema, PlayerIdSchema } from '../../../domain/inventory'

const backend = Schema.decodeUnknownSync(StorageBackendSchema)('indexedDB')

const inventoryStore = createStore('minecraft-inventory-db', 'inventories')
const stateStore = createStore('minecraft-inventory-db', 'states')
const backupStore = createStore('minecraft-inventory-db', 'backups')

const requireAvailability = Effect.sync(() => typeof indexedDB !== 'undefined').pipe(
  Effect.flatMap((available) =>
    pipe(
      Match.value(available),
      Match.when(false, () => Effect.fail(toNotAvailable(backend, 'IndexedDB is not available'))),
      Match.when(true, () => Effect.void),
      Match.exhaustive
    )
  )
)

const formatParseError = (error: Schema.ParseError): string => TreeFormatter.formatErrorSync(error)

const tryPromise = <A>(
  tag: 'load' | 'save' | 'delete' | 'clear',
  context: string,
  thunk: () => PromiseLike<A>
) =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) =>
      pipe(
        tag,
        Match.value,
        Match.when('load', () => toLoadFailed(backend, context, 'IndexedDB read failure', toStorageFailureCause(cause))),
        Match.when('save', () => toSaveFailed(backend, context, 'IndexedDB write failure', toStorageFailureCause(cause))),
        Match.when('delete', () => toSaveFailed(backend, context, 'IndexedDB delete failure', toStorageFailureCause(cause))),
        Match.when('clear', () => toSaveFailed(backend, context, 'IndexedDB clear failure', toStorageFailureCause(cause))),
        Match.exhaustive
      ),
  }).pipe(
    Effect.annotateLogs('inventory.storage.operation', tag),
    Effect.annotateLogs('inventory.storage.context', context)
  )

const decodeFromStore = <A>(value: unknown, schema: Schema.Schema<A>, context: string) =>
  pipe(
    Schema.decodeUnknown(schema)(value),
    Effect.mapError((error) => toCorrupted(backend, `${context}: ${formatParseError(error)}`, error)),
    Effect.annotateLogs('inventory.storage.operation', 'decode'),
    Effect.annotateLogs('inventory.storage.context', context)
  )

const encodeToStore = <A>(value: A, schema: Schema.Schema<A>, context: string) =>
  pipe(
    Schema.encode(schema)(value),
    Effect.mapError((error) => toCorrupted(backend, `${context}: ${formatParseError(error)}`, error)),
    Effect.annotateLogs('inventory.storage.operation', 'encode'),
    Effect.annotateLogs('inventory.storage.context', context)
  )

const randomNonce = Effect.gen(function* () {
  const value = yield* Random.nextIntBetween(0, 36 ** 9 - 1)
  return value.toString(36).padStart(9, '0')
})

const readInventory = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const storageKey = yield* makeStorageKey(playerId)
    const raw = yield* tryPromise('load', 'inventory', () => get(storageKey, inventoryStore))
    return yield* pipe(
      Option.fromNullable(raw),
      Option.match({
        onNone: () => Effect.succeed(Option.none<Inventory>()),
        onSome: (value) => decodeFromStore(value, InventorySchema, 'inventory-decode').pipe(Effect.map(Option.some)),
      })
    )
  })

const writeInventory = (playerId: PlayerId, inventory: Inventory) =>
  Effect.gen(function* () {
    const storageKey = yield* makeStorageKey(playerId)
    const encoded = yield* encodeToStore(inventory, InventorySchema, 'inventory-encode')
    yield* tryPromise('save', 'inventory', () => set(storageKey, encoded, inventoryStore))
    return inventory
  })

const readState = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const key = yield* encodeToStore(playerId, PlayerIdSchema, 'state-key')
    const raw = yield* tryPromise('load', 'inventory-state', () => get(key, stateStore))
    return yield* pipe(
      Option.fromNullable(raw),
      Option.match({
        onNone: () => Effect.succeed(Option.none<InventoryState>()),
        onSome: (value) =>
          decodeFromStore(value, InventoryStateSchema, 'inventory-state-decode').pipe(Effect.map(Option.some)),
      })
    )
  })

const writeState = (state: InventoryState) =>
  Effect.gen(function* () {
    const key = yield* encodeToStore(state.inventory.playerId, PlayerIdSchema, 'state-key')
    const encoded = yield* encodeToStore(state, InventoryStateSchema, 'inventory-state-encode')
    yield* tryPromise('save', 'inventory-state', () => set(key, encoded, stateStore))
  })

const deleteState = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const key = yield* encodeToStore(playerId, PlayerIdSchema, 'state-key')
    yield* tryPromise('delete', 'inventory-state', () => del(key, stateStore))
  })

const deleteInventoryRecord = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const storageKey = yield* makeStorageKey(playerId)
    yield* tryPromise('delete', 'inventory', () => del(storageKey, inventoryStore))
  })

const gatherPlayerIds = () =>
  tryPromise('load', 'list-keys', () => keys(inventoryStore)).pipe(
    Effect.flatMap((rawKeys) =>
      Effect.forEach(
        rawKeys,
        (key) =>
          Effect.gen(function* () {
            const storageKey = yield* Schema.decodeUnknown(StorageKeySchema)(key).pipe(
              Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
            )
            return yield* decodePlayerIdFromStorageKey(storageKey)
          }),
        { concurrency: 4 }
      )
    )
  )

const decodePlayerIdFromStorageKey = (storageKey: StorageKey): Effect.Effect<PlayerId, StorageError> =>
  pipe(
    Match.value(storageKey.startsWith('minecraft:inventory:')),
    Match.when(false, () => Effect.fail(toCorrupted(backend, `Invalid storage key: ${storageKey}`))),
    Match.when(true, () =>
      pipe(
        storageKey.slice('minecraft:inventory:'.length),
        Schema.decodeUnknown(PlayerIdSchema),
        Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
      )
    ),
    Match.exhaustive
  )

const decodeBackupPayload = (value: unknown) => decodeFromStore(value, InventorySchema, 'backup-decode')

const encodeBackupPayload = (inventory: Inventory) => encodeToStore(inventory, InventorySchema, 'backup-encode')

export const IndexedDBInventoryService = Layer.effect(
  InventoryStorageService,
  Effect.gen(function* () {
    const config: StorageConfig = {
      backend,
      autoSave: true,
      backupSlots: 3,
      saveInterval: 5_000,
      compression: false,
    }

    const service = {
      backend,
      config,
      saveInventory: (playerId: PlayerId, inventory: Inventory) =>
        Effect.gen(function* () {
          yield* requireAvailability
          yield* writeInventory(playerId, inventory)
        }),

      loadInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          return yield* readInventory(playerId)
        }),

      saveInventoryState: (state: InventoryState) =>
        Effect.gen(function* () {
          yield* requireAvailability
          yield* writeState(state)
        }),

      loadInventoryState: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          return yield* readState(playerId)
        }),

      deleteInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          yield* deleteInventoryRecord(playerId)
          yield* deleteState(playerId)
        }),

      listStoredInventories: () =>
        Effect.gen(function* () {
          yield* requireAvailability
          return yield* gatherPlayerIds()
        }),

      createBackup: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const inventoryOption = yield* readInventory(playerId)
          return yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.fail(toLoadFailed(backend, 'backup', 'Inventory not found for backup')),
              onSome: (inventory) =>
                Effect.gen(function* () {
                  const timestampValue = yield* Clock.currentTimeMillis
                  const timestamp = yield* Schema.decodeUnknown(MillisecondsSchema)(timestampValue).pipe(
                    Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
                  )
                  const nonce = yield* randomNonce
                  const key = yield* makeBackupKey(playerId, timestamp, nonce)
                  const encoded = yield* encodeBackupPayload(inventory)
                  yield* tryPromise('save', 'backup', () => set(key, encoded, backupStore))
                  return { key, createdAt: timestamp, payload: inventory }
                }),
            })
          )
        }),

      restoreBackup: (playerId: PlayerId, snapshot) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const raw = yield* tryPromise('load', 'backup-read', () => get(snapshot.key, backupStore))
          return yield* pipe(
            Option.fromNullable(raw),
            Option.match({
              onNone: () => Effect.fail(toLoadFailed(backend, 'backup-read', 'Backup payload missing')),
              onSome: (value) =>
                decodeBackupPayload(value).pipe(
                  Effect.flatMap((inventory) => writeInventory(playerId, inventory).pipe(Effect.as(inventory)))
                ),
            })
          )
        }),

      clearAllData: () =>
        Effect.gen(function* () {
          yield* requireAvailability
          yield* tryPromise('clear', 'inventory', () => clear(inventoryStore))
          yield* tryPromise('clear', 'inventory-state', () => clear(stateStore))
          yield* tryPromise('clear', 'backup', () => clear(backupStore))
        }),

      getStorageInfo: () =>
        Effect.gen(function* () {
          yield* requireAvailability
          const allKeys = yield* tryPromise('load', 'inventory-keys', () => keys(inventoryStore))
          const encoded = yield* Effect.forEach(
            allKeys,
            (key) => tryPromise('load', 'inventory', () => get(key, inventoryStore)),
            { concurrency: 4 }
          )
          const sizes = encoded.map((value) =>
            pipe(
              Option.fromNullable(value),
              Option.map((payload) => new Blob([JSON.stringify(payload)]).size),
              Option.getOrElse(() => 0)
            )
          )
          const totalSize = sizes.reduce((acc, size) => acc + size, 0)
          return {
            totalSize,
            availableSpace: Number.POSITIVE_INFINITY,
            itemCount: allKeys.length,
          } satisfies StorageInfo
        }),
    }

    return InventoryStorageService.of(service)
  })
)

export const HybridInventoryStorageService = IndexedDBInventoryService
