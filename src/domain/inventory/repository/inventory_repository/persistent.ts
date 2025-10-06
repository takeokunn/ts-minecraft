import { Clock, Effect, HashMap, Layer, Option, Ref } from 'effect'
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
        try {
          const data = localStorage.getItem(config.storageKey)
          if (data) {
            const parsed = JSON.parse(data)
            const inventories = new Map<PlayerId, Inventory>()

            if (parsed.inventories) {
              Object.entries(parsed.inventories).forEach(([playerId, inventory]) => {
                const inv = inventory as Inventory
                // Map の復元
                inv.slots = new Map(Object.entries(inv.slots || {}))
                inventories.set(playerId as PlayerId, inv)
              })
            }

            yield* Ref.set(inventoryCache, HashMap.fromIterable(inventories))

            if (parsed.snapshots) {
              const snapshots = new Map<string, InventorySnapshot>()
              Object.entries(parsed.snapshots).forEach(([id, snapshot]) => {
                const snap = snapshot as InventorySnapshot
                // スナップショット内のInventoryのMap復元
                if (snap.inventory.slots) {
                  snap.inventory.slots = new Map(Object.entries(snap.inventory.slots))
                }
                snapshots.set(id, snap)
              })
              yield* Ref.set(snapshotCache, HashMap.fromIterable(snapshots))
            }
          }
        } catch (error) {
          yield* Effect.fail(createStorageError('localStorage', 'load', `Failed to load data: ${error}`))
        }
      })

      const saveToStorage = Effect.gen(function* () {
        try {
          const inventories = yield* Ref.get(inventoryCache)
          const snapshots = yield* Ref.get(snapshotCache)

          // Map を Object に変換してシリアライズ可能にする
          const inventoriesObj: Record<string, any> = {}
          HashMap.forEach(inventories, (inventory, playerId) => {
            inventoriesObj[playerId] = {
              ...inventory,
              slots: Object.fromEntries(inventory.slots),
            }
          })

          const snapshotsObj: Record<string, any> = {}
          HashMap.forEach(snapshots, (snapshot, id) => {
            snapshotsObj[id] = {
              ...snapshot,
              inventory: {
                ...snapshot.inventory,
                slots: Object.fromEntries(snapshot.inventory.slots),
              },
            }
          })

          const data = JSON.stringify({
            inventories: inventoriesObj,
            snapshots: snapshotsObj,
            version: 1,
            lastSaved: yield* Clock.currentTimeMillis,
          })

          localStorage.setItem(config.storageKey, data)
          yield* Ref.set(isDirty, false)
        } catch (error) {
          yield* Effect.fail(createStorageError('localStorage', 'save', `Failed to save data: ${error}`))
        }
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

                    const updatedInventory: Inventory = {
                      ...inventory,
                      slots: updatedSlots,
                      lastUpdated: yield* Clock.currentTimeMillis,
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

                    const updatedInventory: Inventory = {
                      ...inventory,
                      slots: updatedSlots,
                      lastUpdated: yield* Clock.currentTimeMillis,
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
                    const timestamp = yield* Clock.currentTimeMillis
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
                    const restoredInventory: Inventory = {
                      ...snapshot.inventory,
                      lastUpdated: yield* Clock.currentTimeMillis,
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
