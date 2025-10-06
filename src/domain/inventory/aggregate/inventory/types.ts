/**
 * @fileoverview Inventory集約ルートの型定義とドメインイベント
 * DDD原則に基づく集約境界の厳密な管理
 */

import { Schema } from 'effect'
import type { ItemId } from '../../types'

// ===== Brand Types =====

export const InventoryIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^inv_[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/),
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
    itemStack: Schema.suspend(() => import('../item_stack/types.js').then((m) => m.ItemStackEntitySchema)),
    metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
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
  playerId: Schema.suspend(() => import('../../types.js').then((m) => m.PlayerIdSchema)),
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
  playerId: Schema.suspend(() => import('../../types.js').then((m) => m.PlayerIdSchema)),
  itemId: Schema.suspend(() => import('../../types.js').then((m) => m.ItemIdSchema)),
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slotIndex: SlotIndexSchema,
  timestamp: Schema.DateTimeUtc,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const ItemRemovedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemRemoved'),
  aggregateId: InventoryIdSchema,
  playerId: Schema.suspend(() => import('../../types.js').then((m) => m.PlayerIdSchema)),
  itemId: Schema.suspend(() => import('../../types.js').then((m) => m.ItemIdSchema)),
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slotIndex: SlotIndexSchema,
  timestamp: Schema.DateTimeUtc,
  reason: Schema.Literal('consumed', 'dropped', 'crafted', 'transferred'),
})

export const ItemsSwappedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemsSwapped'),
  aggregateId: InventoryIdSchema,
  playerId: Schema.suspend(() => import('../../types.js').then((m) => m.PlayerIdSchema)),
  fromSlot: SlotIndexSchema,
  toSlot: SlotIndexSchema,
  timestamp: Schema.DateTimeUtc,
})

export const HotbarChangedEventSchema = Schema.Struct({
  type: Schema.Literal('HotbarChanged'),
  aggregateId: InventoryIdSchema,
  playerId: Schema.suspend(() => import('../../types.js').then((m) => m.PlayerIdSchema)),
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
  validate: Schema.Function.pipe(Schema.annotations({ description: 'ビジネスルール検証関数' })),
})

export type InventoryBusinessRule = Schema.Schema.Type<typeof InventoryBusinessRuleSchema>

// ===== Constants =====

export const INVENTORY_CONSTANTS = {
  MAIN_INVENTORY_SIZE: 36,
  HOTBAR_SIZE: 9,
  ARMOR_SLOTS: 4,
  MAX_STACK_SIZE: 64,
  MIN_STACK_SIZE: 1,
} as const

// ===== Error Types =====

export const InventoryAggregateErrorSchema = Schema.TaggedError('InventoryAggregateError')(
  Schema.Struct({
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
    itemId: Schema.optional(Schema.suspend(() => import('../../types.js').then((m) => m.ItemIdSchema))),
    metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  })
)

export class InventoryAggregateError extends Schema.TaggedError('InventoryAggregateError')<{
  readonly reason: typeof InventoryAggregateErrorSchema.Type.reason
  readonly message: string
  readonly slotIndex?: SlotIndex
  readonly itemId?: ItemId
  readonly metadata?: Record<string, unknown>
}> {
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
