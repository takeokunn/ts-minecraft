/**
 * InventoryIntegrationLayer - Effect-TSとZustandの統合レイヤー
 *
 * Effect-TSサービス層とZustand状態管理の橋渡しを行う
 * 双方向同期とリアクティブな状態管理を提供
 */

import { Context, Effect, Layer, Match, Option, pipe, Ref, Schedule, Duration } from 'effect'
import { Inventory, InventoryState, ItemStack, PlayerId } from './InventoryTypes'
import { InventoryService } from './InventoryService'
import { InventoryServiceLive } from './InventoryServiceLive'
import { InventoryStorageService, LocalStorageInventoryService } from './InventoryStorageService'
import { ItemManagerService, ItemManagerServiceLive, EnhancedItemStack } from './ItemManagerService'
import { ItemRegistry } from './ItemRegistry'
import { useInventoryStore, InventoryZustandEffects } from './InventoryZustandStore'
import type { InventoryZustandState } from './InventoryZustandStore'

// Integration service interface
export interface InventoryIntegrationService {
  // Player inventory management
  readonly loadPlayerInventory: (
    playerId: PlayerId
  ) => Effect.Effect<void, unknown, InventoryService | InventoryStorageService | ItemManagerService>
  readonly savePlayerInventory: (
    playerId: PlayerId
  ) => Effect.Effect<void, unknown, InventoryService | InventoryStorageService | ItemManagerService>
  readonly switchPlayer: (
    playerId: PlayerId
  ) => Effect.Effect<void, unknown, InventoryService | InventoryStorageService | ItemManagerService>

  // Inventory operations with auto-sync
  readonly addItemWithSync: (
    playerId: PlayerId,
    itemStack: ItemStack
  ) => Effect.Effect<void, unknown, InventoryService | InventoryStorageService | ItemManagerService>
  readonly removeItemWithSync: (
    playerId: PlayerId,
    slotIndex: number,
    amount?: number
  ) => Effect.Effect<void, unknown, InventoryService | InventoryStorageService | ItemManagerService>
  readonly moveItemWithSync: (
    playerId: PlayerId,
    fromSlot: number,
    toSlot: number
  ) => Effect.Effect<void, unknown, InventoryService | InventoryStorageService | ItemManagerService>

  // State synchronization
  readonly syncToZustand: (
    playerId: PlayerId
  ) => Effect.Effect<void, unknown, InventoryService | InventoryStorageService | ItemManagerService>
  readonly syncFromZustand: () => Effect.Effect<
    void,
    unknown,
    InventoryService | InventoryStorageService | ItemManagerService
  >
  readonly startAutoSync: () => Effect.Effect<
    void,
    unknown,
    InventoryService | InventoryStorageService | ItemManagerService
  >
  readonly stopAutoSync: () => Effect.Effect<
    void,
    unknown,
    InventoryService | InventoryStorageService | ItemManagerService
  >

  // Event handling
  readonly onInventoryChanged: (
    callback: (playerId: PlayerId, inventory: Inventory) => void
  ) => Effect.Effect<() => void, never>
  readonly onItemAdded: (
    callback: (playerId: PlayerId, item: ItemStack, slotIndex: number) => void
  ) => Effect.Effect<() => void, never>
  readonly onItemRemoved: (
    callback: (playerId: PlayerId, item: ItemStack, slotIndex: number) => void
  ) => Effect.Effect<() => void, never>

  // Batch operations
  readonly batchOperations: <T>(operations: Effect.Effect<T, never>[]) => Effect.Effect<T[], never>
  readonly optimizedInventorySync: (playerId: PlayerId) => Effect.Effect<void, unknown, never>
}

// Context tag
export const InventoryIntegrationService = Context.GenericTag<InventoryIntegrationService>(
  '@minecraft/InventoryIntegrationService'
)

// Integration Layer Implementation
export const InventoryIntegrationServiceLive = Layer.effect(
  InventoryIntegrationService,
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const storageService = yield* InventoryStorageService
    const itemManager = yield* ItemManagerService

    // Auto-sync state
    const autoSyncIntervalRef = yield* Ref.make<Option.Option<NodeJS.Timeout>>(Option.none())
    const lastSyncTimestampsRef = yield* Ref.make<Map<PlayerId, number>>(new Map())

    // Event callbacks storage
    const eventCallbacksRef = yield* Ref.make<{
      inventoryChanged: ((playerId: PlayerId, inventory: Inventory) => void)[]
      itemAdded: ((playerId: PlayerId, item: ItemStack, slotIndex: number) => void)[]
      itemRemoved: ((playerId: PlayerId, item: ItemStack, slotIndex: number) => void)[]
    }>({
      inventoryChanged: [],
      itemAdded: [],
      itemRemoved: [],
    })

    // Helper to trigger events
    const triggerInventoryChanged = (playerId: PlayerId, inventory: Inventory) =>
      Effect.gen(function* () {
        const callbacks = yield* Ref.get(eventCallbacksRef)
        yield* Effect.forEach(
          callbacks.inventoryChanged,
          (callback) => Effect.sync(() => callback(playerId, inventory)),
          { concurrency: 'inherit' }
        )
      })

    const triggerItemAdded = (playerId: PlayerId, item: ItemStack, slotIndex: number) =>
      Effect.gen(function* () {
        const callbacks = yield* Ref.get(eventCallbacksRef)
        yield* Effect.forEach(
          callbacks.itemAdded,
          (callback) => Effect.sync(() => callback(playerId, item, slotIndex)),
          { concurrency: 'inherit' }
        )
      })

    const triggerItemRemoved = (playerId: PlayerId, item: ItemStack, slotIndex: number) =>
      Effect.gen(function* () {
        const callbacks = yield* Ref.get(eventCallbacksRef)
        yield* Effect.forEach(
          callbacks.itemRemoved,
          (callback) => Effect.sync(() => callback(playerId, item, slotIndex)),
          { concurrency: 'inherit' }
        )
      })

    return InventoryIntegrationService.of({
      loadPlayerInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* inventoryService.getInventory(playerId)
          yield* InventoryZustandEffects.setInventory(playerId, inventory)

          // Update last sync timestamp
          yield* Ref.update(lastSyncTimestampsRef, (timestamps) => {
            const newMap = new Map(timestamps)
            newMap.set(playerId, Date.now())
            return newMap
          })

          yield* triggerInventoryChanged(playerId, inventory)
        }),

      savePlayerInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const zustandState = useInventoryStore.getState()

          yield* pipe(
            Option.fromNullable(zustandState.currentInventory),
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (inventory) =>
                Effect.gen(function* () {
                  yield* pipe(
                    storageService.saveInventory(playerId, inventory),
                    Effect.catchAll(() => Effect.succeed(void 0)) // Ignore save errors for now
                  )

                  // Update last sync timestamp
                  yield* Ref.update(lastSyncTimestampsRef, (timestamps) => {
                    const newMap = new Map(timestamps)
                    newMap.set(playerId, Date.now())
                    return newMap
                  })
                }),
            })
          )
        }),

      switchPlayer: (playerId: PlayerId) =>
        Effect.gen(function* () {
          // Save current player's inventory if exists
          const currentState = useInventoryStore.getState()
          if (currentState.currentPlayerId && currentState.currentInventory) {
            yield* storageService.saveInventory(currentState.currentPlayerId as PlayerId, currentState.currentInventory)
          }

          // Load new player's inventory
          const loadedInventory = yield* storageService.loadInventory(playerId)
          yield* pipe(
            loadedInventory,
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (inventory) =>
                Effect.sync(() => {
                  useInventoryStore.getState().setCurrentInventory(playerId, inventory)
                }),
            })
          )
        }),

      addItemWithSync: (playerId: PlayerId, itemStack: ItemStack) =>
        Effect.gen(function* () {
          // Add item through Effect-TS service
          const addResult = yield* inventoryService.addItem(playerId, itemStack)

          // Sync to Zustand
          const inventory = yield* inventoryService.getInventory(playerId)
          yield* Effect.sync(() => {
            useInventoryStore.getState().setCurrentInventory(playerId, inventory)
          })

          // Find the slot where item was added (simplified)
          const zustandState = useInventoryStore.getState()
          const slotIndex = zustandState.findItemSlots(itemStack.itemId)[0] ?? -1

          // Handle successful/partial item addition
          if (addResult._tag === 'success' || addResult._tag === 'partial') {
            yield* triggerItemAdded(playerId, itemStack, slotIndex)
          }
        }),

      removeItemWithSync: (playerId: PlayerId, slotIndex: number, amount?: number) =>
        Effect.gen(function* () {
          // Get item before removal for event
          const currentItem = yield* inventoryService.getSlotItem(playerId, slotIndex)

          // Remove item through Effect-TS service
          const removedItem = yield* inventoryService.removeItem(playerId, slotIndex, amount ?? 1)

          // Sync to Zustand
          const inventory = yield* inventoryService.getInventory(playerId)
          yield* Effect.sync(() => {
            useInventoryStore.getState().setCurrentInventory(playerId, inventory)
          })

          // Trigger event if item was actually removed
          yield* pipe(
            Option.fromNullable(removedItem),
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (item) => triggerItemRemoved(playerId, item, slotIndex),
            })
          )
        }),

      moveItemWithSync: (playerId: PlayerId, fromSlot: number, toSlot: number) =>
        Effect.gen(function* () {
          // Move item through Effect-TS service
          yield* inventoryService.moveItem(playerId, fromSlot, toSlot)

          // Sync to Zustand
          const inventory = yield* inventoryService.getInventory(playerId)
          yield* Effect.sync(() => {
            useInventoryStore.getState().setCurrentInventory(playerId, inventory)
          })

          // Get updated inventory for event
          const updatedInventory = yield* inventoryService.getInventory(playerId)
          yield* triggerInventoryChanged(playerId, updatedInventory)
        }),

      syncToZustand: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* inventoryService.getInventory(playerId)
          yield* InventoryZustandEffects.setInventory(playerId, inventory)
        }),

      syncFromZustand: () =>
        Effect.gen(function* () {
          const zustandState = useInventoryStore.getState()

          if (zustandState.currentPlayerId && zustandState.currentInventory) {
            yield* pipe(
              storageService.saveInventory(zustandState.currentPlayerId, zustandState.currentInventory),
              Effect.catchAll(() => Effect.succeed(void 0))
            )
          }
        }),

      startAutoSync: () =>
        Effect.gen(function* () {
          // Stop existing auto-sync if running
          const currentInterval = yield* Ref.get(autoSyncIntervalRef)
          yield* pipe(
            currentInterval,
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (intervalId) =>
                Effect.gen(function* () {
                  clearInterval(intervalId)
                  yield* Ref.set(autoSyncIntervalRef, Option.none())
                }),
            })
          )

          // Start new auto-sync interval
          const intervalId = setInterval(() => {
            Effect.runPromise(
              pipe(
                Effect.gen(function* () {
                  const zustandState = useInventoryStore.getState()
                  if (zustandState.currentPlayerId && zustandState.currentInventory) {
                    yield* storageService.saveInventory(zustandState.currentPlayerId, zustandState.currentInventory)
                  }
                }),
                Effect.catchAll(() => Effect.succeed(void 0))
              )
            )
          }, 5000) // Sync every 5 seconds

          yield* Ref.set(autoSyncIntervalRef, Option.some(intervalId))
        }),

      stopAutoSync: () =>
        Effect.gen(function* () {
          const currentInterval = yield* Ref.get(autoSyncIntervalRef)

          yield* pipe(
            currentInterval,
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (intervalId) =>
                Effect.gen(function* () {
                  clearInterval(intervalId)
                  yield* Ref.set(autoSyncIntervalRef, Option.none())
                }),
            })
          )
        }),

      onInventoryChanged: (callback: (playerId: PlayerId, inventory: Inventory) => void) =>
        Effect.gen(function* () {
          yield* Ref.update(eventCallbacksRef, (callbacks) => ({
            ...callbacks,
            inventoryChanged: [...callbacks.inventoryChanged, callback],
          }))

          // Return unsubscribe function
          return () => {
            Effect.runSync(
              Ref.update(eventCallbacksRef, (callbacks) => ({
                ...callbacks,
                inventoryChanged: callbacks.inventoryChanged.filter((cb) => cb !== callback),
              }))
            )
          }
        }),

      onItemAdded: (callback: (playerId: PlayerId, item: ItemStack, slotIndex: number) => void) =>
        Effect.gen(function* () {
          yield* Ref.update(eventCallbacksRef, (callbacks) => ({
            ...callbacks,
            itemAdded: [...callbacks.itemAdded, callback],
          }))

          return () => {
            Effect.runSync(
              Ref.update(eventCallbacksRef, (callbacks) => ({
                ...callbacks,
                itemAdded: callbacks.itemAdded.filter((cb) => cb !== callback),
              }))
            )
          }
        }),

      onItemRemoved: (callback: (playerId: PlayerId, item: ItemStack, slotIndex: number) => void) =>
        Effect.gen(function* () {
          yield* Ref.update(eventCallbacksRef, (callbacks) => ({
            ...callbacks,
            itemRemoved: [...callbacks.itemRemoved, callback],
          }))

          return () => {
            Effect.runSync(
              Ref.update(eventCallbacksRef, (callbacks) => ({
                ...callbacks,
                itemRemoved: callbacks.itemRemoved.filter((cb) => cb !== callback),
              }))
            )
          }
        }),

      batchOperations: <T>(operations: Effect.Effect<T, never>[]) => Effect.all(operations, { concurrency: 1 }),

      optimizedInventorySync: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const timestamps = yield* Ref.get(lastSyncTimestampsRef)
          const lastSync = timestamps.get(playerId) ?? 0
          const now = Date.now()

          // Only sync if enough time has passed (throttling)
          if (now - lastSync > 1000) {
            // 1 second throttle
            yield* Effect.gen(function* () {
              const inventory = yield* inventoryService.getInventory(playerId)
              yield* Effect.sync(() => {
                useInventoryStore.getState().setCurrentInventory(playerId, inventory)
              })
            })
          }
        }),
    })
  })
)

// React integration helpers
export const useInventoryIntegration = () => {
  return {
    // Zustand store access
    useStore: useInventoryStore,

    // Effect-TS integration
    loadPlayer: (playerId: PlayerId) =>
      Effect.runPromise(
        pipe(
          InventoryIntegrationService,
          Effect.flatMap((service) => service.loadPlayerInventory(playerId))
        ).pipe(
          Effect.provide(InventoryIntegrationServiceLive),
          Effect.provide(InventoryServiceLive),
          Effect.provide(LocalStorageInventoryService),
          Effect.provide(ItemManagerServiceLive),
          Effect.provide(ItemRegistry.Default)
        )
      ),

    savePlayer: (playerId: PlayerId) =>
      Effect.runPromise(
        pipe(
          InventoryIntegrationService,
          Effect.flatMap((service) => service.savePlayerInventory(playerId))
        ).pipe(
          Effect.provide(InventoryIntegrationServiceLive),
          Effect.provide(InventoryServiceLive),
          Effect.provide(LocalStorageInventoryService),
          Effect.provide(ItemManagerServiceLive),
          Effect.provide(ItemRegistry.Default)
        )
      ),

    addItem: (playerId: PlayerId, itemStack: ItemStack) =>
      Effect.runPromise(
        pipe(
          InventoryIntegrationService,
          Effect.flatMap((service) => service.addItemWithSync(playerId, itemStack))
        ).pipe(
          Effect.provide(InventoryIntegrationServiceLive),
          Effect.provide(InventoryServiceLive),
          Effect.provide(LocalStorageInventoryService),
          Effect.provide(ItemManagerServiceLive),
          Effect.provide(ItemRegistry.Default)
        )
      ),

    removeItem: (playerId: PlayerId, slotIndex: number, amount?: number) =>
      Effect.runPromise(
        pipe(
          InventoryIntegrationService,
          Effect.flatMap((service) => service.removeItemWithSync(playerId, slotIndex, amount))
        ).pipe(
          Effect.provide(InventoryIntegrationServiceLive),
          Effect.provide(InventoryServiceLive),
          Effect.provide(LocalStorageInventoryService),
          Effect.provide(ItemManagerServiceLive),
          Effect.provide(ItemRegistry.Default)
        )
      ),

    moveItem: (playerId: PlayerId, fromSlot: number, toSlot: number) =>
      Effect.runPromise(
        pipe(
          InventoryIntegrationService,
          Effect.flatMap((service) => service.moveItemWithSync(playerId, fromSlot, toSlot))
        ).pipe(
          Effect.provide(InventoryIntegrationServiceLive),
          Effect.provide(InventoryServiceLive),
          Effect.provide(LocalStorageInventoryService),
          Effect.provide(ItemManagerServiceLive),
          Effect.provide(ItemRegistry.Default)
        )
      ),
  }
}

// Event system for external subscribers
export const InventoryEventSystem = {
  // Subscribe to all inventory events
  subscribeToAll: (callbacks: {
    onInventoryChanged?: (playerId: PlayerId, inventory: Inventory) => void
    onItemAdded?: (playerId: PlayerId, item: ItemStack, slotIndex: number) => void
    onItemRemoved?: (playerId: PlayerId, item: ItemStack, slotIndex: number) => void
  }) =>
    Effect.gen(function* () {
      const service = yield* InventoryIntegrationService
      const unsubscribers: (() => void)[] = []

      if (callbacks.onInventoryChanged) {
        const unsub = yield* service.onInventoryChanged(callbacks.onInventoryChanged)
        unsubscribers.push(unsub)
      }

      if (callbacks.onItemAdded) {
        const unsub = yield* service.onItemAdded(callbacks.onItemAdded)
        unsubscribers.push(unsub)
      }

      if (callbacks.onItemRemoved) {
        const unsub = yield* service.onItemRemoved(callbacks.onItemRemoved)
        unsubscribers.push(unsub)
      }

      // Return function to unsubscribe from all events
      return () => {
        unsubscribers.forEach((unsub) => unsub())
      }
    }),

  // Create reactive inventory watcher
  createInventoryWatcher: (playerId: PlayerId) =>
    Effect.gen(function* () {
      const service = yield* InventoryIntegrationService

      // Subscribe to changes for specific player
      const unsubscribe = yield* service.onInventoryChanged((changedPlayerId, inventory) => {
        if (changedPlayerId === playerId) {
          console.log(`Inventory changed for player ${playerId}:`, inventory)
        }
      })

      return { unsubscribe }
    }),
}
