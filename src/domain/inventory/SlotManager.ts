/**
 * SlotManager - Handles slot operations and validations
 *
 * Manages slot access, validation, and manipulation operations
 * for inventory slots, hotbar, armor, and offhand
 */

import { Effect, Match, Option, pipe } from 'effect'
import { Inventory, ItemStack } from './InventoryTypes'
import { InventoryError } from './InventoryService'

export class SlotManager {
  static readonly INVENTORY_SIZE = 36
  static readonly HOTBAR_SIZE = 9
  static readonly FIRST_HOTBAR_SLOT = 0
  static readonly LAST_HOTBAR_SLOT = 8
  static readonly FIRST_MAIN_SLOT = 9
  static readonly LAST_MAIN_SLOT = 35

  // Validate slot index
  static validateSlotIndex(index: number): Effect.Effect<void, InventoryError> {
    return index >= 0 && index < SlotManager.INVENTORY_SIZE
      ? Effect.void
      : Effect.fail(new InventoryError('INVALID_SLOT_INDEX', undefined, { index }))
  }

  // Validate hotbar index
  static validateHotbarIndex(index: number): Effect.Effect<void, InventoryError> {
    return index >= 0 && index < SlotManager.HOTBAR_SIZE
      ? Effect.void
      : Effect.fail(
          new InventoryError('INVALID_SLOT_INDEX', undefined, {
            hotbarIndex: index,
          })
        )
  }

  // Get item from slot
  static getSlotItem(inventory: Inventory, slotIndex: number): Effect.Effect<ItemStack | null, InventoryError> {
    return pipe(
      SlotManager.validateSlotIndex(slotIndex),
      Effect.map(() => inventory.slots[slotIndex] ?? null)
    )
  }

  // Set item in slot
  static setSlotItem(
    inventory: Inventory,
    slotIndex: number,
    item: ItemStack | null
  ): Effect.Effect<Inventory, InventoryError> {
    return pipe(
      SlotManager.validateSlotIndex(slotIndex),
      Effect.map(() => {
        const newSlots = [...inventory.slots]
        newSlots[slotIndex] = item
        return {
          ...inventory,
          slots: newSlots,
        }
      })
    )
  }

  // Clear a slot
  static clearSlot(
    inventory: Inventory,
    slotIndex: number
  ): Effect.Effect<{ inventory: Inventory; removed: ItemStack | null }, InventoryError> {
    return pipe(
      SlotManager.validateSlotIndex(slotIndex),
      Effect.map(() => {
        const removed = inventory.slots[slotIndex] ?? null
        const newSlots = [...inventory.slots]
        newSlots[slotIndex] = null
        return {
          inventory: {
            ...inventory,
            slots: newSlots,
          },
          removed,
        }
      })
    )
  }

  // Find empty slot
  static findEmptySlot(inventory: Inventory, preferHotbar: boolean = false): Option.Option<number> {
    // Create array of all slot indices to check
    const allSlots = Array.from({ length: SlotManager.INVENTORY_SIZE }, (_, i) => i)

    // Create hotbar slot indices array
    const hotbarSlots = Array.from({ length: SlotManager.HOTBAR_SIZE }, (_, i) => i)
      .map((hotbarIndex) => inventory.hotbar[hotbarIndex])
      .filter((slot): slot is number => slot !== undefined)

    // Determine which slots to check first based on preference
    const slotsToCheck = pipe(
      preferHotbar,
      Match.value,
      Match.when(true, () => [...hotbarSlots, ...allSlots.filter((slot) => !hotbarSlots.includes(slot))]),
      Match.when(false, () => allSlots),
      Match.exhaustive
    )

    // Find first empty slot using functional approach
    const result = slotsToCheck
      .map((slotIndex) => ({
        slotIndex,
        isEmpty: pipe(inventory.slots[slotIndex], Option.fromNullable, Option.isNone),
      }))
      .find(({ isEmpty }) => isEmpty)

    return pipe(
      result,
      Option.fromNullable,
      Option.map(({ slotIndex }) => slotIndex)
    )
  }

  // Find slots with specific item
  static findItemSlots(inventory: Inventory, itemId: string): number[] {
    return Array.from({ length: SlotManager.INVENTORY_SIZE }, (_, i) => i).filter((i) => {
      const item = inventory.slots[i]
      return pipe(
        item,
        Option.fromNullable,
        Option.match({
          onNone: () => false,
          onSome: (stackItem) => stackItem.itemId === itemId,
        })
      )
    })
  }

  // Count empty slots
  static countEmptySlots(inventory: Inventory): number {
    return inventory.slots.filter((slot: any) => slot === null).length
  }

  // Count used slots
  static countUsedSlots(inventory: Inventory): number {
    return inventory.slots.filter((slot: any) => slot !== null).length
  }

  // Get hotbar item by index
  static getHotbarItem(inventory: Inventory, hotbarIndex: number): Effect.Effect<ItemStack | null, InventoryError> {
    return pipe(
      SlotManager.validateHotbarIndex(hotbarIndex),
      Effect.map(() => {
        const slotIndex = inventory.hotbar[hotbarIndex]
        return pipe(
          slotIndex,
          Option.fromNullable,
          Option.match({
            onNone: () => null,
            onSome: (slot) => inventory.slots[slot] ?? null,
          })
        )
      })
    )
  }

  // Set hotbar reference
  static setHotbarReference(
    inventory: Inventory,
    hotbarIndex: number,
    slotIndex: number
  ): Effect.Effect<Inventory, InventoryError> {
    return pipe(
      Effect.all([SlotManager.validateHotbarIndex(hotbarIndex), SlotManager.validateSlotIndex(slotIndex)]),
      Effect.map(() => {
        const newHotbar = [...inventory.hotbar]
        newHotbar[hotbarIndex] = slotIndex
        return {
          ...inventory,
          hotbar: newHotbar,
        }
      })
    )
  }

  // Get selected item (from hotbar)
  static getSelectedItem(inventory: Inventory): ItemStack | null {
    const hotbarSlot = inventory.hotbar[inventory.selectedSlot]
    return pipe(
      hotbarSlot,
      Option.fromNullable,
      Option.match({
        onNone: () => null,
        onSome: (slot) => inventory.slots[slot] ?? null,
      })
    )
  }

  // Set selected slot
  static setSelectedSlot(inventory: Inventory, slotIndex: number): Effect.Effect<Inventory, InventoryError> {
    return pipe(
      SlotManager.validateHotbarIndex(slotIndex),
      Effect.map(() => ({
        ...inventory,
        selectedSlot: slotIndex,
      }))
    )
  }

  // Check if slot is in hotbar
  static isHotbarSlot(slotIndex: number): boolean {
    const hotbarIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    return hotbarIndices.some((i) => i === slotIndex)
  }

  // Move item between slots
  static moveItem(inventory: Inventory, fromSlot: number, toSlot: number): Effect.Effect<Inventory, InventoryError> {
    return pipe(
      Effect.all([SlotManager.validateSlotIndex(fromSlot), SlotManager.validateSlotIndex(toSlot)]),
      Effect.flatMap(() => {
        const fromItem = inventory.slots[fromSlot] ?? null
        const toItem = inventory.slots[toSlot] ?? null

        return pipe(
          fromItem,
          Option.fromNullable,
          Option.match({
            onNone: () => Effect.fail(new InventoryError('INSUFFICIENT_ITEMS', undefined, { fromSlot })),
            onSome: (item) => {
              const newSlots = [...inventory.slots]
              newSlots[fromSlot] = toItem
              newSlots[toSlot] = item

              return Effect.succeed({
                ...inventory,
                slots: newSlots,
              })
            },
          })
        )
      })
    )
  }

  // Swap items between slots
  static swapItems(inventory: Inventory, slot1: number, slot2: number): Effect.Effect<Inventory, InventoryError> {
    return SlotManager.moveItem(inventory, slot1, slot2)
  }

  // Compact inventory (move items to fill empty slots)
  static compactInventory(inventory: Inventory): Inventory {
    // Collect all non-null items using functional approach
    const nonNullItems: ItemStack[] = inventory.slots.filter((slot): slot is ItemStack =>
      pipe(slot, Option.fromNullable, Option.isSome)
    )

    // Create new slots array: fill with items first, then nulls
    const newSlots: (ItemStack | null)[] = Array.from({ length: SlotManager.INVENTORY_SIZE }, (_, i) =>
      pipe(
        Option.fromNullable(nonNullItems[i]), // Use Option to handle potential undefined
        Option.match({
          onNone: () => null,
          onSome: (item) => item,
        })
      )
    )

    return {
      ...inventory,
      slots: newSlots,
    }
  }

  // Sort inventory by item ID
  static sortInventory(inventory: Inventory): Inventory {
    // Collect all non-null items using functional approach
    const nonNullItems: ItemStack[] = inventory.slots.filter((slot): slot is ItemStack =>
      pipe(slot, Option.fromNullable, Option.isSome)
    )

    // Sort items by ID, then by count using functional comparison
    nonNullItems.sort((a, b) => {
      const idComparison = a.itemId.localeCompare(b.itemId)
      return pipe(
        idComparison !== 0,
        Match.value,
        Match.when(true, () => idComparison),
        Match.when(false, () => b.count - a.count),
        Match.exhaustive
      )
    })

    // Create new slots array: fill with sorted items first, then nulls
    const newSlots: (ItemStack | null)[] = Array.from({ length: SlotManager.INVENTORY_SIZE }, (_, i) =>
      pipe(
        Option.fromNullable(nonNullItems[i]), // Use Option to handle potential undefined
        Option.match({
          onNone: () => null,
          onSome: (item) => item,
        })
      )
    )

    return {
      ...inventory,
      slots: newSlots,
    }
  }
}
