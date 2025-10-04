/**
 * IndexedDB-based inventory persistence service
 *
 * idb-keyvalを使用したInventoryデータの高性能永続化
 * 大量データや複雑なクエリに対応
 */

import { Effect, Layer, Match, Option, pipe } from 'effect'
import type { UseStore } from 'idb-keyval'
import { clear, createStore, del, get, keys, set, values } from 'idb-keyval'

// Import domain types (interfaces only)
import type { Inventory, InventoryState, PlayerId } from '../../../domain/inventory/types'
import { InventoryStorageService as InventoryStorageServiceTag, StorageError } from '../storage-service'

// IndexedDB-specific configuration
export interface IndexedDBConfig {
  readonly databaseName: string
  readonly storeName: string
  readonly version: number
}

// Default IndexedDB configuration
export const defaultIndexedDBConfig: IndexedDBConfig = {
  databaseName: 'minecraft-inventory-db',
  storeName: 'inventories',
  version: 1,
}

// IndexedDB service implementation using idb-keyval
export const IndexedDBInventoryService = Layer.effect(
  InventoryStorageServiceTag,
  Effect.gen(function* () {
    // Create custom store for inventory data
    const inventoryStore: UseStore = createStore(defaultIndexedDBConfig.databaseName, defaultIndexedDBConfig.storeName)

    // Key generators
    const generateInventoryKey = (playerId: PlayerId): string => `inventory:${playerId}`
    const generateStateKey = (playerId: PlayerId): string => `state:${playerId}`
    const generateBackupKey = (playerId: PlayerId, backupId: string): string => `backup:${playerId}:${backupId}`

    // Test IndexedDB availability
    const isIndexedDBAvailable = (): boolean => {
      try {
        return typeof indexedDB !== 'undefined'
      } catch {
        return false
      }
    }

    return InventoryStorageServiceTag.of({
      saveInventory: (playerId: PlayerId, inventory: Inventory) =>
        Effect.gen(function* () {
          yield* pipe(
            Match.value(isIndexedDBAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.tryPromise({
                try: async (): Promise<void> => {
                  const key = generateInventoryKey(playerId)
                  await set(key, inventory, inventoryStore)
                },
                catch: (error) => new StorageError('SAVE_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      loadInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          return yield* pipe(
            Match.value(isIndexedDBAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.tryPromise({
                try: async () => {
                  const key = generateInventoryKey(playerId)
                  const inventory = await get<Inventory>(key, inventoryStore)
                  return Option.fromNullable(inventory)
                },
                catch: (error) => new StorageError('LOAD_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      saveInventoryState: (state: InventoryState) =>
        Effect.gen(function* () {
          yield* pipe(
            Match.value(isIndexedDBAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.tryPromise({
                try: async () => {
                  const key = generateStateKey(state.inventory.playerId)
                  await set(key, state, inventoryStore)
                },
                catch: (error) => new StorageError('SAVE_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      loadInventoryState: (playerId: PlayerId) =>
        Effect.gen(function* () {
          return yield* pipe(
            Match.value(isIndexedDBAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.tryPromise({
                try: async () => {
                  const key = generateStateKey(playerId)
                  const state = await get<InventoryState>(key, inventoryStore)
                  return Option.fromNullable(state)
                },
                catch: (error) => new StorageError('LOAD_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      deleteInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: async () => {
              const inventoryKey = generateInventoryKey(playerId)
              const stateKey = generateStateKey(playerId)

              await Promise.all([del(inventoryKey, inventoryStore), del(stateKey, inventoryStore)])
            },
            catch: (error) => new StorageError('SAVE_FAILED', error),
          })
        }),

      listStoredInventories: () =>
        Effect.gen(function* () {
          return yield* Effect.tryPromise({
            try: async () => {
              const allKeys = await keys(inventoryStore)
              const inventoryKeys = allKeys
                .filter((key: IDBValidKey): key is string => typeof key === 'string' && key.startsWith('inventory:'))
                .map((key: string) => key.replace('inventory:', '') as PlayerId)

              return inventoryKeys
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })
        }),

      createBackup: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventoryOption = yield* Effect.tryPromise({
            try: async () => {
              const key = generateInventoryKey(playerId)
              const inventory = await get<Inventory>(key, inventoryStore)
              return Option.fromNullable(inventory)
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })

          const inventory = yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.fail(new StorageError('LOAD_FAILED', { reason: 'Inventory not found' })),
              onSome: (inv) => Effect.succeed(inv),
            })
          )

          const backupId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const backupKey = generateBackupKey(playerId, backupId)

          yield* Effect.tryPromise({
            try: async () => {
              const backupData = {
                timestamp: Date.now(),
                inventory,
                version: '1.0.0',
              }
              await set(backupKey, backupData, inventoryStore)
            },
            catch: (error) => new StorageError('SAVE_FAILED', error),
          })

          return backupId
        }),

      restoreBackup: (playerId: PlayerId, backupId: string) =>
        Effect.gen(function* () {
          const backupKey = generateBackupKey(playerId, backupId)

          const backupData = yield* Effect.tryPromise({
            try: async () => {
              const data = await get(backupKey, inventoryStore)
              return Option.fromNullable(data as any)
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })

          return yield* pipe(
            backupData,
            Option.match({
              onNone: () => Effect.fail(new StorageError('LOAD_FAILED', { reason: 'Backup not found' })),
              onSome: (data: any) => Effect.succeed(data.inventory as Inventory),
            })
          )
        }),

      clearAllData: () =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: async () => {
              await clear(inventoryStore)
            },
            catch: (error) => new StorageError('SAVE_FAILED', error),
          })
        }),

      getStorageInfo: () =>
        Effect.gen(function* () {
          return yield* Effect.tryPromise({
            try: async () => {
              // Get all values to calculate size
              const allValues = await values(inventoryStore)
              const allKeys = await keys(inventoryStore)

              // Calculate total size (rough estimate)
              let totalSize = 0
              allValues.forEach((value) => {
                try {
                  totalSize += new Blob([JSON.stringify(value)]).size
                } catch {
                  // Fallback for non-serializable values
                  totalSize += 1000 // rough estimate
                }
              })

              return {
                totalSize,
                availableSpace: 100 * 1024 * 1024, // IndexedDB typically has much more space
                itemCount: allKeys.length,
              }
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })
        }),
    })
  })
)

// Simple export that just uses IndexedDB service for now
export const HybridInventoryStorageService = IndexedDBInventoryService
