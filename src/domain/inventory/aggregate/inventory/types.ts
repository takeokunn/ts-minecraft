/**
 * @fileoverview Inventory集約ルートの型定義とドメインイベント
 * DDD原則に基づく集約境界の厳密な管理
 */

import { Effect, Schema } from 'effect'
import type { ItemId } from '../../types'
import { PlayerIdSchema } from '../../types/core'
import { ItemIdSchema } from '../../value_object/item_id/schema'
import { ItemStackEntitySchema } from '../item_stack/types'

// ===== Brand Types =====

export const InventoryIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^inv_[A-Za-z0-9_-]+$/),
  Schema.brand('InventoryId')
)
export type InventoryId = Schema.Schema.Type<typeof InventoryIdSchema>

export const SlotIndexSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 35), Schema.brand('SlotIndex'))
export type SlotIndex = Schema.Schema.Type<typeof SlotIndexSchema>

export const HotbarSlotSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 8), Schema.brand('HotbarSlot'))
export type HotbarSlot = Schema.Schema.Type<typeof HotbarSlotSchema>

// ===== Value Objects =====

export const InventorySlotSchema = Schema.Union(
  Schema.Null,
  Schema.Struct({
    itemStack: ItemStackEntitySchema,
    metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  })
)
export type InventorySlot = Schema.Schema.Type<typeof InventorySlotSchema>

export const ArmorSlotSchema = Schema.Struct({
  helmet: InventorySlotSchema,
  chestplate: InventorySlotSchema,
  leggings: InventorySlotSchema,
  boots: InventorySlotSchema,
})
export type ArmorSlot = Schema.Schema.Type<typeof ArmorSlotSchema>

// ===== Aggregate Root =====

export const InventoryAggregateSchema = Schema.Struct({
  id: InventoryIdSchema,
  playerId: PlayerIdSchema,
  slots: Schema.Array(InventorySlotSchema).pipe(Schema.minItems(36), Schema.maxItems(36)),
  hotbar: Schema.Array(SlotIndexSchema).pipe(Schema.minItems(9), Schema.maxItems(9)),
  armor: ArmorSlotSchema,
  offhand: InventorySlotSchema,
  selectedSlot: HotbarSlotSchema,
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  lastModified: Schema.DateTimeUtc,
  uncommittedEvents: Schema.Array(Schema.suspend(() => InventoryDomainEventSchema)),
})

export type InventoryAggregate = Schema.Schema.Type<typeof InventoryAggregateSchema>

// ===== Domain Events =====

export const ItemAddedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemAdded'),
  aggregateId: InventoryIdSchema,
  playerId: PlayerIdSchema,
  itemId: ItemIdSchema,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slotIndex: SlotIndexSchema,
  timestamp: Schema.DateTimeUtc,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
})

export const ItemRemovedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemRemoved'),
  aggregateId: InventoryIdSchema,
  playerId: PlayerIdSchema,
  itemId: ItemIdSchema,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slotIndex: SlotIndexSchema,
  timestamp: Schema.DateTimeUtc,
  reason: Schema.Literal('consumed', 'dropped', 'crafted', 'transferred'),
})

export const ItemsSwappedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemsSwapped'),
  aggregateId: InventoryIdSchema,
  playerId: PlayerIdSchema,
  fromSlot: SlotIndexSchema,
  toSlot: SlotIndexSchema,
  timestamp: Schema.DateTimeUtc,
})

export const HotbarChangedEventSchema = Schema.Struct({
  type: Schema.Literal('HotbarChanged'),
  aggregateId: InventoryIdSchema,
  playerId: PlayerIdSchema,
  previousSlot: HotbarSlotSchema,
  newSlot: HotbarSlotSchema,
  timestamp: Schema.DateTimeUtc,
})

export const InventoryDomainEventSchema = Schema.Union(
  ItemAddedEventSchema,
  ItemRemovedEventSchema,
  ItemsSwappedEventSchema,
  HotbarChangedEventSchema
)

export type ItemAddedEvent = Schema.Schema.Type<typeof ItemAddedEventSchema>
export type ItemRemovedEvent = Schema.Schema.Type<typeof ItemRemovedEventSchema>
export type ItemsSwappedEvent = Schema.Schema.Type<typeof ItemsSwappedEventSchema>
export type HotbarChangedEvent = Schema.Schema.Type<typeof HotbarChangedEventSchema>
export type InventoryDomainEvent = Schema.Schema.Type<typeof InventoryDomainEventSchema>

// ===== Business Rules & Specifications =====

export const InventoryBusinessRuleSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
})

export type InventoryBusinessRule = Schema.Schema.Type<typeof InventoryBusinessRuleSchema> & {
  validate: (inventory: InventoryAggregate) => Effect.Effect<boolean, InventoryAggregateError>
}

// ===== Constants =====

export const INVENTORY_CONSTANTS = {
  MAIN_INVENTORY_SIZE: 36,
  HOTBAR_SIZE: 9,
  ARMOR_SLOTS: 4,
  MAX_STACK_SIZE: 64,
  MIN_STACK_SIZE: 1,
} as const

// ===== Error Types =====

export class InventoryAggregateError extends Schema.TaggedError<InventoryAggregateError>()('InventoryAggregateError', {
  reason: Schema.Literal(
    'SLOT_OCCUPIED',
    'SLOT_EMPTY',
    'INVALID_SLOT_INDEX',
    'ITEM_NOT_STACKABLE',
    'STACK_SIZE_EXCEEDED',
    'INSUFFICIENT_QUANTITY',
    'INVALID_ITEM_TYPE',
    'ARMOR_SLOT_MISMATCH',
    'AGGREGATE_VERSION_CONFLICT'
  ),
  message: Schema.String,
  slotIndex: Schema.optional(SlotIndexSchema),
  itemId: Schema.optional(ItemIdSchema),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
}) {
  static slotOccupied(slotIndex: SlotIndex, itemId?: ItemId): InventoryAggregateError {
    return new InventoryAggregateError({
      reason: 'SLOT_OCCUPIED',
      message: `スロット${slotIndex}は既に占有されています`,
      slotIndex,
      itemId,
    })
  }

  static slotEmpty(slotIndex: SlotIndex): InventoryAggregateError {
    return new InventoryAggregateError({
      reason: 'SLOT_EMPTY',
      message: `スロット${slotIndex}は空です`,
      slotIndex,
    })
  }

  static invalidSlotIndex(slotIndex: number): InventoryAggregateError {
    return new InventoryAggregateError({
      reason: 'INVALID_SLOT_INDEX',
      message: `不正なスロットインデックス: ${slotIndex}`,
      slotIndex: slotIndex as SlotIndex,
    })
  }

  static itemNotStackable(itemId: ItemId): InventoryAggregateError {
    return new InventoryAggregateError({
      reason: 'ITEM_NOT_STACKABLE',
      message: `アイテム${itemId}はスタックできません`,
      itemId,
    })
  }

  static stackSizeExceeded(itemId: ItemId, attempted: number, max: number): InventoryAggregateError {
    return new InventoryAggregateError({
      reason: 'STACK_SIZE_EXCEEDED',
      message: `アイテム${itemId}のスタックサイズ上限を超過: ${attempted} > ${max}`,
      itemId,
    })
  }

  static insufficientQuantity(itemId: ItemId, requested: number, available: number): InventoryAggregateError {
    return new InventoryAggregateError({
      reason: 'INSUFFICIENT_QUANTITY',
      message: `アイテム${itemId}の数量が不足: ${requested} > ${available}`,
      itemId,
    })
  }
}
