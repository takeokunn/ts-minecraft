/**
 * StackProcessor - Item stack processing and management
 *
 * Handles stack operations including merging, splitting,
 * and validation of item stacks
 */

import { Effect, Option, pipe } from 'effect'
import { AddItemResult, Inventory, ItemStack } from './InventoryTypes.js'
import { SlotManager } from './SlotManager.js'
import { InventoryError } from './InventoryService.js'

// Registry service interface for dependency injection
export interface RegistryService {
  readonly getMaxStackSize: (itemId: string | any) => Effect.Effect<number>
  readonly canStack: (item1: ItemStack, item2: ItemStack) => Effect.Effect<boolean>
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
    if (source.itemId !== target.itemId) {
      return { source, target, transferred: 0 }
    }

    const targetSpace = maxStackSize - target.count
    if (targetSpace <= 0) {
      return { source, target, transferred: 0 }
    }

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
  }

  // Split a stack into two
  static splitStack(
    stack: ItemStack,
    amount: number
  ): {
    original: ItemStack | null
    split: ItemStack | null
  } {
    if (amount <= 0) {
      return { original: stack, split: null }
    }

    if (amount >= stack.count) {
      // Moving entire stack
      return { original: null, split: stack }
    }

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
      if (itemStack.count > 1 || maxStackSize > 1) {
        const existingSlots = SlotManager.findItemSlots(newInventory, itemStack.itemId)

        for (const slotIndex of existingSlots) {
          if (remaining <= 0) break

          const existingStack = newInventory.slots[slotIndex]
          if (!existingStack) continue

          // Check if metadata matches for stacking
          const canStack = yield* registryService.canStack(itemStack, existingStack)
          if (!canStack) continue

          const availableSpace = maxStackSize - existingStack.count
          if (availableSpace <= 0) continue

          const toAdd = Math.min(remaining, availableSpace)
          const updatedStack: ItemStack = {
            ...existingStack,
            count: existingStack.count + toAdd,
          }

          const updateResult = yield* SlotManager.setSlotItem(newInventory, slotIndex, updatedStack)
          newInventory = updateResult
          remaining -= toAdd
          affectedSlots.push(slotIndex)
        }
      }

      // Second pass: Add to empty slots
      while (remaining > 0) {
        const emptySlot = SlotManager.findEmptySlot(newInventory, true)
        if (Option.isNone(emptySlot)) {
          // No more empty slots
          break
        }

        const slotIndex = emptySlot.value
        const toAdd = Math.min(remaining, maxStackSize)
        const newStack: ItemStack = {
          ...itemStack,
          count: toAdd,
        }

        const updateResult = yield* SlotManager.setSlotItem(newInventory, slotIndex, newStack)
        newInventory = updateResult
        remaining -= toAdd
        affectedSlots.push(slotIndex)
      }

      // Determine result
      let result: AddItemResult
      if (remaining === 0) {
        result = {
          _tag: 'success' as const,
          remainingItems: 0,
          affectedSlots,
        }
      } else if (remaining < itemStack.count) {
        result = {
          _tag: 'partial' as const,
          addedItems: itemStack.count - remaining,
          remainingItems: remaining,
          affectedSlots,
        }
      } else {
        result = {
          _tag: 'full' as const,
          message: 'Inventory is full',
        }
      }

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

      if (!item) {
        return { inventory, removed: null }
      }

      if (amount >= item.count) {
        // Remove entire stack
        const result = yield* SlotManager.clearSlot(inventory, slotIndex)
        return { inventory: result.inventory, removed: result.removed }
      } else {
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
      }
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

      if (!fromItem) {
        return inventory
      }

      const transferAmount = Math.min(amount, fromItem.count)

      if (!toItem) {
        // Moving to empty slot
        const splitResult = StackProcessor.splitStack(fromItem, transferAmount)
        let newInventory = yield* SlotManager.setSlotItem(inventory, fromSlot, splitResult.original)
        newInventory = yield* SlotManager.setSlotItem(newInventory, toSlot, splitResult.split)
        return newInventory
      }

      // Check if items can stack
      const canStack = yield* registryService.canStack(fromItem, toItem)
      if (!canStack) {
        // Cannot stack, swap instead
        return yield* SlotManager.swapItems(inventory, fromSlot, toSlot)
      }

      // Merge stacks
      const maxStackSize = yield* registryService.getMaxStackSize(fromItem.itemId)
      const transferItem: ItemStack = {
        ...fromItem,
        count: transferAmount,
      }

      const mergeResult = StackProcessor.mergeStacks(transferItem, toItem, maxStackSize)

      let newInventory = inventory

      // Update source slot
      if (fromItem.count === transferAmount) {
        // Entire stack was transferred
        newInventory = yield* SlotManager.setSlotItem(newInventory, fromSlot, mergeResult.source)
      } else {
        // Partial transfer
        const remainingSource: ItemStack = {
          ...fromItem,
          count: fromItem.count - mergeResult.transferred,
        }
        newInventory = yield* SlotManager.setSlotItem(newInventory, fromSlot, remainingSource)
      }

      // Update target slot
      newInventory = yield* SlotManager.setSlotItem(newInventory, toSlot, mergeResult.target)

      return newInventory
    })
  }

  // Check if inventory has space for item
  static hasSpaceForItem(
    inventory: Inventory,
    itemStack: ItemStack,
    registryService: RegistryService
  ): Effect.Effect<boolean, never> {
    return Effect.gen(function* () {
      const maxStackSize = yield* registryService.getMaxStackSize(itemStack.itemId)
      let remainingToAdd = itemStack.count

      // Check existing stacks
      const existingSlots = SlotManager.findItemSlots(inventory, itemStack.itemId)

      for (const slotIndex of existingSlots) {
        const existingStack = inventory.slots[slotIndex]
        if (!existingStack) continue

        const canStack = yield* registryService.canStack(itemStack, existingStack)
        if (!canStack) continue

        const availableSpace = maxStackSize - existingStack.count
        remainingToAdd -= availableSpace

        if (remainingToAdd <= 0) return true
      }

      // Check empty slots
      const emptySlotCount = SlotManager.countEmptySlots(inventory)
      const slotsNeeded = Math.ceil(remainingToAdd / maxStackSize)

      return emptySlotCount >= slotsNeeded
    })
  }

  // Consolidate stacks of the same item
  static consolidateStacks(
    inventory: Inventory,
    registryService: {
      readonly getMaxStackSize: (itemId: string) => Effect.Effect<number>
    }
  ): Effect.Effect<Inventory, InventoryError> {
    return Effect.gen(function* () {
      let newInventory = inventory
      const processedIds = new Set<string>()

      for (let i = 0; i < SlotManager.INVENTORY_SIZE; i++) {
        const item = newInventory.slots[i]
        if (!item || processedIds.has(item.itemId)) continue

        processedIds.add(item.itemId)
        const maxStackSize = yield* registryService.getMaxStackSize(item.itemId)

        // Find all slots with this item
        const itemSlots = SlotManager.findItemSlots(newInventory, item.itemId)

        // Consolidate into as few stacks as possible
        let totalCount = 0

        for (const slotIndex of itemSlots) {
          const stack = newInventory.slots[slotIndex]
          if (stack) {
            totalCount += stack.count
            // Clear the slot for now
            const result = yield* SlotManager.clearSlot(newInventory, slotIndex)
            newInventory = result.inventory
          }
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
          if (idx !== undefined) {
            newInventory = yield* SlotManager.setSlotItem(newInventory, idx, newStack)
          }
          remainingCount -= stackCount
          slotIdx++
        }
      }

      return newInventory
    })
  }
}
