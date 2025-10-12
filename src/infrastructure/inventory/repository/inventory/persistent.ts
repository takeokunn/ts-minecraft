import { now as timestampNow } from '@domain/shared/value_object/units/timestamp'
import {
  InventoryRepository,
  InventoryRepositoryStorageSchema,
} from '@domain/inventory/repository/inventory_repository'
import { createInventoryNotFoundError, createRepositoryError, createStorageError } from '@domain/inventory/repository/types'
import type {
  Inventory,
  InventoryQuery,
  InventorySnapshot,
  InventoryTransferRequest,
  ItemId,
  ItemStack,
  PlayerId,
  SlotPosition,
  StackOperationRequest,
} from '@domain/inventory/types'
import { makeUnsafe as makeUnsafePlayerId } from '@domain/shared/entities/player_id/operations'
import { makeUnsafeSlotPosition } from '@domain/inventory/value_object/slot_position/types'
import { Clock, Effect, HashMap, Layer, Match, Option, pipe, Random, Ref, Schema, TreeFormatter } from 'effect'

/**
 * Persistent Storage Configuration
 */
export interface PersistentConfig {
  readonly storageKey: string
  readonly autoSaveInterval?: number
  readonly compressionEnabled?: boolean
  readonly encryptionEnabled?: boolean
}

export const DefaultPersistentConfig: PersistentConfig = {
  storageKey: 'minecraft-inventory-repository',
  autoSaveInterval: 30000, // 30秒
  compressionEnabled: false,
  encryptionEnabled: false,
}

type InventorySlotsRecord = Record<string, ItemStack | null>

type SerializableInventory = Omit<Inventory, 'slots'> & {
  readonly slots: InventorySlotsRecord
}

type SerializableSnapshot = Omit<InventorySnapshot, 'inventory'> & {
  readonly inventory: SerializableInventory
}

const toSlotsRecord = (slots: Map<SlotPosition, ItemStack>): InventorySlotsRecord => {
  const record: InventorySlotsRecord = {}
  slots.forEach((stack, position) => {
    record[String(position)] = stack
  })
  return record
}

const fromSlotsRecord = (record: InventorySlotsRecord | undefined): Map<SlotPosition, ItemStack> =>
  pipe(
    record,
    Option.fromNullable,
    Match.value,
    Match.tag('None', () => new Map()),
    Match.tag('Some', ({ value }) =>
      pipe(
        Object.entries(value),
        (entries) =>
          entries.reduce<Array<[SlotPosition, ItemStack]>>((acc, [position, stack]) => {
            return pipe(
              stack,
              Option.fromNullable,
              Match.value,
              Match.tag('None', () => acc),
              Match.tag('Some', ({ value: stackValue }) => {
                acc.push([makeUnsafeSlotPosition(Number(position)), stackValue])
                return acc
              }),
              Match.exhaustive
            )
          }, []),
        (entries) => new Map(entries)
      )
    ),
    Match.exhaustive
  )

const serializeInventory = (inventory: Inventory): SerializableInventory => ({
  ...inventory,
  slots: toSlotsRecord(inventory.slots),
})

const deserializeInventory = (inventory: SerializableInventory): Inventory => ({
  ...inventory,
  slots: fromSlotsRecord(inventory.slots),
})

const serializeSnapshot = (snapshot: InventorySnapshot): SerializableSnapshot => ({
  ...snapshot,
  inventory: serializeInventory(snapshot.inventory),
})

const deserializeSnapshot = (snapshot: SerializableSnapshot): InventorySnapshot => ({
  ...snapshot,
  inventory: deserializeInventory(snapshot.inventory),
})

/**
 * InventoryRepository Persistent Implementation
 *
 * 永続化実装。ローカルストレージ・IndexedDB等を使用して永続化する。
 * ブラウザ環境での実運用向け。
 */
export const InventoryRepositoryPersistent = (config: PersistentConfig = DefaultPersistentConfig) =>
  Layer.effect(
    InventoryRepository,
    Effect.gen(function* () {
      // インメモリキャッシュ
      const inventoryCache = yield* Ref.make(HashMap.empty<PlayerId, Inventory>())
      const snapshotCache = yield* Ref.make(HashMap.empty<string, InventorySnapshot>())
      const isDirty = yield* Ref.make(false)

      // ストレージ操作のヘルパー関数
      const loadFromStorage = Effect.gen(function* () {
        // LocalStorageからのデータ読み込み
        const rawData = yield* Effect.try({
          try: () => localStorage.getItem(config.storageKey),
          catch: (error) => createStorageError('localStorage', 'load', `Failed to get item: ${error}`),
        })

        return yield* pipe(
          Option.fromNullable(rawData),
          Match.value,
          Match.tag('None', () => Effect.void),
          Match.tag('Some', ({ value }) =>
            Effect.gen(function* () {
              const validated = yield* Effect.try({
                try: () => JSON.parse(value),
                catch: (cause) => createStorageError('localStorage', 'load', `JSON parse failed: ${cause}`),
              }).pipe(
                Effect.flatMap(Schema.decodeUnknown(InventoryRepositoryStorageSchema)),
                Effect.mapError((error) =>
                  createStorageError(
                    'localStorage',
                    'load',
                    `Schema validation failed: ${TreeFormatter.formatErrorSync(error)}`
                  )
                )
              )

              const inventories = yield* pipe(
                Option.fromNullable(validated.inventories),
                Match.value,
                Match.tag('None', () => Effect.succeed(new Map<PlayerId, Inventory>())),
                Match.tag('Some', ({ value: record }) =>
                  Effect.succeed(
                    new Map(
                      Object.entries(record as Record<string, SerializableInventory>).map(
                        ([playerId, storedInventory]) => [
                          makeUnsafePlayerId(playerId),
                          deserializeInventory(storedInventory),
                        ]
                      )
                    )
                  )
                ),
                Match.exhaustive
              )

              const snapshots = yield* pipe(
                Option.fromNullable(validated.snapshots),
                Match.value,
                Match.tag('None', () => Effect.succeed(new Map<string, InventorySnapshot>())),
                Match.tag('Some', ({ value: record }) =>
                  Effect.succeed(
                    new Map(
                      Object.entries(record as Record<string, SerializableSnapshot>).map((entry) => [
                        entry[0],
                        deserializeSnapshot(entry[1]),
                      ])
                    )
                  )
                ),
                Match.exhaustive
              )

              yield* Ref.set(inventoryCache, HashMap.fromIterable(inventories))
              yield* Ref.set(snapshotCache, HashMap.fromIterable(snapshots))
            })
          ),
          Match.exhaustive
        )
      })

      const saveToStorage = Effect.gen(function* () {
        const inventories = yield* Ref.get(inventoryCache)
        const snapshots = yield* Ref.get(snapshotCache)
        const timestamp = yield* Clock.currentTimeMillis

        // Map を Object に変換してシリアライズ可能にする
        const inventoriesObj: Record<string, SerializableInventory> = {}
        HashMap.forEach(inventories, (inventory, playerId) => {
          inventoriesObj[playerId] = serializeInventory(inventory)
        })

        const snapshotsObj: Record<string, SerializableSnapshot> = {}
        HashMap.forEach(snapshots, (snapshot, id) => {
          snapshotsObj[id] = serializeSnapshot(snapshot)
        })

        const data = JSON.stringify({
          inventories: inventoriesObj,
          snapshots: snapshotsObj,
          version: 1,
          lastSaved: timestamp,
        })

        yield* Effect.try({
          try: () => {
            localStorage.setItem(config.storageKey, data)
          },
          catch: (error) => createStorageError('localStorage', 'save', `Failed to save data: ${error}`),
        })

        yield* Ref.set(isDirty, false)
      })

      // 定期保存の設定
      const setupAutoSave = Effect.gen(function* () {
        yield* pipe(
          Option.fromNullable(config.autoSaveInterval),
          Match.value,
          Match.tag('None', () => Effect.void),
          Match.tag('Some', ({ value }) =>
            pipe(
              Match.value(value > 0),
              Match.when(false, () => Effect.void),
              Match.orElse(() =>
                Effect.gen(function* () {
                  const intervalEffect = Effect.gen(function* () {
                    const dirty = yield* Ref.get(isDirty)
                    return yield* pipe(
                      Match.value(dirty),
                      Match.when(false, () => Effect.void),
                      Match.orElse(() => saveToStorage),
                      Match.exhaustive
                    )
                  })

                  // 定期実行の設定（実際の実装では適切なスケジューラーを使用）
                  // setInterval(() => {
                  //   Effect.runPromise(intervalEffect)
                  // }, value)
                  return Effect.void
                })
              ),
              Match.exhaustive
            )
          ),
          Match.exhaustive
        )
      })

      // 初期化時にデータをロード
      yield* loadFromStorage
      yield* setupAutoSave

      return InventoryRepository.of({
        save: (inventory: Inventory) =>
          Effect.gen(function* () {
            yield* Ref.update(inventoryCache, (cache) => HashMap.set(cache, inventory.playerId, inventory))
            yield* Ref.set(isDirty, true)
          }),

        findByPlayerId: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            return HashMap.get(cache, playerId)
          }),

        findItemsByPlayerId: (playerId: PlayerId, itemId: ItemId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            const inventoryOption = HashMap.get(cache, playerId)

            return yield* pipe(
              inventoryOption,
              Option.match({
                onNone: () => Effect.succeed([]),
                onSome: (inventory) =>
                  Effect.sync(() => {
                    const results: Array<readonly [SlotPosition, ItemStack]> = []
                    inventory.slots.forEach((stack, position) => {
                      pipe(
                        Match.value(stack.itemId === itemId),
                        Match.when(true, () => results.push([position, stack] as const)),
                        Match.exhaustive
                      )
                    })
                    return results
                  }),
              })
            )
          }),

        updateSlot: (playerId: PlayerId, position: SlotPosition, itemStack: ItemStack | null) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            const inventoryOption = HashMap.get(cache, playerId)

            yield* pipe(
              inventoryOption,
              Option.match({
                onNone: () => Effect.fail(createInventoryNotFoundError(playerId)),
                onSome: (inventory) =>
                  Effect.gen(function* () {
                    const updatedSlots = new Map(inventory.slots)
                    yield* pipe(
                      Option.fromNullable(itemStack),
                      Match.value,
                      Match.tag('None', () => Effect.sync(() => updatedSlots.delete(position))),
                      Match.tag('Some', ({ value }) => Effect.sync(() => updatedSlots.set(position, value))),
                      Match.exhaustive
                    )

                    const timestamp = yield* timestampNow()
                    const updatedInventory: Inventory = {
                      ...inventory,
                      slots: updatedSlots,
                      lastUpdated: timestamp,
                      version: inventory.version + 1,
                    }

                    yield* Ref.update(inventoryCache, (cache) => HashMap.set(cache, playerId, updatedInventory))
                    yield* Ref.set(isDirty, true)
                  }),
              })
            )
          }),

        clearSlot: (playerId: PlayerId, position: SlotPosition) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            const inventoryOption = HashMap.get(cache, playerId)

            yield* pipe(
              inventoryOption,
              Option.match({
                onNone: () => Effect.fail(createInventoryNotFoundError(playerId)),
                onSome: (inventory) =>
                  Effect.gen(function* () {
                    const updatedSlots = new Map(inventory.slots)
                    updatedSlots.delete(position)

                    const timestamp = yield* timestampNow()
                    const updatedInventory: Inventory = {
                      ...inventory,
                      slots: updatedSlots,
                      lastUpdated: timestamp,
                      version: inventory.version + 1,
                    }

                    yield* Ref.update(inventoryCache, (cache) => HashMap.set(cache, playerId, updatedInventory))
                    yield* Ref.set(isDirty, true)
                  }),
              })
            )
          }),

        delete: (playerId: PlayerId) =>
          Effect.gen(function* () {
            yield* Ref.update(inventoryCache, (cache) => HashMap.remove(cache, playerId))
            yield* Ref.set(isDirty, true)
          }),

        exists: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            return HashMap.has(cache, playerId)
          }),

        count: () =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            return HashMap.size(cache)
          }),

        saveMany: (inventories: ReadonlyArray<Inventory>) =>
          Effect.gen(function* () {
            yield* Ref.update(inventoryCache, (cache) => {
              let updatedCache = cache
              inventories.forEach((inventory) => {
                updatedCache = HashMap.set(updatedCache, inventory.playerId, inventory)
              })
              return updatedCache
            })
            yield* Ref.set(isDirty, true)
          }),

        findByQuery: (query: InventoryQuery) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            const inventories = Array.from(HashMap.values(cache))

            return inventories.filter((inventory) =>
              pipe(
                [
                  pipe(
                    Option.fromNullable(query.minCapacity),
                    Match.value,
                    Match.tag('None', () => true),
                    Match.tag('Some', ({ value }) => inventory.capacity >= value),
                    Match.exhaustive
                  ),
                  pipe(
                    Option.fromNullable(query.maxCapacity),
                    Match.value,
                    Match.tag('None', () => true),
                    Match.tag('Some', ({ value }) => inventory.capacity <= value),
                    Match.exhaustive
                  ),
                  pipe(
                    Option.fromNullable(query.hasItems),
                    Match.value,
                    Match.tag('None', () => true),
                    Match.tag('Some', ({ value }) =>
                      pipe(
                        Match.value(value.length === 0),
                        Match.when(true, () => true),
                        Match.orElse(() => {
                          const inventoryItems = new Set(
                            Array.from(inventory.slots.values()).map((stack) => stack.itemId)
                          )
                          return value.every((itemId) => inventoryItems.has(itemId))
                        }),
                        Match.exhaustive
                      )
                    ),
                    Match.exhaustive
                  ),
                  pipe(
                    Option.fromNullable(query.updatedAfter),
                    Match.value,
                    Match.tag('None', () => true),
                    Match.tag('Some', ({ value }) => inventory.lastUpdated >= value),
                    Match.exhaustive
                  ),
                  pipe(
                    Option.fromNullable(query.updatedBefore),
                    Match.value,
                    Match.tag('None', () => true),
                    Match.tag('Some', ({ value }) => inventory.lastUpdated <= value),
                    Match.exhaustive
                  ),
                  pipe(
                    Match.value(query.excludeEmpty === true && inventory.slots.size === 0),
                    Match.when(true, () => false),
                    Match.orElse(() => true),
                    Match.exhaustive
                  ),
                ],
                (conditions) => conditions.every(Boolean)
              )
            )
          }),

        transfer: (request: InventoryTransferRequest) =>
          Effect.gen(function* () {
            // 実装を簡略化（実際にはアトミックなトランザクション処理が必要）
            yield* Effect.fail(
              createRepositoryError('transfer', 'Persistent implementation does not support transfer yet')
            )
          }),

        stackOperation: (request: StackOperationRequest) =>
          Effect.gen(function* () {
            // 実装を簡略化（実際にはスタック操作の実装が必要）
            yield* Effect.fail(
              createRepositoryError('stackOperation', 'Persistent implementation does not support stackOperation yet')
            )
          }),

        createSnapshot: (playerId: PlayerId, snapshotName: string) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(inventoryCache)
            const inventoryOption = HashMap.get(cache, playerId)

            return yield* pipe(
              inventoryOption,
              Option.match({
                onNone: () => Effect.fail(createInventoryNotFoundError(playerId)),
                onSome: (inventory) =>
                  Effect.gen(function* () {
                    const timestamp = yield* timestampNow()
                    const randomNum = yield* Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER)
                    const randomPart = randomNum.toString(36).substring(2, 11)
                    const snapshotId = `snapshot-${timestamp}-${randomPart}`
                    const snapshot: InventorySnapshot = {
                      id: snapshotId,
                      name: snapshotName,
                      playerId,
                      inventory: structuredClone(inventory),
                      createdAt: timestamp,
                    }

                    yield* Ref.update(snapshotCache, (cache) => HashMap.set(cache, snapshot.id, snapshot))
                    yield* Ref.set(isDirty, true)

                    return snapshot
                  }),
              })
            )
          }),

        restoreFromSnapshot: (snapshotId: string) =>
          Effect.gen(function* () {
            const snapshots = yield* Ref.get(snapshotCache)
            const snapshotOption = HashMap.get(snapshots, snapshotId)

            yield* pipe(
              snapshotOption,
              Option.match({
                onNone: () =>
                  Effect.fail(createRepositoryError('restoreFromSnapshot', `Snapshot not found: ${snapshotId}`)),
                onSome: (snapshot) =>
                  Effect.gen(function* () {
                    const lastUpdated = yield* timestampNow()
                    const restoredInventory: Inventory = {
                      ...snapshot.inventory,
                      lastUpdated,
                      version: snapshot.inventory.version + 1,
                    }

                    yield* Ref.update(inventoryCache, (cache) =>
                      HashMap.set(cache, snapshot.playerId, restoredInventory)
                    )
                    yield* Ref.set(isDirty, true)
                  }),
              })
            )
          }),

        initialize: () =>
          Effect.gen(function* () {
            yield* loadFromStorage
          }),

        cleanup: () =>
          Effect.gen(function* () {
            const dirty = yield* Ref.get(isDirty)
            yield* pipe(
              Match.value(dirty),
              Match.when(false, () => Effect.void),
              Match.orElse(() => saveToStorage),
              Match.exhaustive
            )
          }),
      })
    })
  )

/**
 * デフォルト設定での永続化レイヤー
 */
export const InventoryRepositoryPersistentDefault = InventoryRepositoryPersistent(DefaultPersistentConfig)
