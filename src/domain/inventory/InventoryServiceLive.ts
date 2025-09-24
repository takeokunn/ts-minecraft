/**
 * InventoryServiceLive - Implementation of the InventoryService interface
 *
 * Provides complete inventory management functionality using
 * SlotManager and StackProcessor for operations
 */

import { Effect, HashMap, Layer, Match, Option, pipe } from 'effect'
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

interface InventoryStore {
  inventories: HashMap.HashMap<PlayerId, Inventory>
}

export const InventoryServiceLive = Layer.effect(
  InventoryService,
  Effect.gen(function* () {
    const registry = yield* ItemRegistry

    // Initialize store
    let store: InventoryStore = {
      inventories: HashMap.empty(),
    }

    // Helper to get or create inventory
    const getOrCreateInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryError> =>
      Effect.gen(function* () {
        const existing = HashMap.get(store.inventories, playerId)

        // Transform if statement to Option.match pattern
        return yield* pipe(
          existing,
          Option.match({
            onSome: (inventory) => Effect.succeed(inventory),
            onNone: () =>
              Effect.gen(function* () {
                const newInventory = createEmptyInventory(playerId)
                store = {
                  ...store,
                  inventories: HashMap.set(store.inventories, playerId, newInventory),
                }
                return newInventory
              }),
          })
        )
      })

    // Helper to update inventory
    const updateInventory = (playerId: PlayerId, inventory: Inventory): Effect.Effect<void> =>
      Effect.sync(() => {
        store = {
          ...store,
          inventories: HashMap.set(store.inventories, playerId, inventory),
        }
      })

    return {
      createInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const newInventory = createEmptyInventory(playerId)
          yield* updateInventory(playerId, newInventory)
          return newInventory
        }),

      getInventory: (playerId: PlayerId) => getOrCreateInventory(playerId),

      addItem: (playerId: PlayerId, itemStack: ItemStack) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
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
          const inventory = yield* getOrCreateInventory(playerId)
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
          const inventory = yield* getOrCreateInventory(playerId)
          const fromItem = yield* SlotManager.getSlotItem(inventory, fromSlot)

          // Transform if statement to Option.match pattern
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
          const inventory = yield* getOrCreateInventory(playerId)
          const updatedInventory = yield* SlotManager.swapItems(inventory, slot1, slot2)
          yield* updateInventory(playerId, updatedInventory)
        }),

      splitStack: (playerId: PlayerId, sourceSlot: number, targetSlot: number, amount: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const sourceItem = yield* SlotManager.getSlotItem(inventory, sourceSlot)

          // Transform first if statement to Option.match pattern
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

                  // Transform second if statement to Option.match pattern
                  yield* pipe(
                    Option.fromNullable(targetItem),
                    Option.match({
                      onNone: () =>
                        Effect.gen(function* () {
                          const splitResult = StackProcessor.splitStack(source, amount)

                          // Transform third if statement to Option.match pattern
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
          const inventory = yield* getOrCreateInventory(playerId)
          const sourceItem = yield* SlotManager.getSlotItem(inventory, sourceSlot)
          const targetItem = yield* SlotManager.getSlotItem(inventory, targetSlot)

          // Transform first if statement to Option validation pattern
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

                  // Transform second if statement to Match pattern
                  yield* pipe(
                    canStack,
                    Match.value,
                    Match.when(false, () => Effect.fail(new InventoryError('ITEM_NOT_STACKABLE', playerId))),
                    Match.when(true, () =>
                      Effect.gen(function* () {
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
                    ),
                    Match.exhaustive
                  )
                }),
            })
          )
        }),

      getSelectedItem: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return SlotManager.getSelectedItem(inventory)
        }),

      setSelectedSlot: (playerId: PlayerId, slotIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const updatedInventory = yield* SlotManager.setSelectedSlot(inventory, slotIndex)
          yield* updateInventory(playerId, updatedInventory)
        }),

      getSlotItem: (playerId: PlayerId, slotIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return yield* SlotManager.getSlotItem(inventory, slotIndex)
        }),

      setSlotItem: (playerId: PlayerId, slotIndex: number, itemStack: ItemStack | null) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const updatedInventory = yield* SlotManager.setSlotItem(inventory, slotIndex, itemStack)
          yield* updateInventory(playerId, updatedInventory)
        }),

      clearSlot: (playerId: PlayerId, slotIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
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
          const inventory = yield* getOrCreateInventory(playerId)
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
          const inventory = yield* getOrCreateInventory(playerId)
          return inventory.armor[armorType]
        }),

      setOffhandItem: (playerId: PlayerId, itemStack: ItemStack | null) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
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
          const inventory = yield* getOrCreateInventory(playerId)
          return inventory.offhand
        }),

      transferToHotbar: (playerId: PlayerId, sourceSlot: number, hotbarIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const updatedInventory = yield* SlotManager.setHotbarReference(inventory, hotbarIndex, sourceSlot)
          yield* updateInventory(playerId, updatedInventory)
        }),

      getHotbarItem: (playerId: PlayerId, hotbarIndex: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return yield* SlotManager.getHotbarItem(inventory, hotbarIndex)
        }),

      dropItem: (playerId: PlayerId, slotIndex: number, amount?: number) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const item = yield* SlotManager.getSlotItem(inventory, slotIndex)

          // Transform if statement to Option.match pattern
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
          const inventory = yield* getOrCreateInventory(playerId)
          const droppedItems: ItemStack[] = []

          // Transform for loop with if statement to functional approach
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

          // Transform armor if statements to Option.match patterns
          pipe(
            Option.fromNullable(inventory.armor.helmet),
            Option.match({
              onNone: () => {},
              onSome: (helmet) => droppedItems.push(helmet),
            })
          )

          pipe(
            Option.fromNullable(inventory.armor.chestplate),
            Option.match({
              onNone: () => {},
              onSome: (chestplate) => droppedItems.push(chestplate),
            })
          )

          pipe(
            Option.fromNullable(inventory.armor.leggings),
            Option.match({
              onNone: () => {},
              onSome: (leggings) => droppedItems.push(leggings),
            })
          )

          pipe(
            Option.fromNullable(inventory.armor.boots),
            Option.match({
              onNone: () => {},
              onSome: (boots) => droppedItems.push(boots),
            })
          )

          // Transform offhand if statement to Option.match pattern
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
          const inventory = yield* getOrCreateInventory(playerId)
          const state: InventoryState = {
            inventory,
            lastModified: Date.now(),
            version: '1.0.0',
          }
          return state
        }),

      loadInventoryState: (state: InventoryState) =>
        Effect.gen(function* () {
          yield* updateInventory(state.inventory.playerId, state.inventory)
        }),

      getEmptySlotCount: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return SlotManager.countEmptySlots(inventory)
        }),

      getUsedSlotCount: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return SlotManager.countUsedSlots(inventory)
        }),

      findItemSlots: (playerId: PlayerId, itemId: string) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return SlotManager.findItemSlots(inventory, itemId)
        }),

      countItem: (playerId: PlayerId, itemId: string) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          let count = 0

          // Transform for loop with if statement to functional approach
          for (const item of inventory.slots) {
            pipe(
              Option.fromNullable(item),
              Option.match({
                onNone: () => {},
                onSome: (existingItem) => {
                  pipe(
                    existingItem.itemId === itemId,
                    Match.value,
                    Match.when(true, () => {
                      count += existingItem.count
                    }),
                    Match.when(false, () => {}),
                    Match.exhaustive
                  )
                },
              })
            )
          }
          return count
        }),

      hasSpaceForItem: (playerId: PlayerId, itemStack: ItemStack) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return yield* StackProcessor.hasSpaceForItem(inventory, itemStack, registry)
        }),

      canAddItem: (playerId: PlayerId, itemStack: ItemStack) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          return yield* StackProcessor.hasSpaceForItem(inventory, itemStack, registry)
        }),

      sortInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const sortedInventory = SlotManager.sortInventory(inventory)
          yield* updateInventory(playerId, sortedInventory)
        }),

      compactInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const compactedInventory = SlotManager.compactInventory(inventory)
          yield* updateInventory(playerId, compactedInventory)
        }),
    }
  })
)
