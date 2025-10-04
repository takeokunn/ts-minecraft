/**
 * ItemFactory - DDD Factory Pattern Interface for ItemStack
 *
 * Effect-TS関数型ファクトリーパターンによるItemStack生成システム
 * NBT、品質、レアリティ、エンチャントなどの複雑なアイテム属性を管理
 */

import { Context, Effect, Schema } from 'effect'
import type { ItemId, ItemStack } from '../../types'

// ItemStack Factory固有のエラー型（Schema.TaggedErrorパターン）
export class ItemCreationError extends Schema.TaggedError<ItemCreationError>()('ItemCreationError', {
  reason: Schema.String,
  invalidFields: Schema.Array(Schema.String),
  context: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(Schema.optional),
}) {}

export class ItemValidationError extends Schema.TaggedError<ItemValidationError>()('ItemValidationError', {
  reason: Schema.String,
  missingFields: Schema.Array(Schema.String),
  context: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(Schema.optional),
}) {}

export class ItemStackError extends Schema.TaggedError<ItemStackError>()('ItemStackError', {
  reason: Schema.String,
  stackingRules: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(Schema.optional),
  context: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(Schema.optional),
}) {}

// アイテムカテゴリ（DDD Value Object）
export type ItemCategory =
  | 'tool'
  | 'weapon'
  | 'armor'
  | 'food'
  | 'block'
  | 'resource'
  | 'misc'
  | 'consumable'
  | 'redstone'
  | 'decoration'

// アイテム品質レベル（DDD Value Object）
export type ItemQuality = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

// アイテムレアリティ（DDD Value Object）
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

// エンチャント定義（DDD Value Object）
export interface EnchantmentDefinition {
  readonly id: string
  readonly name: string
  readonly level: number
  readonly maxLevel: number
  readonly description?: string
  readonly conflictsWith?: ReadonlyArray<string>
}

// アイテム設定（DDD Value Object）
export interface ItemConfig {
  readonly itemId: ItemId
  readonly count?: number
  readonly category?: ItemCategory
  readonly quality?: ItemQuality
  readonly rarity?: ItemRarity
  readonly durability?: number
  readonly maxDurability?: number
  readonly enchantments?: ReadonlyArray<EnchantmentDefinition>
  readonly customName?: string
  readonly lore?: ReadonlyArray<string>
  readonly nbtData?: Record<string, unknown>
  readonly stackable?: boolean
  readonly maxStackSize?: number
}

// デフォルトアイテム設定（関数型定数）
export const defaultItemConfig: Partial<ItemConfig> = {
  count: 1,
  category: 'misc',
  quality: 'common',
  rarity: 'common',
  durability: 1.0,
  stackable: true,
  maxStackSize: 64,
} as const

// ItemStack Factory インターフェース（DDD Factory Pattern）
export interface ItemFactory {
  // 基本生成（Pure Function Pattern）
  readonly createBasic: (itemId: ItemId, count?: number) => Effect.Effect<ItemStack, ItemCreationError>

  // 設定ベース生成（Configuration-based Factory Pattern）
  readonly createWithConfig: (config: ItemConfig) => Effect.Effect<ItemStack, ItemCreationError>

  // カテゴリ別生成（Category-based Factory Pattern）
  readonly createTool: (
    itemId: ItemId,
    durability?: number,
    enchantments?: ReadonlyArray<EnchantmentDefinition>
  ) => Effect.Effect<ItemStack, ItemCreationError>

  readonly createWeapon: (
    itemId: ItemId,
    durability?: number,
    enchantments?: ReadonlyArray<EnchantmentDefinition>
  ) => Effect.Effect<ItemStack, ItemCreationError>

  readonly createArmor: (
    itemId: ItemId,
    durability?: number,
    enchantments?: ReadonlyArray<EnchantmentDefinition>
  ) => Effect.Effect<ItemStack, ItemCreationError>

  readonly createFood: (
    itemId: ItemId,
    count?: number,
    customEffects?: Record<string, unknown>
  ) => Effect.Effect<ItemStack, ItemCreationError>

  readonly createBlock: (itemId: ItemId, count?: number) => Effect.Effect<ItemStack, ItemCreationError>

  // エンチャント生成（Enchantment Factory Pattern）
  readonly addEnchantment: (
    item: ItemStack,
    enchantment: EnchantmentDefinition
  ) => Effect.Effect<ItemStack, ItemCreationError>

  readonly removeEnchantment: (item: ItemStack, enchantmentId: string) => Effect.Effect<ItemStack, ItemCreationError>

  // スタック操作（Stack Manipulation Pattern）
  readonly combineStacks: (stack1: ItemStack, stack2: ItemStack) => Effect.Effect<ItemStack, ItemStackError>

  readonly splitStack: (
    stack: ItemStack,
    amount: number
  ) => Effect.Effect<readonly [ItemStack, ItemStack], ItemStackError>

  // 検証・最適化（Validation Pattern）
  readonly validateItemStack: (item: ItemStack) => Effect.Effect<void, ItemValidationError>
  readonly optimizeItemStack: (item: ItemStack) => Effect.Effect<ItemStack, ItemCreationError>

  // クローン・コピー（Clone Pattern）
  readonly cloneItem: (item: ItemStack, newCount?: number) => Effect.Effect<ItemStack, ItemCreationError>
}

// Context.GenericTag による依存性注入パターン
export const ItemFactory = Context.GenericTag<ItemFactory>('@minecraft/domain/inventory/ItemFactory')

// Item Builder 設定型（Builder Pattern Support）
export interface ItemBuilderConfig {
  readonly itemId?: ItemId
  readonly count?: number
  readonly category?: ItemCategory
  readonly quality?: ItemQuality
  readonly rarity?: ItemRarity
  readonly durability?: number
  readonly maxDurability?: number
  readonly enchantments?: ReadonlyArray<EnchantmentDefinition>
  readonly customName?: string
  readonly lore?: ReadonlyArray<string>
  readonly nbtData?: Record<string, unknown>
  readonly stackable?: boolean
  readonly maxStackSize?: number
}

// Item Builder インターフェース（Fluent API Pattern）
export interface ItemBuilder {
  readonly withItemId: (itemId: ItemId) => ItemBuilder
  readonly withCount: (count: number) => ItemBuilder
  readonly withCategory: (category: ItemCategory) => ItemBuilder
  readonly withQuality: (quality: ItemQuality) => ItemBuilder
  readonly withRarity: (rarity: ItemRarity) => ItemBuilder
  readonly withDurability: (durability: number, maxDurability?: number) => ItemBuilder
  readonly withCustomName: (name: string) => ItemBuilder
  readonly withLore: (lore: ReadonlyArray<string>) => ItemBuilder
  readonly addLoreLine: (line: string) => ItemBuilder
  readonly withNBT: (nbtData: Record<string, unknown>) => ItemBuilder
  readonly withStackable: (stackable: boolean, maxStackSize?: number) => ItemBuilder
  readonly addEnchantment: (enchantment: EnchantmentDefinition) => ItemBuilder
  readonly removeEnchantment: (enchantmentId: string) => ItemBuilder
  readonly build: () => Effect.Effect<ItemStack, ItemCreationError>
  readonly validate: () => Effect.Effect<void, ItemValidationError>
  readonly reset: () => ItemBuilder
}

// Builder Factory インターフェース（Factory of Factories Pattern）
export interface ItemBuilderFactory {
  readonly create: () => ItemBuilder
  readonly fromItemStack: (item: ItemStack) => ItemBuilder
  readonly fromConfig: (config: ItemBuilderConfig) => ItemBuilder
  readonly createWithDefaults: (category: ItemCategory) => Effect.Effect<ItemBuilder, ItemCreationError>
}

export const ItemBuilderFactory = Context.GenericTag<ItemBuilderFactory>(
  '@minecraft/domain/inventory/ItemBuilderFactory'
)

// アイテムスタッキングルール（DDD Value Object）
export interface StackingRules {
  readonly canStack: (item1: ItemStack, item2: ItemStack) => boolean
  readonly maxStackSize: (item: ItemStack) => number
  readonly combineRule: (item1: ItemStack, item2: ItemStack) => 'combine' | 'separate' | 'error'
}

// デフォルトスタッキングルール
export const defaultStackingRules: StackingRules = {
  canStack: (item1, item2) =>
    item1.itemId === item2.itemId && JSON.stringify(item1.metadata) === JSON.stringify(item2.metadata),

  maxStackSize: (item) => {
    // カテゴリ別のスタックサイズ判定
    if (item.metadata?.customName) return 1 // カスタム名付きは単体
    if (item.durability !== undefined && item.durability < 1.0) return 1 // 耐久度低下は単体
    return 64 // デフォルト
  },

  combineRule: (item1, item2) => {
    if (!defaultStackingRules.canStack(item1, item2)) return 'error'
    if (item1.count + item2.count <= defaultStackingRules.maxStackSize(item1)) return 'combine'
    return 'separate'
  },
}
