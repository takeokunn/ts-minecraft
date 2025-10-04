import { Context, Effect } from 'effect'
import type {
  ArmorSlots,
  Inventory,
  InventoryState,
  ItemId,
  ItemStack,
  PlayerId,
} from './inventory-types'
import type { ItemRegistryError } from './item-registry'

export type AddItemResult =
  | {
      readonly _tag: 'success'
      readonly addedItems: number
      readonly remainingItems: number
      readonly affectedSlots: ReadonlyArray<number>
    }
  | {
      readonly _tag: 'partial'
      readonly addedItems: number
      readonly remainingItems: number
      readonly affectedSlots: ReadonlyArray<number>
    }
  | {
      readonly _tag: 'full'
      readonly addedItems: number
      readonly remainingItems: number
      readonly affectedSlots: ReadonlyArray<number>
    }

export type InventoryServiceError =
  | { readonly _tag: 'InvalidSlotIndex'; readonly slotIndex: number }
  | { readonly _tag: 'InvalidHotbarIndex'; readonly hotbarIndex: number }
  | { readonly _tag: 'SlotOccupied'; readonly slotIndex: number }
  | { readonly _tag: 'DifferentItemKind'; readonly sourceSlot: number; readonly targetSlot: number }
  | { readonly _tag: 'InsufficientQuantity'; readonly slotIndex: number; readonly requested: number; readonly available: number }
  | { readonly _tag: 'SplitTargetMustBeCompatible'; readonly sourceSlot: number; readonly targetSlot: number }
  | { readonly _tag: 'InventoryStateValidationFailed'; readonly reason: unknown }

export const InventoryServiceError = {
  invalidSlotIndex: (slotIndex: number): InventoryServiceError => ({ _tag: 'InvalidSlotIndex', slotIndex }),
  invalidHotbarIndex: (hotbarIndex: number): InventoryServiceError => ({ _tag: 'InvalidHotbarIndex', hotbarIndex }),
  slotOccupied: (slotIndex: number): InventoryServiceError => ({ _tag: 'SlotOccupied', slotIndex }),
  differentItemKind: (sourceSlot: number, targetSlot: number): InventoryServiceError => ({
    _tag: 'DifferentItemKind',
    sourceSlot,
    targetSlot,
  }),
  insufficientQuantity: (slotIndex: number, requested: number, available: number): InventoryServiceError => ({
    _tag: 'InsufficientQuantity',
    slotIndex,
    requested,
    available,
  }),
  splitTargetMustBeCompatible: (sourceSlot: number, targetSlot: number): InventoryServiceError => ({
    _tag: 'SplitTargetMustBeCompatible',
    sourceSlot,
    targetSlot,
  }),
  inventoryStateValidationFailed: (reason: unknown): InventoryServiceError => ({
    _tag: 'InventoryStateValidationFailed',
    reason,
  }),
} as const

export interface InventoryService {
  readonly createInventory: (playerId: PlayerId) => Effect.Effect<Inventory>
  readonly getInventory: (playerId: PlayerId) => Effect.Effect<Inventory>
  readonly getInventoryState: (playerId: PlayerId) => Effect.Effect<InventoryState>
  readonly loadInventoryState: (
    state: InventoryState
  ) => Effect.Effect<void, InventoryServiceError>
  readonly addItem: (
    playerId: PlayerId,
    item: ItemStack
  ) => Effect.Effect<AddItemResult, InventoryServiceError | ItemRegistryError>
  readonly setSlotItem: (
    playerId: PlayerId,
    slotIndex: number,
    item: ItemStack | null
  ) => Effect.Effect<void, InventoryServiceError>
  readonly getSlotItem: (
    playerId: PlayerId,
    slotIndex: number
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly removeItem: (
    playerId: PlayerId,
    slotIndex: number,
    amount?: number
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly moveItem: (
    playerId: PlayerId,
    fromSlot: number,
    toSlot: number,
    amount?: number
  ) => Effect.Effect<void, InventoryServiceError | ItemRegistryError>
  readonly swapItems: (
    playerId: PlayerId,
    firstSlot: number,
    secondSlot: number
  ) => Effect.Effect<void, InventoryServiceError>
  readonly splitStack: (
    playerId: PlayerId,
    sourceSlot: number,
    targetSlot: number,
    amount: number
  ) => Effect.Effect<void, InventoryServiceError | ItemRegistryError>
  readonly mergeStacks: (
    playerId: PlayerId,
    sourceSlot: number,
    targetSlot: number
  ) => Effect.Effect<void, InventoryServiceError | ItemRegistryError>
  readonly setSelectedSlot: (
    playerId: PlayerId,
    hotbarIndex: number
  ) => Effect.Effect<void, InventoryServiceError>
  readonly getSelectedItem: (
    playerId: PlayerId
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly getHotbarItem: (
    playerId: PlayerId,
    hotbarIndex: number
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly transferToHotbar: (
    playerId: PlayerId,
    slotIndex: number,
    hotbarIndex: number
  ) => Effect.Effect<void, InventoryServiceError>
  readonly equipArmor: (
    playerId: PlayerId,
    slot: keyof ArmorSlots,
    item: ItemStack | null
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly getArmor: (
    playerId: PlayerId,
    slot: keyof ArmorSlots
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly setOffhandItem: (
    playerId: PlayerId,
    item: ItemStack | null
  ) => Effect.Effect<void, InventoryServiceError>
  readonly getOffhandItem: (
    playerId: PlayerId
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly getEmptySlotCount: (
    playerId: PlayerId
  ) => Effect.Effect<number, InventoryServiceError>
  readonly getUsedSlotCount: (
    playerId: PlayerId
  ) => Effect.Effect<number, InventoryServiceError>
  readonly findItemSlots: (
    playerId: PlayerId,
    itemId: ItemId | string
  ) => Effect.Effect<ReadonlyArray<number>, InventoryServiceError>
  readonly countItem: (
    playerId: PlayerId,
    itemId: ItemId | string
  ) => Effect.Effect<number, InventoryServiceError>
  readonly hasSpaceForItem: (
    playerId: PlayerId,
    item: ItemStack
  ) => Effect.Effect<boolean, InventoryServiceError | ItemRegistryError>
  readonly sortInventory: (playerId: PlayerId) => Effect.Effect<void, InventoryServiceError>
  readonly compactInventory: (playerId: PlayerId) => Effect.Effect<void, InventoryServiceError>
  readonly dropItem: (
    playerId: PlayerId,
    slotIndex: number,
    amount?: number
  ) => Effect.Effect<ItemStack | null, InventoryServiceError>
  readonly dropAllItems: (
    playerId: PlayerId
  ) => Effect.Effect<ReadonlyArray<ItemStack>, InventoryServiceError>
  readonly clearInventory: (playerId: PlayerId) => Effect.Effect<void, InventoryServiceError>
}

export const InventoryService = Context.GenericTag<InventoryService>(
  '@minecraft/domain/inventory/InventoryService'
)

export type InventoryServiceTag = typeof InventoryService
