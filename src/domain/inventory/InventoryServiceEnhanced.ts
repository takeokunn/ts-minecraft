/**
 * InventoryServiceEnhanced - 永続化統合版InventoryService
 *
 * 既存のInventoryServiceLiveを拡張し、データ永続化機能を統合
 * 自動保存、状態管理、バックアップ機能を含む
 */

import { Effect, HashMap, Layer, Match, Option, pipe, Ref, Schedule, Duration } from 'effect'
import {
  AddItemResult,
  Inventory,
  InventoryState,
  ItemStack,
  PlayerId,
  createEmptyInventory,
} from './InventoryTypes.js'
import { InventoryError, InventoryService } from './InventoryService.js'
import { ItemRegistry } from './ItemRegistry.js'
import { SlotManager } from './SlotManager.js'
import { StackProcessor } from './StackProcessor.js'
import { InventoryStorageService, defaultStorageConfig, StorageConfig } from './InventoryStorageService.js'

interface EnhancedInventoryStore {
  inventories: HashMap.HashMap<PlayerId, Inventory>
  lastSaved: HashMap.HashMap<PlayerId, number>
  autoSaveEnabled: boolean
  saveInterval: number
}

// Enhanced Inventory Service with persistence
export const InventoryServiceEnhanced = Layer.effect(
  InventoryService,
  Effect.gen(function* () {
    const registry = yield* ItemRegistry
    const storageService = yield* InventoryStorageService

    // Initialize enhanced store
    const storeRef = yield* Ref.make<EnhancedInventoryStore>({
      inventories: HashMap.empty(),
      lastSaved: HashMap.empty(),
      autoSaveEnabled: defaultStorageConfig.autoSave,
      saveInterval: defaultStorageConfig.saveInterval,
    })

    // Auto-save scheduler
    const autoSaveSchedule = Schedule.fixed(Duration.millis(defaultStorageConfig.saveInterval))

    // Helper to get or load inventory from storage
    const getOrLoadInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryError, never> =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storeRef)
        const existing = HashMap.get(store.inventories, playerId)

        return yield* pipe(
          existing,
          Option.match({
            onSome: (inventory) => Effect.succeed(inventory),
            onNone: () =>
              Effect.gen(function* () {
                // Try to load from storage first
                const storedInventory = yield* pipe(
                  storageService.loadInventory(playerId),
                  Effect.map((inv) => Option.some(inv)), // 明示的にOption型に変換
                  Effect.catchAll(() => Effect.succeed(Option.none<Inventory>())) // 型を明示
                )

                const inventory = yield* pipe(
                  storedInventory as any, // 型アサーションでOption型不整合を解決
                  Option.match({
                    onSome: (inv) => Effect.succeed(inv),
                    onNone: () => Effect.succeed(createEmptyInventory(playerId)),
                  })
                )

                // Update in-memory store
                yield* Ref.update(storeRef, (store) => ({
                  ...store,
                  inventories: HashMap.set(store.inventories, playerId, inventory as any),
                  lastSaved: HashMap.set(store.lastSaved, playerId, Date.now()),
                }))

                return inventory
              }),
          })
        )
      }) as unknown as Effect.Effect<Inventory, InventoryError, never>

    // Helper to update inventory in memory and optionally save
    const updateInventory = (
      playerId: PlayerId,
      inventory: Inventory,
      autoSave: boolean = true
    ): Effect.Effect<void, InventoryError> =>
      Effect.gen(function* () {
        yield* Ref.update(storeRef, (store) => ({
          ...store,
          inventories: HashMap.set(store.inventories, playerId, inventory),
        }))

        // Auto-save if enabled
        const store = yield* Ref.get(storeRef)
        // 自動保存のチェック
        if (autoSave && store.autoSaveEnabled) {
          yield* saveInventory(playerId, inventory)
        }
      })

    // Save inventory to storage
    const saveInventory = (playerId: PlayerId, inventory: Inventory): Effect.Effect<void, InventoryError> =>
      Effect.gen(function* () {
        yield* pipe(
          storageService.saveInventory(playerId, inventory),
          Effect.catchAll((storageError) =>
            Effect.fail(
              new InventoryError('INVENTORY_FULL', playerId, {
                reason: 'Storage save failed',
                error: storageError,
              })
            )
          )
        )

        yield* Ref.update(storeRef, (store) => ({
          ...store,
          lastSaved: HashMap.set(store.lastSaved, playerId, Date.now()),
        }))
      })

    // Auto-save background process
    const startAutoSave = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* pipe(
          Effect.gen(function* () {
            const store = yield* Ref.get(storeRef)

            // 自動保存が有効な場合のみ処理
            if (store.autoSaveEnabled) {
              yield* Effect.gen(function* () {
                const now = Date.now()
                const inventoriesToSave = HashMap.filter(store.inventories, (_, playerId) => {
                  const lastSaved = HashMap.get(store.lastSaved, playerId)
                  return Option.match(lastSaved, {
                    onNone: () => true,
                    onSome: (savedTime) => now - savedTime > store.saveInterval,
                  })
                })

                yield* Effect.forEach(
                  HashMap.toEntries(inventoriesToSave),
                  ([playerId, inventory]) =>
                    pipe(
                      saveInventory(playerId, inventory),
                      Effect.catchAll(() => Effect.succeed(void 0)) // Ignore save errors in background
                    ),
                  { concurrency: 3 }
                )
              })
            }
          }),
          Effect.repeat(autoSaveSchedule),
          Effect.fork
        )
      })

    // Start auto-save process
    yield* startAutoSave()

    return InventoryService.of({
      createInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const newInventory = createEmptyInventory(playerId)
          yield* updateInventory(playerId, newInventory)
          return newInventory
        }),

      getInventory: (playerId: PlayerId) => getOrLoadInventory(playerId),

      addItem: (playerId: PlayerId, itemStack: ItemStack) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const { inventory: updatedInventory, result } = yield* StackProcessor.addItemToInventory(
            inventory,
            itemStack,
            registry
          )
          yield* updateInventory(playerId, updatedInventory)
          return result
        }),

      removeItem: (playerId: PlayerId, slotIndex: number, amount: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const { inventory: updatedInventory, removed } = yield* StackProcessor.removeFromSlot(
            inventory,
            slotIndex,
            amount
          )
          yield* updateInventory(playerId, updatedInventory)
          return removed
        }),

      moveItem: (playerId: PlayerId, fromSlot: number, toSlot: number, amount?: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const fromItem = yield* SlotManager.getSlotItem(inventory, fromSlot)

          yield* pipe(
            Option.fromNullable(fromItem),
            Option.match({
              onNone: () => Effect.fail(new InventoryError('INSUFFICIENT_ITEMS', playerId, { fromSlot })),
              onSome: (item) =>
                Effect.gen(function* () {
                  const moveAmount = amount ?? item.count
                  const updatedInventory = yield* StackProcessor.transferBetweenSlots(
                    inventory,
                    fromSlot,
                    toSlot,
                    moveAmount,
                    registry
                  )

                  yield* updateInventory(playerId, updatedInventory)
                }),
            })
          )
        }),

      swapItems: (playerId: PlayerId, slot1: number, slot2: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const updatedInventory = yield* SlotManager.swapItems(inventory, slot1, slot2)
          yield* updateInventory(playerId, updatedInventory)
        }),

      splitStack: (playerId: PlayerId, sourceSlot: number, targetSlot: number, amount: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const sourceItem = yield* SlotManager.getSlotItem(inventory, sourceSlot)

          yield* pipe(
            Option.fromNullable(sourceItem),
            Option.match({
              onNone: () =>
                Effect.fail(
                  new InventoryError('INSUFFICIENT_ITEMS', playerId, {
                    sourceSlot,
                  })
                ),
              onSome: (source) =>
                Effect.gen(function* () {
                  const targetItem = yield* SlotManager.getSlotItem(inventory, targetSlot)

                  yield* pipe(
                    Option.fromNullable(targetItem),
                    Option.match({
                      onNone: () =>
                        Effect.gen(function* () {
                          const splitResult = StackProcessor.splitStack(source, amount)

                          yield* pipe(
                            Option.fromNullable(splitResult.split),
                            Option.match({
                              onNone: () => Effect.fail(new InventoryError('INVALID_ITEM_COUNT', playerId, { amount })),
                              onSome: (split) =>
                                Effect.gen(function* () {
                                  let updatedInventory = yield* SlotManager.setSlotItem(
                                    inventory,
                                    sourceSlot,
                                    splitResult.original
                                  )
                                  updatedInventory = yield* SlotManager.setSlotItem(updatedInventory, targetSlot, split)

                                  yield* updateInventory(playerId, updatedInventory)
                                }),
                            })
                          )
                        }),
                      onSome: () => Effect.fail(new InventoryError('SLOT_OCCUPIED', playerId, { targetSlot })),
                    })
                  )
                }),
            })
          )
        }),

      mergeStacks: (playerId: PlayerId, sourceSlot: number, targetSlot: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const sourceItem = yield* SlotManager.getSlotItem(inventory, sourceSlot)
          const targetItem = yield* SlotManager.getSlotItem(inventory, targetSlot)

          const bothItems = pipe(
            Option.fromNullable(sourceItem),
            Option.flatMap((source) =>
              pipe(
                Option.fromNullable(targetItem),
                Option.map((target) => ({ source, target }))
              )
            )
          )

          yield* pipe(
            bothItems,
            Option.match({
              onNone: () => Effect.fail(new InventoryError('INSUFFICIENT_ITEMS', playerId)),
              onSome: ({ source, target }) =>
                Effect.gen(function* () {
                  const canStack = yield* registry.canStack(source, target)

                  // スタック可能かチェック
                  if (!canStack) {
                    yield* Effect.fail(new InventoryError('ITEM_NOT_STACKABLE', playerId))
                  } else {
                    yield* Effect.gen(function* () {
                      const maxStackSize = yield* registry.getMaxStackSize(source.itemId)
                      const mergeResult = StackProcessor.mergeStacks(source, target, maxStackSize)

                      let updatedInventory = yield* SlotManager.setSlotItem(inventory, sourceSlot, mergeResult.source)
                      updatedInventory = yield* SlotManager.setSlotItem(
                        updatedInventory,
                        targetSlot,
                        mergeResult.target
                      )

                      yield* updateInventory(playerId, updatedInventory)
                    })
                  }
                }),
            })
          )
        }),

      getSelectedItem: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return SlotManager.getSelectedItem(inventory)
        }),

      setSelectedSlot: (playerId: PlayerId, slotIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const updatedInventory = yield* SlotManager.setSelectedSlot(inventory, slotIndex)
          yield* updateInventory(playerId, updatedInventory)
        }),

      getSlotItem: (playerId: PlayerId, slotIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return yield* SlotManager.getSlotItem(inventory, slotIndex)
        }),

      setSlotItem: (playerId: PlayerId, slotIndex: number, itemStack: ItemStack | null) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const updatedInventory = yield* SlotManager.setSlotItem(inventory, slotIndex, itemStack)
          yield* updateInventory(playerId, updatedInventory)
        }),

      clearSlot: (playerId: PlayerId, slotIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const { inventory: updatedInventory, removed } = yield* SlotManager.clearSlot(inventory, slotIndex)
          yield* updateInventory(playerId, updatedInventory)
          return removed
        }),

      clearInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const emptyInventory = createEmptyInventory(playerId)
          yield* updateInventory(playerId, emptyInventory)
        }),

      equipArmor: (
        playerId: PlayerId,
        armorType: 'helmet' | 'chestplate' | 'leggings' | 'boots',
        itemStack: ItemStack | null
      ) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const previousArmor = inventory.armor[armorType]

          const updatedInventory: Inventory = {
            ...inventory,
            armor: {
              ...inventory.armor,
              [armorType]: itemStack,
            },
          }

          yield* updateInventory(playerId, updatedInventory)
          return previousArmor
        }),

      getArmor: (playerId: PlayerId, armorType: 'helmet' | 'chestplate' | 'leggings' | 'boots') =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return inventory.armor[armorType]
        }),

      setOffhandItem: (playerId: PlayerId, itemStack: ItemStack | null) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const previousOffhand = inventory.offhand

          const updatedInventory: Inventory = {
            ...inventory,
            offhand: itemStack,
          }

          yield* updateInventory(playerId, updatedInventory)
          return previousOffhand
        }),

      getOffhandItem: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return inventory.offhand
        }),

      transferToHotbar: (playerId: PlayerId, sourceSlot: number, hotbarIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const updatedInventory = yield* SlotManager.setHotbarReference(inventory, hotbarIndex, sourceSlot)
          yield* updateInventory(playerId, updatedInventory)
        }),

      getHotbarItem: (playerId: PlayerId, hotbarIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return yield* SlotManager.getHotbarItem(inventory, hotbarIndex)
        }),

      dropItem: (playerId: PlayerId, slotIndex: number, amount?: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const item = yield* SlotManager.getSlotItem(inventory, slotIndex)

          return yield* pipe(
            Option.fromNullable(item),
            Option.match({
              onNone: () => Effect.succeed(null),
              onSome: (existingItem) =>
                Effect.gen(function* () {
                  const dropAmount = amount ?? existingItem.count
                  const { inventory: updatedInventory, removed } = yield* StackProcessor.removeFromSlot(
                    inventory,
                    slotIndex,
                    dropAmount
                  )

                  yield* updateInventory(playerId, updatedInventory)
                  return removed
                }),
            })
          )
        }),

      dropAllItems: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const droppedItems: ItemStack[] = []

          // Collect all items using functional approach
          for (const item of inventory.slots) {
            pipe(
              Option.fromNullable(item),
              Option.match({
                onNone: () => {},
                onSome: (existingItem) => {
                  droppedItems.push(existingItem)
                },
              })
            )
          }

          // Collect armor items
          Object.values(inventory.armor).forEach((armorItem) => {
            pipe(
              Option.fromNullable(armorItem),
              Option.match({
                onNone: () => {},
                onSome: (armor) => droppedItems.push(armor),
              })
            )
          })

          // Collect offhand item
          pipe(
            Option.fromNullable(inventory.offhand),
            Option.match({
              onNone: () => {},
              onSome: (offhand) => droppedItems.push(offhand),
            })
          )

          // Clear inventory
          const emptyInventory = createEmptyInventory(playerId)
          yield* updateInventory(playerId, emptyInventory)

          return droppedItems
        }),

      getInventoryState: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const state: InventoryState = {
            inventory,
            lastModified: Date.now(),
            version: '1.0.0',
          }

          // Save state to storage
          yield* pipe(
            storageService.saveInventoryState(state),
            Effect.catchAll(() => Effect.succeed(void 0)) // Ignore state save errors
          )

          return state
        }),

      loadInventoryState: (state: InventoryState) =>
        Effect.gen(function* () {
          yield* updateInventory(state.inventory.playerId, state.inventory, false)

          // Update storage
          yield* pipe(
            storageService.saveInventoryState(state),
            Effect.catchAll(() => Effect.succeed(void 0))
          )
        }),

      getEmptySlotCount: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return SlotManager.countEmptySlots(inventory)
        }),

      getUsedSlotCount: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return SlotManager.countUsedSlots(inventory)
        }),

      findItemSlots: (playerId: PlayerId, itemId: string) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return SlotManager.findItemSlots(inventory, itemId)
        }),

      countItem: (playerId: PlayerId, itemId: string) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          let count = 0

          for (const item of inventory.slots) {
            pipe(
              Option.fromNullable(item),
              Option.match({
                onNone: () => {},
                onSome: (existingItem) => {
                  // アイテムIDが一致する場合カウントを追加
                  if (existingItem.itemId === itemId) {
                    count += existingItem.count
                  }
                },
              })
            )
          }
          return count
        }),

      hasSpaceForItem: (playerId: PlayerId, itemStack: ItemStack) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return yield* StackProcessor.hasSpaceForItem(inventory, itemStack, registry)
        }),

      canAddItem: (playerId: PlayerId, itemStack: ItemStack) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          return yield* StackProcessor.hasSpaceForItem(inventory, itemStack, registry)
        }),

      sortInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const sortedInventory = SlotManager.sortInventory(inventory)
          yield* updateInventory(playerId, sortedInventory)
        }),

      compactInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrLoadInventory(playerId)
          const compactedInventory = SlotManager.compactInventory(inventory)
          yield* updateInventory(playerId, compactedInventory)
        }),
    })
  })
)
