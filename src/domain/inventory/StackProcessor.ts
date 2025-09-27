/**
 * StackProcessor - Item stack processing and management
 *
 * Handles stack operations including merging, splitting,
 * and validation of item stacks
 */

import { Effect, Option, pipe, Match, Stream } from 'effect'
import { AddItemResult, Inventory, ItemStack } from './InventoryTypes'
import { SlotManager } from './SlotManager'
import { InventoryError } from './InventoryService'

// Registry service interface for dependency injection
export interface RegistryService {
  readonly getMaxStackSize: (itemId: string | any) => Effect.Effect<number, never, never>
  readonly canStack: (item1: ItemStack, item2: ItemStack) => Effect.Effect<boolean, never, never>
}

export class StackProcessor {
  // Merge two stacks together
  static mergeStacks(
    source: ItemStack,
    target: ItemStack,
    maxStackSize: number
  ): {
    source: ItemStack | null
    target: ItemStack
    transferred: number
  } {
    return pipe(
      Match.value({ source, target, maxStackSize }),
      Match.when(
        ({ source, target }) => source.itemId !== target.itemId,
        ({ source, target }) => ({ source, target, transferred: 0 })
      ),
      Match.when(
        ({ target, maxStackSize }) => maxStackSize - target.count <= 0,
        ({ source, target }) => ({ source, target, transferred: 0 })
      ),
      Match.orElse(({ source, target, maxStackSize }) => {
        const targetSpace = maxStackSize - target.count
        const transferAmount = Math.min(source.count, targetSpace)

        const newTarget: ItemStack = {
          ...target,
          count: target.count + transferAmount,
        }

        const remainingCount = source.count - transferAmount
        const newSource: ItemStack | null =
          remainingCount > 0
            ? {
                ...source,
                count: remainingCount,
              }
            : null

        return {
          source: newSource,
          target: newTarget,
          transferred: transferAmount,
        }
      })
    )
  }

  // Split a stack into two
  static splitStack(
    stack: ItemStack,
    amount: number
  ): {
    original: ItemStack | null
    split: ItemStack | null
  } {
    return pipe(
      Match.value({ stack, amount }),
      Match.when(
        ({ amount }) => amount <= 0,
        ({ stack }) => ({ original: stack, split: null })
      ),
      Match.when(
        ({ amount, stack }) => amount >= stack.count,
        ({ stack }) => ({ original: null, split: stack })
      ),
      Match.orElse(({ stack, amount }) => {
        const splitStack: ItemStack = {
          ...stack,
          count: amount,
        }

        const remainingStack: ItemStack = {
          ...stack,
          count: stack.count - amount,
        }

        return {
          original: remainingStack,
          split: splitStack,
        }
      })
    )
  }

  // Add item to inventory with stacking logic
  static addItemToInventory(
    inventory: Inventory,
    itemStack: ItemStack,
    registryService: RegistryService
  ): Effect.Effect<{ inventory: Inventory; result: AddItemResult }, InventoryError> {
    return Effect.gen(function* () {
      const maxStackSize = yield* registryService.getMaxStackSize(itemStack.itemId)
      let remaining = itemStack.count
      const affectedSlots: number[] = []
      let newInventory = inventory

      // First pass: Try to merge with existing stacks
      yield* pipe(
        Match.value({ itemStackCount: itemStack.count, maxStackSize }),
        Match.when(
          ({ itemStackCount, maxStackSize }) => itemStackCount > 1 || maxStackSize > 1,
          () =>
            Effect.gen(function* () {
              const existingSlots = SlotManager.findItemSlots(newInventory, itemStack.itemId)

              yield* Effect.forEach(
                existingSlots,
                (slotIndex) =>
                  pipe(
                    Match.value(remaining),
                    Match.when(
                      (rem) => rem <= 0,
                      () => Effect.succeed(void 0)
                    ),
                    Match.orElse(() =>
                      Effect.gen(function* () {
                        const existingStack = newInventory.slots[slotIndex]

                        yield* pipe(
                          Option.fromNullable(existingStack),
                          Option.match({
                            onNone: () => Effect.succeed(void 0),
                            onSome: (stack) =>
                              Effect.gen(function* () {
                                const canStack = yield* registryService.canStack(itemStack, stack)

                                yield* pipe(
                                  Match.value({ canStack, availableSpace: maxStackSize - stack.count }),
                                  Match.when(
                                    ({ canStack }) => !canStack,
                                    () => Effect.succeed(void 0)
                                  ),
                                  Match.when(
                                    ({ availableSpace }) => availableSpace <= 0,
                                    () => Effect.succeed(void 0)
                                  ),
                                  Match.orElse(({ availableSpace }) =>
                                    Effect.gen(function* () {
                                      const toAdd = Math.min(remaining, availableSpace)
                                      const updatedStack: ItemStack = {
                                        ...stack,
                                        count: stack.count + toAdd,
                                      }

                                      const updateResult = yield* SlotManager.setSlotItem(
                                        newInventory,
                                        slotIndex,
                                        updatedStack
                                      )
                                      newInventory = updateResult
                                      remaining -= toAdd
                                      affectedSlots.push(slotIndex)
                                    })
                                  )
                                )
                              }),
                          })
                        )
                      })
                    )
                  ),
                { concurrency: 1 }
              )
            })
        ),
        Match.orElse(() => Effect.succeed(void 0))
      )

      // Second pass: Add to empty slots using Stream
      yield* pipe(
        Stream.iterate(remaining, (rem) => rem - 1), // Creates infinite stream starting from remaining
        Stream.takeWhile((rem) => rem > 0),
        Stream.mapEffect(() =>
          Effect.gen(function* () {
            const emptySlot = SlotManager.findEmptySlot(newInventory, true)

            return yield* pipe(
              Option.match(emptySlot, {
                onNone: () => Effect.succeed({ shouldContinue: false, processed: 0 }),
                onSome: (slotIndex) =>
                  Effect.gen(function* () {
                    const toAdd = Math.min(remaining, maxStackSize)
                    const newStack: ItemStack = {
                      ...itemStack,
                      count: toAdd,
                    }

                    const updateResult = yield* SlotManager.setSlotItem(newInventory, slotIndex, newStack)
                    newInventory = updateResult
                    remaining -= toAdd
                    affectedSlots.push(slotIndex)

                    return { shouldContinue: remaining > 0, processed: toAdd }
                  }),
              })
            )
          })
        ),
        Stream.takeWhile(({ shouldContinue }) => shouldContinue),
        Stream.runDrain
      )

      // Determine result
      const result: AddItemResult = pipe(
        Match.value({ remaining, itemStackCount: itemStack.count }),
        Match.when(
          ({ remaining }) => remaining === 0,
          () => ({
            _tag: 'success' as const,
            remainingItems: 0,
            affectedSlots,
          })
        ),
        Match.when(
          ({ remaining, itemStackCount }) => remaining < itemStackCount,
          ({ remaining, itemStackCount }) => ({
            _tag: 'partial' as const,
            addedItems: itemStackCount - remaining,
            remainingItems: remaining,
            affectedSlots,
          })
        ),
        Match.orElse(() => ({
          _tag: 'full' as const,
          message: 'Inventory is full',
        }))
      )

      return { inventory: newInventory, result }
    })
  }

  // Remove items from a slot
  static removeFromSlot(
    inventory: Inventory,
    slotIndex: number,
    amount: number
  ): Effect.Effect<{ inventory: Inventory; removed: ItemStack | null }, InventoryError> {
    return Effect.gen(function* () {
      const item = yield* SlotManager.getSlotItem(inventory, slotIndex)

      return yield* pipe(
        Option.fromNullable(item),
        Option.match({
          onNone: () => Effect.succeed({ inventory, removed: null }),
          onSome: (item) =>
            pipe(
              Match.value({ amount, itemCount: item.count }),
              Match.when(
                ({ amount, itemCount }) => amount >= itemCount,
                () =>
                  Effect.gen(function* () {
                    // Remove entire stack
                    const result = yield* SlotManager.clearSlot(inventory, slotIndex)
                    return { inventory: result.inventory, removed: result.removed }
                  })
              ),
              Match.orElse(() =>
                Effect.gen(function* () {
                  // Partial removal
                  const updatedItem: ItemStack = {
                    ...item,
                    count: item.count - amount,
                  }
                  const removedItem: ItemStack = {
                    ...item,
                    count: amount,
                  }
                  const updatedInventory = yield* SlotManager.setSlotItem(inventory, slotIndex, updatedItem)
                  return { inventory: updatedInventory, removed: removedItem }
                })
              )
            ),
        })
      )
    })
  }

  // Transfer specific amount between slots
  static transferBetweenSlots(
    inventory: Inventory,
    fromSlot: number,
    toSlot: number,
    amount: number,
    registryService: RegistryService
  ): Effect.Effect<Inventory, InventoryError> {
    return Effect.gen(function* () {
      const fromItem = yield* SlotManager.getSlotItem(inventory, fromSlot)
      const toItem = yield* SlotManager.getSlotItem(inventory, toSlot)

      return yield* pipe(
        Option.fromNullable(fromItem),
        Option.match({
          onNone: () => Effect.succeed(inventory),
          onSome: (fromItem) =>
            Effect.gen(function* () {
              const transferAmount = Math.min(amount, fromItem.count)

              return yield* pipe(
                Option.fromNullable(toItem),
                Option.match({
                  onNone: () =>
                    Effect.gen(function* () {
                      // Moving to empty slot
                      const splitResult = StackProcessor.splitStack(fromItem, transferAmount)
                      let newInventory = yield* SlotManager.setSlotItem(inventory, fromSlot, splitResult.original)
                      newInventory = yield* SlotManager.setSlotItem(newInventory, toSlot, splitResult.split)
                      return newInventory
                    }),
                  onSome: (toItem) =>
                    Effect.gen(function* () {
                      // Check if items can stack
                      const canStack = yield* registryService.canStack(fromItem, toItem)

                      return yield* pipe(
                        Match.value(canStack),
                        Match.when(
                          (canStack) => !canStack,
                          () => SlotManager.swapItems(inventory, fromSlot, toSlot)
                        ),
                        Match.orElse(() =>
                          Effect.gen(function* () {
                            // Merge stacks
                            const maxStackSize = yield* registryService.getMaxStackSize(fromItem.itemId)
                            const transferItem: ItemStack = {
                              ...fromItem,
                              count: transferAmount,
                            }

                            const mergeResult = StackProcessor.mergeStacks(transferItem, toItem, maxStackSize)
                            let newInventory = inventory

                            // Update source slot
                            return yield* pipe(
                              Match.value({ fromItemCount: fromItem.count, transferAmount }),
                              Match.when(
                                ({ fromItemCount, transferAmount }) => fromItemCount === transferAmount,
                                () =>
                                  Effect.gen(function* () {
                                    // Entire stack was transferred
                                    newInventory = yield* SlotManager.setSlotItem(
                                      newInventory,
                                      fromSlot,
                                      mergeResult.source
                                    )
                                    // Update target slot
                                    newInventory = yield* SlotManager.setSlotItem(
                                      newInventory,
                                      toSlot,
                                      mergeResult.target
                                    )
                                    return newInventory
                                  })
                              ),
                              Match.orElse(() =>
                                Effect.gen(function* () {
                                  // Partial transfer
                                  const remainingSource: ItemStack = {
                                    ...fromItem,
                                    count: fromItem.count - mergeResult.transferred,
                                  }
                                  newInventory = yield* SlotManager.setSlotItem(newInventory, fromSlot, remainingSource)
                                  // Update target slot
                                  newInventory = yield* SlotManager.setSlotItem(
                                    newInventory,
                                    toSlot,
                                    mergeResult.target
                                  )
                                  return newInventory
                                })
                              )
                            )
                          })
                        )
                      )
                    }),
                })
              )
            }),
        })
      )
    })
  }

  // Check if inventory has space for item
  static hasSpaceForItem(
    inventory: Inventory,
    itemStack: ItemStack,
    registryService: RegistryService
  ): Effect.Effect<boolean, never, never> {
    return Effect.gen(function* () {
      const maxStackSize = yield* registryService.getMaxStackSize(itemStack.itemId)

      // Check existing stacks first - calculate how much space they have
      const existingSlots = SlotManager.findItemSlots(inventory, itemStack.itemId)

      let totalAvailableSpace = 0

      // Calculate available space in existing stacks using Effect-TS patterns
      for (const slotIndex of existingSlots) {
        const existingStack = inventory.slots[slotIndex]
        yield* pipe(
          Option.fromNullable(existingStack),
          Option.match({
            onNone: () => Effect.void,
            onSome: (stack) =>
              Effect.gen(function* () {
                const canStack = yield* registryService.canStack(itemStack, stack)
                yield* pipe(
                  Match.value(canStack),
                  Match.when(true, () =>
                    Effect.sync(() => {
                      const availableSpace = maxStackSize - stack.count
                      totalAvailableSpace += Math.max(0, availableSpace)
                    })
                  ),
                  Match.when(false, () => Effect.void),
                  Match.exhaustive
                )
              }),
          })
        )
      }

      // Check if existing stacks can accommodate all items using Match.value
      const hasEnoughSpace = totalAvailableSpace >= itemStack.count
      return yield* pipe(
        Match.value(hasEnoughSpace),
        Match.when(true, () => Effect.succeed(true)),
        Match.when(false, () =>
          Effect.gen(function* () {
            // Calculate remaining items that need new slots
            const remainingItems = itemStack.count - totalAvailableSpace

            // Check if we have enough empty slots
            const emptySlotCount = SlotManager.countEmptySlots(inventory)
            const slotsNeeded = Math.ceil(remainingItems / maxStackSize)

            return emptySlotCount >= slotsNeeded
          })
        ),
        Match.exhaustive
      )
    })
  }

  // Consolidate stacks of the same item
  static consolidateStacks(
    inventory: Inventory,
    registryService: {
      readonly getMaxStackSize: (itemId: string) => Effect.Effect<number, never, never>
    }
  ): Effect.Effect<Inventory, InventoryError> {
    return Effect.gen(function* () {
      let newInventory = inventory
      const processedIds = new Set<string>()

      for (let i = 0; i < SlotManager.INVENTORY_SIZE; i++) {
        const item = newInventory.slots[i]

        yield* pipe(
          Option.fromNullable(item),
          Option.match({
            onNone: () => Effect.succeed(void 0),
            onSome: (item) =>
              pipe(
                Match.value(processedIds.has(item.itemId)),
                Match.when(
                  (hasProcessed) => hasProcessed,
                  () => Effect.succeed(void 0) // continue equivalent
                ),
                Match.orElse(() =>
                  Effect.gen(function* () {
                    processedIds.add(item.itemId)
                    const maxStackSize = yield* registryService.getMaxStackSize(item.itemId)

                    // Find all slots with this item
                    const itemSlots = SlotManager.findItemSlots(newInventory, item.itemId)

                    // Consolidate into as few stacks as possible
                    let totalCount = 0

                    for (const slotIndex of itemSlots) {
                      const stack = newInventory.slots[slotIndex]
                      yield* pipe(
                        Option.fromNullable(stack),
                        Option.match({
                          onNone: () => Effect.succeed(void 0),
                          onSome: (stack) =>
                            Effect.gen(function* () {
                              totalCount += stack.count
                              // Clear the slot for now
                              const result = yield* SlotManager.clearSlot(newInventory, slotIndex)
                              newInventory = result.inventory
                            }),
                        })
                      )
                    }

                    // Create consolidated stacks
                    let remainingCount = totalCount
                    let slotIdx = 0

                    while (remainingCount > 0 && slotIdx < itemSlots.length) {
                      const stackCount = Math.min(remainingCount, maxStackSize)
                      const newStack: ItemStack = {
                        ...item,
                        count: stackCount,
                      }
                      const idx = itemSlots[slotIdx]
                      yield* pipe(
                        Option.fromNullable(idx),
                        Option.match({
                          onNone: () => Effect.succeed(void 0),
                          onSome: (idx) =>
                            Effect.gen(function* () {
                              newInventory = yield* SlotManager.setSlotItem(newInventory, idx, newStack)
                            }),
                        })
                      )
                      remainingCount -= stackCount
                      slotIdx++
                    }
                  })
                )
              ),
          })
        )
      }

      return newInventory
    })
  }
}
