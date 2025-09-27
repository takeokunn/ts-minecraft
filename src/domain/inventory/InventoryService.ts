/**
 * InventoryService - Main inventory management service interface
 *
 * Provides comprehensive inventory operations including item management,
 * slot operations, and inventory state persistence
 */

import { Context, Effect } from 'effect'
import { AddItemResult, Inventory, InventoryErrorReason, InventoryState, ItemStack, PlayerId } from './InventoryTypes'

// Error definition
export class InventoryError extends Error {
  readonly _tag = 'InventoryError'
  constructor(
    readonly reason: InventoryErrorReason,
    readonly playerId?: PlayerId,
    readonly details?: unknown
  ) {
    super(`Inventory error: ${reason}`)
  }
}

// Service interface
export class InventoryService extends Context.Tag('InventoryService')<
  InventoryService,
  {
    readonly createInventory: (playerId: PlayerId) => Effect.Effect<Inventory, InventoryError>

    readonly getInventory: (playerId: PlayerId) => Effect.Effect<Inventory, InventoryError>

    readonly addItem: (playerId: PlayerId, itemStack: ItemStack) => Effect.Effect<AddItemResult, InventoryError>

    readonly removeItem: (
      playerId: PlayerId,
      slotIndex: number,
      amount: number
    ) => Effect.Effect<ItemStack | null, InventoryError>

    readonly moveItem: (
      playerId: PlayerId,
      fromSlot: number,
      toSlot: number,
      amount?: number
    ) => Effect.Effect<void, InventoryError>

    readonly swapItems: (playerId: PlayerId, slot1: number, slot2: number) => Effect.Effect<void, InventoryError>

    readonly splitStack: (
      playerId: PlayerId,
      sourceSlot: number,
      targetSlot: number,
      amount: number
    ) => Effect.Effect<void, InventoryError>

    readonly mergeStacks: (
      playerId: PlayerId,
      sourceSlot: number,
      targetSlot: number
    ) => Effect.Effect<void, InventoryError>

    readonly getSelectedItem: (playerId: PlayerId) => Effect.Effect<ItemStack | null, InventoryError>

    readonly setSelectedSlot: (playerId: PlayerId, slotIndex: number) => Effect.Effect<void, InventoryError>

    readonly getSlotItem: (playerId: PlayerId, slotIndex: number) => Effect.Effect<ItemStack | null, InventoryError>

    readonly setSlotItem: (
      playerId: PlayerId,
      slotIndex: number,
      itemStack: ItemStack | null
    ) => Effect.Effect<void, InventoryError>

    readonly clearSlot: (playerId: PlayerId, slotIndex: number) => Effect.Effect<ItemStack | null, InventoryError>

    readonly clearInventory: (playerId: PlayerId) => Effect.Effect<void, InventoryError>

    readonly equipArmor: (
      playerId: PlayerId,
      armorType: 'helmet' | 'chestplate' | 'leggings' | 'boots',
      itemStack: ItemStack | null
    ) => Effect.Effect<ItemStack | null, InventoryError>

    readonly getArmor: (
      playerId: PlayerId,
      armorType: 'helmet' | 'chestplate' | 'leggings' | 'boots'
    ) => Effect.Effect<ItemStack | null, InventoryError>

    readonly setOffhandItem: (
      playerId: PlayerId,
      itemStack: ItemStack | null
    ) => Effect.Effect<ItemStack | null, InventoryError>

    readonly getOffhandItem: (playerId: PlayerId) => Effect.Effect<ItemStack | null, InventoryError>

    readonly transferToHotbar: (
      playerId: PlayerId,
      sourceSlot: number,
      hotbarIndex: number
    ) => Effect.Effect<void, InventoryError>

    readonly getHotbarItem: (playerId: PlayerId, hotbarIndex: number) => Effect.Effect<ItemStack | null, InventoryError>

    readonly dropItem: (
      playerId: PlayerId,
      slotIndex: number,
      amount?: number
    ) => Effect.Effect<ItemStack | null, InventoryError>

    readonly dropAllItems: (playerId: PlayerId) => Effect.Effect<ItemStack[], InventoryError>

    readonly getInventoryState: (playerId: PlayerId) => Effect.Effect<InventoryState, InventoryError>

    readonly loadInventoryState: (state: InventoryState) => Effect.Effect<void, InventoryError>

    readonly getEmptySlotCount: (playerId: PlayerId) => Effect.Effect<number, InventoryError>

    readonly getUsedSlotCount: (playerId: PlayerId) => Effect.Effect<number, InventoryError>

    readonly findItemSlots: (playerId: PlayerId, itemId: string) => Effect.Effect<number[], InventoryError>

    readonly countItem: (playerId: PlayerId, itemId: string) => Effect.Effect<number, InventoryError>

    readonly hasSpaceForItem: (playerId: PlayerId, itemStack: ItemStack) => Effect.Effect<boolean, InventoryError>

    readonly canAddItem: (playerId: PlayerId, itemStack: ItemStack) => Effect.Effect<boolean, InventoryError>

    readonly sortInventory: (playerId: PlayerId) => Effect.Effect<void, InventoryError>

    readonly compactInventory: (playerId: PlayerId) => Effect.Effect<void, InventoryError>
  }
>() {}
