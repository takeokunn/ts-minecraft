/**
 * LocalStorage ベースの Inventory 永続化サービス
 *
 * - 制御構文: Effect.Match / combinator のみ
 * - 副作用: Effect.gen で遅延評価
 * - 型安全: Brand + Schema decode により `as` 排除
 */

import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Clock, Effect, Layer, Match, Option, Random, Schema, pipe } from 'effect'
import type { StorageError } from '..'
import {
  InventoryStorageService,
  MillisecondsSchema,
  StorageConfig,
  StorageInfo,
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

const backend = 'localStorage' satisfies StorageBackend

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
  catch: (cause) => toNotAvailable(backend, 'LocalStorage is not accessible', toStorageFailureCause(cause)),
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

const formatParseError = (error: Schema.ParseError): string => TreeFormatter.formatErrorSync(error)

const decodeJson = <A>(value: string, schema: Schema.Schema<A>, context: string) =>
  Schema.parseJson(schema)(value).pipe(Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error)))

const encodeJson = <A>(value: A, schema: Schema.Schema<A>, context: string) =>
  Schema.encodeJson(schema)(value).pipe(
    Effect.mapError((error) => toSaveFailed(backend, `${context}: JSON encode failed`, formatParseError(error), error))
  )

const readItem = <A>(key: string, schema: Schema.Schema<A>, context: string) =>
  Effect.try({
    try: () => localStorage.getItem(key),
    catch: (cause) => toLoadFailed(backend, context, 'Failed to read LocalStorage item', toStorageFailureCause(cause)),
  }).pipe(
    Effect.flatMap((raw) =>
      pipe(
        Option.fromNullable(raw),
        Option.match({
          onNone: () => Effect.succeed(Option.none<A>()),
          onSome: (value) => decodeJson(value, schema, context).pipe(Effect.map((decoded) => Option.some(decoded))),
        })
      )
    )
  )

const writeItem = <A>(key: string, value: A, schema: Schema.Schema<A>, context: string) =>
  encodeJson(value, schema, context).pipe(
    Effect.flatMap((serialized) =>
      Effect.try({
        try: () => localStorage.setItem(key, serialized),
        catch: (cause) =>
          toSaveFailed(backend, context, 'Failed to write LocalStorage item', toStorageFailureCause(cause)),
      })
    )
  )

const removeItems = (keys: ReadonlyArray<string>, context: string) =>
  Effect.forEach(
    keys,
    (key) =>
      Effect.try({
        try: () => localStorage.removeItem(key),
        catch: (cause) => toSaveFailed(backend, context, `Failed to remove key ${key}`, toStorageFailureCause(cause)),
      }),
    { concurrency: 4 }
  ).pipe(Effect.asVoid)

const decodePlayerIdFromKey = (key: string): Effect.Effect<PlayerId, StorageError> =>
  pipe(
    key.startsWith(inventoryPrefix),
    Match.value,
    Match.when(false, () => Effect.fail(toCorrupted(backend, `Unexpected key format: ${key}`))),
    Match.when(true, () =>
      pipe(
        key.slice(inventoryPrefix.length),
        Schema.decodeUnknown(PlayerIdSchema),
        Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
      )
    ),
    Match.exhaustive
  )

const gatherKeys = (prefix: string): Effect.Effect<ReadonlyArray<string>, StorageError> =>
  Effect.gen(function* () {
    yield* requireAvailability
    const length = localStorage.length
    const indices = Array.from({ length }, (_, index) => index)
    const rawKeys = yield* Effect.forEach(
      indices,
      (index) =>
        Effect.try({
          try: () => localStorage.key(index),
          catch: (cause) =>
            toLoadFailed(backend, 'list-keys', 'Failed to enumerate keys', toStorageFailureCause(cause)),
        }),
      { concurrency: 4 }
    )

    return rawKeys.filter((maybeKey): maybeKey is string => typeof maybeKey === 'string' && maybeKey.startsWith(prefix))
  })

const snapshotPayload = (inventory: Inventory, key: string, context: string): Effect.Effect<Inventory, StorageError> =>
  writeItem(key, inventory, InventorySchema, context).pipe(Effect.as(inventory))

const randomNonce = Effect.gen(function* () {
  const value = yield* Random.nextIntBetween(0, 36 ** 9 - 1)
  return value.toString(36).padStart(9, '0')
})

export const LocalStorageInventoryService = Layer.effect(
  InventoryStorageService,
  Effect.gen(function* () {
    const config: StorageConfig = {
      backend,
      autoSave: true,
      saveInterval: 5_000,
      backupSlots: 3,
      compression: false,
    }

    const base = {
      backend,
      config,
      saveInventory: (playerId: PlayerId, inventory: Inventory) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const storageKey = yield* makeStorageKey(playerId)
          return yield* snapshotPayload(inventory, storageKey, 'inventory')
        }),

      loadInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const storageKey = yield* makeStorageKey(playerId)
          return yield* readItem(storageKey, InventorySchema, 'inventory')
        }),

      saveInventoryState: (state: InventoryState) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const key = `${statePrefix}${state.inventory.playerId}`
          return yield* writeItem(key, state, InventoryStateSchema, 'inventory-state')
        }),

      loadInventoryState: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const key = `${statePrefix}${playerId}`
          return yield* readItem(key, InventoryStateSchema, 'inventory-state')
        }),

      deleteInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const inventoryKey = yield* makeStorageKey(playerId)
          const stateKey = `${statePrefix}${playerId}`
          return yield* removeItems([inventoryKey, stateKey], 'delete-inventory')
        }),

      listStoredInventories: () =>
        Effect.gen(function* () {
          const keys = yield* gatherKeys(inventoryPrefix)
          const decoded = yield* Effect.forEach(keys, decodePlayerIdFromKey, { concurrency: 4 })
          return decoded
        }),

      createBackup: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const inventoryOption = yield* base.loadInventory(playerId)

          return yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.fail(toLoadFailed(backend, 'backup', 'Inventory not found for backup')),
              onSome: (inventory) =>
                Effect.gen(function* () {
                  const millisValue = yield* Clock.currentTimeMillis
                  const millis = yield* Schema.decodeUnknown(MillisecondsSchema)(millisValue).pipe(
                    Effect.mapError((error) => toCorrupted(backend, formatParseError(error), error))
                  )
                  const nonce = yield* randomNonce
                  const backupKey = yield* makeBackupKey(playerId, millis, nonce)
                  yield* snapshotPayload(inventory, backupKey, 'backup')
                  return { key: backupKey, createdAt: millis, payload: inventory }
                }),
            })
          )
        }),

      restoreBackup: (playerId: PlayerId, snapshot) =>
        Effect.gen(function* () {
          yield* requireAvailability
          const raw = yield* readItem(snapshot.key, InventorySchema, 'backup-read')
          return yield* pipe(
            raw,
            Option.match({
              onNone: () => Effect.fail(toLoadFailed(backend, 'backup-read', 'Backup payload missing')),
              onSome: (inventory) => base.saveInventory(playerId, inventory).pipe(Effect.as(inventory)),
            })
          )
        }),

      clearAllData: () =>
        Effect.gen(function* () {
          yield* requireAvailability
          const keys = yield* gatherKeys(inventoryPrefix)
          const stateKeys = yield* gatherKeys(statePrefix)
          const backupKeys = yield* gatherKeys(backupPrefix)
          return yield* removeItems([...keys, ...stateKeys, ...backupKeys], 'clear-all')
        }),

      getStorageInfo: () =>
        Effect.gen(function* () {
          yield* requireAvailability
          const keys = yield* gatherKeys(inventoryPrefix)
          const bytes = yield* Effect.forEach(
            keys,
            (key) =>
              Effect.try({
                try: () => {
                  const value = localStorage.getItem(key)
                  return Option.fromNullable(value).pipe(
                    Option.map((v) => new Blob([v]).size),
                    Option.getOrElse(() => 0)
                  )
                },
                catch: (cause) =>
                  toLoadFailed(
                    backend,
                    'storage-info',
                    `Failed to compute size for ${key}`,
                    toStorageFailureCause(cause)
                  ),
              }),
            { concurrency: 4 }
          )

          const totalSize = bytes.reduce((acc, current) => acc + current, 0)
          const availableSpace = Number.POSITIVE_INFINITY
          return { totalSize, availableSpace, itemCount: keys.length } satisfies StorageInfo
        }),
    }

    return InventoryStorageService.of(base)
  })
)
