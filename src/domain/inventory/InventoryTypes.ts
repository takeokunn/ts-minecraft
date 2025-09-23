/**
 * InventoryTypes - Schema definitions for inventory management
 *
 * Provides type-safe schema definitions for items, stacks, and inventory
 * using Effect-TS Schema for runtime validation
 */

import { Schema } from '@effect/schema'
import { Brand } from 'effect'

// Brand types for type safety
export type ItemId = string & Brand.Brand<'ItemId'>
export const ItemId = Brand.nominal<ItemId>()

export type PlayerId = string & Brand.Brand<'PlayerId'>
export const PlayerId = Brand.nominal<PlayerId>()

// Item metadata schema
export const ItemMetadata = Schema.Struct({
  enchantments: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        level: Schema.Number.pipe(Schema.between(1, 5)),
      })
    )
  ),
  customName: Schema.optional(Schema.String),
  lore: Schema.optional(Schema.Array(Schema.String)),
  damage: Schema.optional(Schema.Number.pipe(Schema.between(0, 1000))),
})
export type ItemMetadata = Schema.Schema.Type<typeof ItemMetadata>

// ItemStack schema
export const ItemStack = Schema.Struct({
  itemId: Schema.String.pipe(Schema.fromBrand(ItemId)),
  count: Schema.Number.pipe(Schema.between(1, 64)),
  metadata: Schema.optional(ItemMetadata),
  durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
})
export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// Inventory schema with 36 slots
export const Inventory = Schema.Struct({
  playerId: Schema.String.pipe(Schema.fromBrand(PlayerId)),
  slots: Schema.Array(Schema.NullOr(ItemStack)).pipe(Schema.itemsCount(36)),
  hotbar: Schema.Array(Schema.Number.pipe(Schema.between(0, 35))).pipe(Schema.itemsCount(9)), // インデックス参照
  armor: Schema.Struct({
    helmet: Schema.NullOr(ItemStack),
    chestplate: Schema.NullOr(ItemStack),
    leggings: Schema.NullOr(ItemStack),
    boots: Schema.NullOr(ItemStack),
  }),
  offhand: Schema.NullOr(ItemStack),
  selectedSlot: Schema.Number.pipe(Schema.between(0, 8)),
})
export type Inventory = Schema.Schema.Type<typeof Inventory>

// Add item result
export const AddItemResult = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('success'),
    remainingItems: Schema.Number,
    affectedSlots: Schema.Array(Schema.Number),
  }),
  Schema.Struct({
    _tag: Schema.Literal('partial'),
    addedItems: Schema.Number,
    remainingItems: Schema.Number,
    affectedSlots: Schema.Array(Schema.Number),
  }),
  Schema.Struct({
    _tag: Schema.Literal('full'),
    message: Schema.String,
  })
)
export type AddItemResult = Schema.Schema.Type<typeof AddItemResult>

// Inventory state for persistence
export const InventoryState = Schema.Struct({
  inventory: Inventory,
  lastModified: Schema.Number,
  version: Schema.String,
})
export type InventoryState = Schema.Schema.Type<typeof InventoryState>

// Error types
export const InventoryErrorReason = Schema.Literal(
  'INVENTORY_NOT_FOUND',
  'INVALID_SLOT_INDEX',
  'INVALID_ITEM_COUNT',
  'SLOT_OCCUPIED',
  'INSUFFICIENT_ITEMS',
  'INVENTORY_FULL',
  'INVALID_STACK_SIZE',
  'ITEM_NOT_STACKABLE'
)
export type InventoryErrorReason = Schema.Schema.Type<typeof InventoryErrorReason>

// Default inventory factory
export const createEmptyInventory = (playerId: PlayerId): Inventory => ({
  playerId,
  slots: Array(36).fill(null),
  hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  armor: {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
  },
  offhand: null,
  selectedSlot: 0,
})

// Validation helpers
export const validateItemStack = Schema.decodeUnknown(ItemStack)
export const validateInventory = Schema.decodeUnknown(Inventory)
export const validateAddItemResult = Schema.decodeUnknown(AddItemResult)
export const validateInventoryState = Schema.decodeUnknown(InventoryState)
