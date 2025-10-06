/**
 * @fileoverview ItemStackエンティティの型定義とドメインロジック
 * DDD原則に基づくエンティティの実装
 */

import { Schema } from 'effect'
import type { ItemId } from '../../types'
import { ItemIdSchema } from '../../types/core'
import { ItemMetadataSchema } from '../../value_object/item_metadata/schema'

// ===== Brand Types =====

export const ItemStackIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^stack_[A-Za-z0-9_-]+$/),
  Schema.brand('ItemStackId')
)
export type ItemStackId = Schema.Schema.Type<typeof ItemStackIdSchema>

export const ItemCountSchema = Schema.Number.pipe(Schema.int(), Schema.between(1, 64), Schema.brand('ItemCount'))
export type ItemCount = Schema.Schema.Type<typeof ItemCountSchema>

export const DurabilitySchema = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('Durability'))
export type Durability = Schema.Schema.Type<typeof DurabilitySchema>

// ===== Value Objects =====

export const EnchantmentSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.nonEmptyString()),
  level: Schema.Number.pipe(Schema.int(), Schema.between(1, 255)),
  description: Schema.optional(Schema.String),
})
export type Enchantment = Schema.Schema.Type<typeof EnchantmentSchema>

export const ItemNBTDataSchema = Schema.Struct({
  enchantments: Schema.optional(Schema.Array(EnchantmentSchema)),
  customName: Schema.optional(Schema.String),
  lore: Schema.optional(Schema.Array(Schema.String)),
  unbreakable: Schema.optional(Schema.Boolean),
  hideFlags: Schema.optional(Schema.Number.pipe(Schema.int())),
  customModelData: Schema.optional(Schema.Number.pipe(Schema.int())),
  attributes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  tags: Schema.optional(Schema.Array(Schema.String)),
})
export type ItemNBTData = Schema.Schema.Type<typeof ItemNBTDataSchema>

// ===== Entity =====

export const ItemStackEntitySchema = Schema.Struct({
  // エンティティ識別子
  id: ItemStackIdSchema,

  // 基本アイテム情報
  itemId: ItemIdSchema,
  count: ItemCountSchema,

  // オプション属性
  durability: Schema.optional(DurabilitySchema),
  metadata: Schema.optional(ItemMetadataSchema),
  nbtData: Schema.optional(ItemNBTDataSchema),

  // エンティティメタデータ
  createdAt: Schema.DateTimeUtc,
  lastModified: Schema.DateTimeUtc,
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export type ItemStackEntity = Schema.Schema.Type<typeof ItemStackEntitySchema>

// ===== Domain Events =====

export const ItemStackMergedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemStackMerged'),
  sourceStackId: ItemStackIdSchema,
  targetStackId: ItemStackIdSchema,
  itemId: Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)),
  mergedQuantity: ItemCountSchema,
  finalQuantity: ItemCountSchema,
  timestamp: Schema.DateTimeUtc,
})

export const ItemStackSplitEventSchema = Schema.Struct({
  type: Schema.Literal('ItemStackSplit'),
  sourceStackId: ItemStackIdSchema,
  newStackId: ItemStackIdSchema,
  itemId: Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)),
  splitQuantity: ItemCountSchema,
  remainingQuantity: ItemCountSchema,
  timestamp: Schema.DateTimeUtc,
})

export const ItemStackConsumedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemStackConsumed'),
  stackId: ItemStackIdSchema,
  itemId: Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)),
  consumedQuantity: ItemCountSchema,
  remainingQuantity: ItemCountSchema,
  timestamp: Schema.DateTimeUtc,
  reason: Schema.Literal('used', 'crafted', 'damaged', 'expired'),
})

export const ItemStackDamageEventSchema = Schema.Struct({
  type: Schema.Literal('ItemStackDamaged'),
  stackId: ItemStackIdSchema,
  itemId: Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)),
  previousDurability: DurabilitySchema,
  newDurability: DurabilitySchema,
  damageAmount: Schema.Number.pipe(Schema.between(0, 1)),
  timestamp: Schema.DateTimeUtc,
  broken: Schema.Boolean,
})

export const ItemStackDomainEventSchema = Schema.Union(
  ItemStackMergedEventSchema,
  ItemStackSplitEventSchema,
  ItemStackConsumedEventSchema,
  ItemStackDamageEventSchema
)

export type ItemStackMergedEvent = Schema.Schema.Type<typeof ItemStackMergedEventSchema>
export type ItemStackSplitEvent = Schema.Schema.Type<typeof ItemStackSplitEventSchema>
export type ItemStackConsumedEvent = Schema.Schema.Type<typeof ItemStackConsumedEventSchema>
export type ItemStackDamageEvent = Schema.Schema.Type<typeof ItemStackDamageEventSchema>
export type ItemStackDomainEvent = Schema.Schema.Type<typeof ItemStackDomainEventSchema>

// ===== Constants =====

export const ITEM_STACK_CONSTANTS = {
  MAX_STACK_SIZE: 64,
  MIN_STACK_SIZE: 1,
  MAX_DURABILITY: 1.0,
  MIN_DURABILITY: 0.0,
  BROKEN_THRESHOLD: 0.0,
  MAX_ENCHANTMENT_LEVEL: 255,
  DEFAULT_VERSION: 1,
} as const

// ===== Error Types =====

export class ItemStackError extends Schema.TaggedError<ItemStackError>()('ItemStackError', {
  reason: Schema.Literal(
    'INVALID_STACK_SIZE',
    'INCOMPATIBLE_ITEMS',
    'INSUFFICIENT_QUANTITY',
    'ITEM_BROKEN',
    'INVALID_DURABILITY',
    'MERGE_OVERFLOW',
    'SPLIT_UNDERFLOW',
    'ENCHANTMENT_CONFLICT',
    'NBT_MISMATCH'
  ),
  message: Schema.String,
  stackId: Schema.optional(ItemStackIdSchema),
  itemId: Schema.optional(Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema))),
  quantity: Schema.optional(ItemCountSchema),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
}) {
  static invalidStackSize(stackId: ItemStackId, size: number): ItemStackError {
    return new ItemStackError({
      reason: 'INVALID_STACK_SIZE',
      message: `不正なスタックサイズ: ${size}`,
      stackId,
      quantity: size as ItemCount,
    })
  }

  static incompatibleItems(sourceId: ItemStackId, targetId: ItemStackId): ItemStackError {
    return new ItemStackError({
      reason: 'INCOMPATIBLE_ITEMS',
      message: `互換性のないアイテム: ${sourceId} と ${targetId}`,
      stackId: sourceId,
    })
  }

  static insufficientQuantity(stackId: ItemStackId, requested: number, available: number): ItemStackError {
    return new ItemStackError({
      reason: 'INSUFFICIENT_QUANTITY',
      message: `数量不足: ${requested} > ${available}`,
      stackId,
      quantity: requested as ItemCount,
    })
  }

  static itemBroken(stackId: ItemStackId, itemId: ItemId): ItemStackError {
    return new ItemStackError({
      reason: 'ITEM_BROKEN',
      message: `アイテムが破損しています: ${itemId}`,
      stackId,
      itemId,
    })
  }

  static mergeOverflow(sourceId: ItemStackId, targetId: ItemStackId, totalSize: number): ItemStackError {
    return new ItemStackError({
      reason: 'MERGE_OVERFLOW',
      message: `マージによるスタックサイズオーバーフロー: ${totalSize}`,
      stackId: sourceId,
      quantity: totalSize as ItemCount,
    })
  }

  static splitUnderflow(stackId: ItemStackId, splitSize: number): ItemStackError {
    return new ItemStackError({
      reason: 'SPLIT_UNDERFLOW',
      message: `分割によるスタックサイズアンダーフロー: ${splitSize}`,
      stackId,
      quantity: splitSize as ItemCount,
    })
  }
}
