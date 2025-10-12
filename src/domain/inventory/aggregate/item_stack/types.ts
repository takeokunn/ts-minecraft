/**
 * @fileoverview ItemStackエンティティの型定義とドメインロジック
 * DDD原則に基づくエンティティの実装
 */

import { JsonRecordSchema } from '@shared/schema/json'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Schema } from 'effect'
import { unsafeCoerce } from 'effect/Function'
import type { ItemId } from '../../types'
import { ItemIdSchema } from '../../value_object/item_id/schema'
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

// ===== makeUnsafe Functions =====

export const makeUnsafeItemStackId = (value: string): ItemStackId => unsafeCoerce<string, ItemStackId>(value)

export const makeUnsafeItemCount = (value: number): ItemCount => unsafeCoerce<number, ItemCount>(value)

export const makeUnsafeDurability = (value: number): Durability => unsafeCoerce<number, Durability>(value)

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
  attributes: Schema.optional(JsonRecordSchema),
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
  itemId: ItemIdSchema,
  mergedQuantity: ItemCountSchema,
  finalQuantity: ItemCountSchema,
  timestamp: Schema.DateTimeUtc,
})

export const ItemStackSplitEventSchema = Schema.Struct({
  type: Schema.Literal('ItemStackSplit'),
  sourceStackId: ItemStackIdSchema,
  newStackId: ItemStackIdSchema,
  itemId: ItemIdSchema,
  splitQuantity: ItemCountSchema,
  remainingQuantity: ItemCountSchema,
  timestamp: Schema.DateTimeUtc,
})

export const ItemStackConsumedEventSchema = Schema.Struct({
  type: Schema.Literal('ItemStackConsumed'),
  stackId: ItemStackIdSchema,
  itemId: ItemIdSchema,
  consumedQuantity: ItemCountSchema,
  remainingQuantity: ItemCountSchema,
  timestamp: Schema.DateTimeUtc,
  reason: Schema.Literal('used', 'crafted', 'damaged', 'expired'),
})

export const ItemStackDamageEventSchema = Schema.Struct({
  type: Schema.Literal('ItemStackDamaged'),
  stackId: ItemStackIdSchema,
  itemId: ItemIdSchema,
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

export const ItemStackErrorSchema = Schema.TaggedError('ItemStackError', {
  reason: Schema.Literal(
    'INVALID_STACK_SIZE',
    'INCOMPATIBLE_ITEMS',
    'INSUFFICIENT_QUANTITY',
    'ITEM_BROKEN',
    'INVALID_DURABILITY',
    'MERGE_OVERFLOW',
    'SPLIT_UNDERFLOW',
    'ENCHANTMENT_CONFLICT',
    'NBT_MISMATCH',
    'MERGE_DIFFERENT_ITEMS',
    'STACK_LIMIT_EXCEEDED'
  ),
  message: Schema.String,
  stackId: Schema.optional(ItemStackIdSchema),
  itemId: Schema.optional(ItemIdSchema),
  quantity: Schema.optional(ItemCountSchema),
  metadata: Schema.optional(JsonRecordSchema),
  issues: Schema.optional(Schema.Array(Schema.String)),
  originalError: Schema.optional(Schema.Unknown),
})
export type ItemStackError = Schema.Schema.Type<typeof ItemStackErrorSchema>

const baseItemStackError = makeErrorFactory(ItemStackErrorSchema)

export const ItemStackError = {
  ...baseItemStackError,
  invalidStackSize: (stackId: ItemStackId, size: number): ItemStackError =>
    ItemStackErrorSchema.make({
      reason: 'INVALID_STACK_SIZE',
      message: `不正なスタックサイズ: ${size}`,
      stackId,
      quantity: makeUnsafeItemCount(size),
    }),
  incompatibleItems: (sourceId: ItemStackId, targetId: ItemStackId): ItemStackError =>
    ItemStackErrorSchema.make({
      reason: 'INCOMPATIBLE_ITEMS',
      message: `互換性のないアイテム: ${sourceId} と ${targetId}`,
      stackId: sourceId,
    }),
  insufficientQuantity: (stackId: ItemStackId, requested: number, available: number): ItemStackError =>
    ItemStackErrorSchema.make({
      reason: 'INSUFFICIENT_QUANTITY',
      message: `数量不足: ${requested} > ${available}`,
      stackId,
      quantity: makeUnsafeItemCount(requested),
    }),
  itemBroken: (stackId: ItemStackId, itemId: ItemId): ItemStackError =>
    ItemStackErrorSchema.make({
      reason: 'ITEM_BROKEN',
      message: `アイテムが破損しています: ${itemId}`,
      stackId,
      itemId,
    }),
  mergeOverflow: (sourceId: ItemStackId, targetId: ItemStackId, totalSize: number): ItemStackError =>
    ItemStackErrorSchema.make({
      reason: 'MERGE_OVERFLOW',
      message: `マージによるスタックサイズオーバーフロー: ${totalSize}`,
      stackId: sourceId,
      quantity: makeUnsafeItemCount(totalSize),
    }),
  splitUnderflow: (stackId: ItemStackId, splitSize: number): ItemStackError =>
    ItemStackErrorSchema.make({
      reason: 'SPLIT_UNDERFLOW',
      message: `分割によるスタックサイズアンダーフロー: ${splitSize}`,
      stackId,
      quantity: makeUnsafeItemCount(splitSize),
    }),
} as const
