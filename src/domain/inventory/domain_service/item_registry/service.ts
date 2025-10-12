/**
 * Item Registry Domain Service
 *
 * アイテム定義の管理サービス。
 * アイテムプロパティ、制約、カテゴリなどのメタ情報を提供し、
 * アイテムに関する複雑なビジネスルールを統合管理します。
 */

import { Context, Effect } from 'effect'
import type { ItemId } from '../../types'

// =============================================================================
// Item Registry Service Types
// =============================================================================

/**
 * アイテム定義
 */
export interface ItemDefinition {
  readonly itemId: ItemId
  readonly displayName: string
  readonly category: ItemCategory
  readonly properties: ItemProperties
  readonly constraints: ItemConstraints
  readonly metadata: ItemDefinitionMetadata
}

/**
 * アイテムカテゴリ
 */
export type ItemCategory =
  | 'TOOL'
  | 'WEAPON'
  | 'ARMOR'
  | 'FOOD'
  | 'BUILDING_BLOCK'
  | 'DECORATIVE'
  | 'REDSTONE'
  | 'TRANSPORTATION'
  | 'MISCELLANEOUS'

/**
 * アイテムプロパティ
 */
export interface ItemProperties {
  readonly maxStackSize: number
  readonly durability?: {
    readonly maxDurability: number
    readonly repairMaterials: ReadonlyArray<ItemId>
  }
  readonly enchantable: boolean
  readonly rarity: ItemRarity
  readonly fireResistant: boolean
  readonly edible?: EdibleProperties
  readonly fuel?: FuelProperties
}

/**
 * アイテム制約
 */
export interface ItemConstraints {
  readonly stackingRules: StackingRules
  readonly usageRestrictions: ReadonlyArray<UsageRestriction>
  readonly storageRequirements?: StorageRequirements
}

/**
 * アイテムレアリティ
 */
export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'

/**
 * 食べ物プロパティ
 */
export interface EdibleProperties {
  readonly hungerValue: number
  readonly saturationValue: number
  readonly effects?: ReadonlyArray<{
    readonly effectId: string
    readonly duration: number
    readonly amplifier: number
  }>
}

/**
 * 燃料プロパティ
 */
export interface FuelProperties {
  readonly burnTime: number
  readonly efficiency: number
}

/**
 * スタッキングルール
 */
export interface StackingRules {
  readonly allowStacking: boolean
  readonly requiresIdenticalMetadata: boolean
  readonly maxStackSize?: number
  readonly specialRules?: ReadonlyArray<string>
}

/**
 * 使用制限
 */
export interface UsageRestriction {
  readonly type: 'DIMENSION' | 'BIOME' | 'TIME' | 'GAMEMODE' | 'PERMISSION'
  readonly condition: string
  readonly message: string
}

/**
 * 保存要件
 */
export interface StorageRequirements {
  readonly requiresSpecialContainer: boolean
  readonly containerTypes: ReadonlyArray<string>
  readonly environmentalNeeds?: ReadonlyArray<string>
}

/**
 * アイテム定義メタデータ
 */
export interface ItemDefinitionMetadata {
  readonly version: string
  readonly lastUpdated: number
  readonly tags: ReadonlyArray<string>
  readonly description?: string
  readonly craftingRecipes: ReadonlyArray<string>
}

// =============================================================================
// Domain Errors
// =============================================================================

export const ItemRegistryErrorSchema = Schema.TaggedStruct('ItemRegistryError', {
  reason: Schema.String,
  itemId: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Item Registry Error',
    description: 'Error when item registry operation fails',
  })
)
export type ItemRegistryError = Schema.Schema.Type<typeof ItemRegistryErrorSchema>

/**
 * ItemRegistryErrorのメッセージを取得する操作関数
 */
export const getItemRegistryErrorMessage = (error: ItemRegistryError): string =>
  error.itemId ? `${error.reason} (itemId: ${error.itemId})` : error.reason

/**
 * ItemRegistryErrorを作成するFactory関数
 */
export const createItemRegistryError = (
  reason: string,
  itemId?: ItemId
): Effect.Effect<ItemRegistryError, Schema.ParseError> =>
  Schema.decode(ItemRegistryErrorSchema)({
    _tag: 'ItemRegistryError' as const,
    reason,
    itemId,
  })

/**
 * 型ガード関数
 */
export const isItemRegistryError = (error: unknown): error is ItemRegistryError =>
  Schema.is(ItemRegistryErrorSchema)(error)

// =============================================================================
// Item Registry Service Interface
// =============================================================================

/**
 * アイテムレジストリドメインサービス
 *
 * ゲーム内の全アイテムの定義とメタデータを管理するサービス。
 * アイテムの種類、プロパティ、制約などを統合的に提供。
 *
 * 責務:
 * - アイテム定義の登録・取得・更新
 * - アイテムプロパティの照会
 * - カテゴリ別アイテム検索
 * - アイテム互換性チェック
 * - 動的アイテム属性計算
 */
export interface ItemRegistryService {
  /**
   * アイテム定義取得
   */
  readonly getItemDefinition: (itemId: ItemId) => Effect.Effect<ItemDefinition, ItemRegistryError>

  /**
   * 全アイテム定義取得
   */
  readonly getAllItemDefinitions: () => Effect.Effect<ReadonlyArray<ItemDefinition>, never>

  /**
   * カテゴリ別アイテム検索
   */
  readonly getItemsByCategory: (category: ItemCategory) => Effect.Effect<ReadonlyArray<ItemDefinition>, never>

  /**
   * アイテム検索
   */
  readonly searchItems: (criteria: {
    readonly namePattern?: string
    readonly category?: ItemCategory
    readonly tags?: ReadonlyArray<string>
    readonly properties?: Partial<ItemProperties>
  }) => Effect.Effect<ReadonlyArray<ItemDefinition>, never>

  /**
   * アイテム互換性チェック
   */
  readonly checkCompatibility: (
    sourceItemId: ItemId,
    targetItemId: ItemId
  ) => Effect.Effect<
    {
      readonly compatible: boolean
      readonly reasons: ReadonlyArray<string>
    },
    ItemRegistryError
  >

  /**
   * スタック制限取得
   */
  readonly getStackLimit: (itemId: ItemId) => Effect.Effect<number, ItemRegistryError>

  /**
   * アイテム存在確認
   */
  readonly exists: (itemId: ItemId) => Effect.Effect<boolean, never>
}

// =============================================================================
// Service Tag Definition
// =============================================================================

export const ItemRegistryService = Context.GenericTag<ItemRegistryService>(
  '@minecraft/domain/inventory/ItemRegistryService'
)

// =============================================================================
// Type Exports
// =============================================================================

export type {
  EdibleProperties,
  FuelProperties,
  ItemCategory,
  ItemConstraints,
  ItemDefinition,
  ItemDefinitionMetadata,
  ItemProperties,
  ItemRarity,
  StackingRules,
  StorageRequirements,
  UsageRestriction,
}
