/**
 * SlotManager - Handles slot operations and validations
 *
 * Manages slot access, validation, and manipulation operations
 * for inventory slots, hotbar, armor, and offhand
 */

import { Effect, Option, pipe } from 'effect'
import { Inventory, ItemStack } from './InventoryTypes.js'
import { InventoryError } from './InventoryService.js'

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
    if (preferHotbar) {
      // Check hotbar first
      for (let i = SlotManager.FIRST_HOTBAR_SLOT; i <= SlotManager.LAST_HOTBAR_SLOT; i++) {
        const hotbarSlot = inventory.hotbar[i]
        if (hotbarSlot !== undefined) {
          const slot = inventory.slots[hotbarSlot]
          if (slot === null || slot === undefined) {
            return Option.some(hotbarSlot)
          }
        }
      }
    }

    // Check all slots
    for (let i = 0; i < SlotManager.INVENTORY_SIZE; i++) {
      const slot = inventory.slots[i]
      if (slot === null || slot === undefined) {
        return Option.some(i)
      }
    }

    return Option.none()
  }

  // Find slots with specific item
  static findItemSlots(inventory: Inventory, itemId: string): number[] {
    const slots: number[] = []
    for (let i = 0; i < SlotManager.INVENTORY_SIZE; i++) {
      const item = inventory.slots[i]
      if (item && item.itemId === itemId) {
        slots.push(i)
      }
    }
    return slots
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
        if (slotIndex === undefined) return null
        return inventory.slots[slotIndex] ?? null
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
    if (hotbarSlot === undefined) return null
    return inventory.slots[hotbarSlot] ?? null
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

        if (!fromItem) {
          return Effect.fail(new InventoryError('INSUFFICIENT_ITEMS', undefined, { fromSlot }))
        }

        const newSlots = [...inventory.slots]
        newSlots[fromSlot] = toItem
        newSlots[toSlot] = fromItem

        return Effect.succeed({
          ...inventory,
          slots: newSlots,
        })
      })
    )
  }

  // Swap items between slots
  static swapItems(inventory: Inventory, slot1: number, slot2: number): Effect.Effect<Inventory, InventoryError> {
    return SlotManager.moveItem(inventory, slot1, slot2)
  }

  // Compact inventory (move items to fill empty slots)
  static compactInventory(inventory: Inventory): Inventory {
    const items: (ItemStack | null)[] = []
    const nonNullItems: ItemStack[] = []

    // Collect all non-null items
    for (const slot of inventory.slots) {
      if (slot !== null && slot !== undefined) {
        nonNullItems.push(slot)
      }
    }

    // Fill slots from the beginning
    let itemIndex = 0
    for (let i = 0; i < SlotManager.INVENTORY_SIZE; i++) {
      if (itemIndex < nonNullItems.length) {
        const item = nonNullItems[itemIndex]
        if (item !== undefined) {
          items.push(item)
          itemIndex++
        } else {
          items.push(null)
        }
      } else {
        items.push(null)
      }
    }

    return {
      ...inventory,
      slots: items,
    }
  }

  // Sort inventory by item ID
  static sortInventory(inventory: Inventory): Inventory {
    const items: (ItemStack | null)[] = []
    const nonNullItems: ItemStack[] = []

    // Collect all non-null items
    for (const slot of inventory.slots) {
      if (slot !== null && slot !== undefined) {
        nonNullItems.push(slot)
      }
    }

    // Sort items by ID, then by count
    nonNullItems.sort((a, b) => {
      const idComparison = a.itemId.localeCompare(b.itemId)
      if (idComparison !== 0) return idComparison
      return b.count - a.count
    })

    // Fill slots with sorted items
    let itemIndex = 0
    for (let i = 0; i < SlotManager.INVENTORY_SIZE; i++) {
      if (itemIndex < nonNullItems.length) {
        const item = nonNullItems[itemIndex]
        if (item !== undefined) {
          items.push(item)
          itemIndex++
        } else {
          items.push(null)
        }
      } else {
        items.push(null)
      }
    }

    return {
      ...inventory,
      slots: items,
    }
  }
}
