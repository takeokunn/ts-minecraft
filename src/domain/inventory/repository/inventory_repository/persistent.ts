import { Clock, Effect, HashMap, Layer, Option, Ref, Schema, TreeFormatter } from 'effect'
import { now as timestampNow } from '@domain/shared/value_object/units/timestamp'
import { makeUnsafe as makeUnsafePlayerId } from '../../../shared/entities/player_id/operations'
import { makeUnsafeSlotPosition } from '../../value_object/slot_position/types'
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
} from '../../types'
import { createInventoryNotFoundError, createRepositoryError, createStorageError } from '../types'
import { InventoryRepository } from './index'
import { InventoryRepositoryStorageSchema } from './storage_schema'

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

const fromSlotsRecord = (record: InventorySlotsRecord | undefined): Map<SlotPosition, ItemStack> => {
  if (!record) {
    return new Map()
  }

  const entries: Array<[SlotPosition, ItemStack]> = []
  Object.entries(record).forEach(([position, stack]) => {
    if (stack !== null && stack !== undefined) {
      entries.push([makeUnsafeSlotPosition(Number(position)), stack])
    }
  })
  return new Map(entries)
}

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

        // データが存在しない場合は空の状態を返す
        if (!rawData) {
          return Effect.void
        }

        // JSON.parse → Schema.decodeUnknown による型安全な検証
        const validated = yield* Effect.try({
          try: () => JSON.parse(rawData),
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

        // Inventory復元: ObjectからMapへ変換
        const inventories = new Map<PlayerId, Inventory>()
        if (validated.inventories) {
          const inventoriesFromStorage = validated.inventories as Record<string, SerializableInventory>
          Object.entries(inventoriesFromStorage).forEach(([playerId, storedInventory]) => {
            inventories.set(makeUnsafePlayerId(playerId), deserializeInventory(storedInventory))
          })
        }

        // Snapshot復元: ObjectからMapへ変換
        const snapshots = new Map<string, InventorySnapshot>()
        if (validated.snapshots) {
          const snapshotsFromStorage = validated.snapshots as Record<string, SerializableSnapshot>
          Object.entries(snapshotsFromStorage).forEach(([id, storedSnapshot]) => {
            snapshots.set(id, deserializeSnapshot(storedSnapshot))
          })
        }

        // キャッシュへの保存
        yield* Ref.set(inventoryCache, HashMap.fromIterable(inventories))
        yield* Ref.set(snapshotCache, HashMap.fromIterable(snapshots))
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
        if (config.autoSaveInterval && config.autoSaveInterval > 0) {
          const intervalEffect = Effect.gen(function* () {
            const dirty = yield* Ref.get(isDirty)
            if (dirty) {
              yield* saveToStorage
            }
          })

          // 定期実行の設定（実際の実装では適切なスケジューラーを使用）
          // setInterval(() => {
          //   Effect.runPromise(intervalEffect)
          // }, config.autoSaveInterval)
        }
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
                      if (stack.itemId === itemId) {
                        results.push([position, stack] as const)
                      }
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
                    if (itemStack === null) {
                      updatedSlots.delete(position)
                    } else {
                      updatedSlots.set(position, itemStack)
                    }

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

            return inventories.filter((inventory) => {
              // 容量フィルター
              if (query.minCapacity !== undefined && inventory.capacity < query.minCapacity) {
                return false
              }
              if (query.maxCapacity !== undefined && inventory.capacity > query.maxCapacity) {
                return false
              }

              // アイテム所持フィルター
              if (query.hasItems !== undefined && query.hasItems.length > 0) {
                const inventoryItems = new Set(Array.from(inventory.slots.values()).map((stack) => stack.itemId))
                const hasAllItems = query.hasItems.every((itemId) => inventoryItems.has(itemId))
                if (!hasAllItems) return false
              }

              // 更新日時フィルター
              if (query.updatedAfter !== undefined && inventory.lastUpdated < query.updatedAfter) {
                return false
              }
              if (query.updatedBefore !== undefined && inventory.lastUpdated > query.updatedBefore) {
                return false
              }

              // 空フィルター
              if (query.excludeEmpty === true && inventory.slots.size === 0) {
                return false
              }

              return true
            })
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
                    const randomPart = Math.random().toString(36).substr(2, 9)
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
            if (dirty) {
              yield* saveToStorage
            }
          }),
      })
    })
  )

/**
 * デフォルト設定での永続化レイヤー
 */
export const InventoryRepositoryPersistentDefault = InventoryRepositoryPersistent(DefaultPersistentConfig)
