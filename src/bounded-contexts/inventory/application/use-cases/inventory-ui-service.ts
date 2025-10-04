import { Context, Effect } from 'effect'
import { InventoryService } from '@mc/bc-inventory/domain/inventory-service'
import {
  type Inventory as DomainInventory,
  type InventoryMetadata as DomainInventoryMetadata,
  type ItemMetadata as DomainItemMetadata,
  type ItemStack as DomainItemStack,
  type PlayerId as DomainPlayerId,
  PlayerId as DomainPlayerIdFactory,
} from '@mc/bc-inventory/domain/inventory-types'

export type PlayerIdDTO = string

export interface ItemMetadataDTO {
  readonly displayName?: string
  readonly lore?: ReadonlyArray<string>
  readonly durability?: number
  readonly enchantments?: ReadonlyArray<{ readonly id: string; readonly level: number }>
  readonly category?: string
  readonly equipSlot?: string
  readonly fuelTicks?: number
}

export interface ItemStackDTO {
  readonly itemId: string
  readonly count: number
  readonly metadata?: ItemMetadataDTO
}

export interface ArmorSlotsDTO {
  readonly helmet: ItemStackDTO | null
  readonly chestplate: ItemStackDTO | null
  readonly leggings: ItemStackDTO | null
  readonly boots: ItemStackDTO | null
}

export interface InventoryMetadataDTO {
  readonly lastUpdated: number
  readonly checksum: string
}

export interface InventoryDTO {
  readonly id: string
  readonly playerId: PlayerIdDTO
  readonly slots: ReadonlyArray<ItemStackDTO | null>
  readonly hotbar: ReadonlyArray<number>
  readonly selectedSlot: number
  readonly armor: ArmorSlotsDTO
  readonly offhand: ItemStackDTO | null
  readonly version: number
  readonly metadata: InventoryMetadataDTO
}

export type InventoryUiError = {
  readonly _tag: 'InventoryUiError'
  readonly message: string
  readonly cause?: unknown
}

export interface InventoryUiService {
  readonly getInventory: (playerId: PlayerIdDTO) => Effect.Effect<InventoryDTO, InventoryUiError>
  readonly getSlotItem: (
    playerId: PlayerIdDTO,
    slotIndex: number
  ) => Effect.Effect<ItemStackDTO | null, InventoryUiError>
  readonly setSelectedSlot: (
    playerId: PlayerIdDTO,
    hotbarIndex: number
  ) => Effect.Effect<void, InventoryUiError>
  readonly moveItem: (
    playerId: PlayerIdDTO,
    fromSlot: number,
    toSlot: number,
    amount?: number
  ) => Effect.Effect<void, InventoryUiError>
  readonly swapItems: (
    playerId: PlayerIdDTO,
    firstSlot: number,
    secondSlot: number
  ) => Effect.Effect<void, InventoryUiError>
  readonly mergeStacks: (
    playerId: PlayerIdDTO,
    sourceSlot: number,
    targetSlot: number
  ) => Effect.Effect<void, InventoryUiError>
  readonly splitStack: (
    playerId: PlayerIdDTO,
    sourceSlot: number,
    targetSlot: number,
    amount: number
  ) => Effect.Effect<void, InventoryUiError>
  readonly transferToHotbar: (
    playerId: PlayerIdDTO,
    slotIndex: number,
    hotbarIndex: number
  ) => Effect.Effect<void, InventoryUiError>
  readonly dropItem: (
    playerId: PlayerIdDTO,
    slotIndex: number,
    amount?: number
  ) => Effect.Effect<ItemStackDTO | null, InventoryUiError>
  readonly dropAllItems: (playerId: PlayerIdDTO) => Effect.Effect<ReadonlyArray<ItemStackDTO>, InventoryUiError>
}

export const InventoryUiService = Context.GenericTag<InventoryUiService>(
  '@mc/bc-inventory/application/InventoryUiService'
)

export const toPlayerId = (playerId: PlayerIdDTO): DomainPlayerId =>
  DomainPlayerIdFactory(playerId)

const toItemMetadataDTO = (metadata?: DomainItemMetadata): ItemMetadataDTO | undefined => {
  if (!metadata) {
    return undefined
  }

  return {
    displayName: (metadata as any).displayName ?? metadata.customName,
    lore: metadata.lore,
    durability: metadata.durability,
    enchantments: metadata.enchantments?.map((enchantment) => ({
      id: enchantment.id,
      level: enchantment.level,
    })),
    category: (metadata as any).category,
    equipSlot: (metadata as any).equipSlot,
    fuelTicks: (metadata as any).fuelTicks,
  }
}

export const toItemStackDTO = (item: DomainItemStack | null): ItemStackDTO | null =>
  item
    ? {
        itemId: item.itemId,
        count: item.count,
        metadata: toItemMetadataDTO(item.metadata),
      }
    : null

const toInventoryMetadataDTO = (
  metadata: DomainInventoryMetadata
): InventoryMetadataDTO => ({
  lastUpdated: metadata.lastUpdated,
  checksum: metadata.checksum,
})

export const toInventoryDTO = (inventory: DomainInventory): InventoryDTO => ({
  id: inventory.id,
  playerId: inventory.playerId,
  slots: inventory.slots.map(toItemStackDTO),
  hotbar: [...inventory.hotbar],
  selectedSlot: inventory.selectedSlot,
  armor: {
    helmet: toItemStackDTO(inventory.armor.helmet),
    chestplate: toItemStackDTO(inventory.armor.chestplate),
    leggings: toItemStackDTO(inventory.armor.leggings),
    boots: toItemStackDTO(inventory.armor.boots),
  },
  offhand: toItemStackDTO(inventory.offhand),
  version: inventory.version,
  metadata: toInventoryMetadataDTO(inventory.metadata),
})

export const fromDomainError = (error: unknown): InventoryUiError => ({
  _tag: 'InventoryUiError',
  message: error instanceof Error ? error.message : JSON.stringify(error),
  cause: error,
})
