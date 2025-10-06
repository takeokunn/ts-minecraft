/**
 * Item Registry Definitions
 *
 * 実際のアイテム定義とデフォルトレジストリ。
 * Minecraftの標準アイテムを中心とした定義を提供します。
 */

import { Effect } from 'effect'
import type { ItemId } from '../../types'
import type { ItemCategory, ItemDefinition } from './index'

// =============================================================================
// Default Item Definitions
// =============================================================================

/**
 * デフォルトアイテム定義のマップ
 */
const DEFAULT_ITEM_DEFINITIONS = new Map<ItemId, ItemDefinition>([
  // ツール系
  [
    'minecraft:diamond_pickaxe' as ItemId,
    {
      itemId: 'minecraft:diamond_pickaxe' as ItemId,
      displayName: 'Diamond Pickaxe',
      category: 'TOOL' as ItemCategory,
      properties: {
        maxStackSize: 1,
        durability: {
          maxDurability: 1561,
          repairMaterials: ['minecraft:diamond' as ItemId],
        },
        enchantable: true,
        rarity: 'RARE',
        fireResistant: false,
      },
      constraints: {
        stackingRules: {
          allowStacking: false,
          requiresIdenticalMetadata: true,
        },
        usageRestrictions: [],
      },
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        tags: ['tool', 'pickaxe', 'diamond'],
        description: 'A durable pickaxe made of diamond',
        craftingRecipes: ['diamond_pickaxe_recipe'],
      },
    },
  ],

  // 武器系
  [
    'minecraft:diamond_sword' as ItemId,
    {
      itemId: 'minecraft:diamond_sword' as ItemId,
      displayName: 'Diamond Sword',
      category: 'WEAPON' as ItemCategory,
      properties: {
        maxStackSize: 1,
        durability: {
          maxDurability: 1561,
          repairMaterials: ['minecraft:diamond' as ItemId],
        },
        enchantable: true,
        rarity: 'RARE',
        fireResistant: false,
      },
      constraints: {
        stackingRules: {
          allowStacking: false,
          requiresIdenticalMetadata: true,
        },
        usageRestrictions: [],
      },
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        tags: ['weapon', 'sword', 'diamond'],
        description: 'A sharp sword made of diamond',
        craftingRecipes: ['diamond_sword_recipe'],
      },
    },
  ],

  // 食べ物系
  [
    'minecraft:bread' as ItemId,
    {
      itemId: 'minecraft:bread' as ItemId,
      displayName: 'Bread',
      category: 'FOOD' as ItemCategory,
      properties: {
        maxStackSize: 64,
        enchantable: false,
        rarity: 'COMMON',
        fireResistant: false,
        edible: {
          hungerValue: 5,
          saturationValue: 6.0,
        },
      },
      constraints: {
        stackingRules: {
          allowStacking: true,
          requiresIdenticalMetadata: false,
        },
        usageRestrictions: [],
      },
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        tags: ['food', 'bread'],
        description: 'Nutritious bread that restores hunger',
        craftingRecipes: ['bread_recipe'],
      },
    },
  ],

  // ブロック系
  [
    'minecraft:cobblestone' as ItemId,
    {
      itemId: 'minecraft:cobblestone' as ItemId,
      displayName: 'Cobblestone',
      category: 'BUILDING_BLOCK' as ItemCategory,
      properties: {
        maxStackSize: 64,
        enchantable: false,
        rarity: 'COMMON',
        fireResistant: true,
      },
      constraints: {
        stackingRules: {
          allowStacking: true,
          requiresIdenticalMetadata: false,
        },
        usageRestrictions: [],
      },
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        tags: ['block', 'building', 'stone'],
        description: 'Common building block',
        craftingRecipes: [],
      },
    },
  ],

  // 燃料系
  [
    'minecraft:coal' as ItemId,
    {
      itemId: 'minecraft:coal' as ItemId,
      displayName: 'Coal',
      category: 'MISCELLANEOUS' as ItemCategory,
      properties: {
        maxStackSize: 64,
        enchantable: false,
        rarity: 'COMMON',
        fireResistant: false,
        fuel: {
          burnTime: 1600, // 80秒
          efficiency: 1.0,
        },
      },
      constraints: {
        stackingRules: {
          allowStacking: true,
          requiresIdenticalMetadata: false,
        },
        usageRestrictions: [],
      },
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        tags: ['fuel', 'mining'],
        description: 'Common fuel source',
        craftingRecipes: [],
      },
    },
  ],
])

// =============================================================================
// Registry Access Functions
// =============================================================================

/**
 * デフォルトアイテム定義を取得
 */
export const getDefaultItemDefinition = (itemId: ItemId): Effect.Effect<ItemDefinition | undefined, never> =>
  Effect.gen(function* () {
    return DEFAULT_ITEM_DEFINITIONS.get(itemId)
  })

/**
 * 全デフォルトアイテム定義を取得
 */
export const getAllDefaultItemDefinitions = (): Effect.Effect<ReadonlyArray<ItemDefinition>, never> =>
  Effect.gen(function* () {
    return Array.from(DEFAULT_ITEM_DEFINITIONS.values())
  })

/**
 * カテゴリ別アイテム定義を取得
 */
export const getDefaultItemsByCategory = (
  category: ItemCategory
): Effect.Effect<ReadonlyArray<ItemDefinition>, never> =>
  Effect.gen(function* () {
    const allItems = Array.from(DEFAULT_ITEM_DEFINITIONS.values())
    return allItems.filter((item) => item.category === category)
  })

/**
 * アイテムが存在するかチェック
 */
export const itemExists = (itemId: ItemId): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    return DEFAULT_ITEM_DEFINITIONS.has(itemId)
  })

/**
 * スタック制限を取得
 */
export const getItemStackLimit = (itemId: ItemId): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    const definition = DEFAULT_ITEM_DEFINITIONS.get(itemId)
    return definition?.properties.maxStackSize ?? 64
  })

/**
 * アイテムが食べ物かチェック
 */
export const isEdible = (itemId: ItemId): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const definition = DEFAULT_ITEM_DEFINITIONS.get(itemId)
    return definition?.properties.edible !== undefined
  })

/**
 * アイテムが燃料かチェック
 */
export const isFuel = (itemId: ItemId): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const definition = DEFAULT_ITEM_DEFINITIONS.get(itemId)
    return definition?.properties.fuel !== undefined
  })

/**
 * アイテムがエンチャント可能かチェック
 */
export const isEnchantable = (itemId: ItemId): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const definition = DEFAULT_ITEM_DEFINITIONS.get(itemId)
    return definition?.properties.enchantable ?? false
  })

/**
 * アイテムのレアリティを取得
 */
export const getItemRarity = (itemId: ItemId): Effect.Effect<string, never> =>
  Effect.gen(function* () {
    const definition = DEFAULT_ITEM_DEFINITIONS.get(itemId)
    return definition?.properties.rarity ?? 'COMMON'
  })

// =============================================================================
// Dynamic Definition Helpers
// =============================================================================

/**
 * 動的アイテム定義の作成
 */
export const createDynamicItemDefinition = (
  itemId: ItemId,
  overrides: Partial<ItemDefinition>
): Effect.Effect<ItemDefinition, never> =>
  Effect.gen(function* () {
    const baseDefinition: ItemDefinition = {
      itemId,
      displayName: itemId,
      category: 'MISCELLANEOUS',
      properties: {
        maxStackSize: 64,
        enchantable: false,
        rarity: 'COMMON',
        fireResistant: false,
      },
      constraints: {
        stackingRules: {
          allowStacking: true,
          requiresIdenticalMetadata: false,
        },
        usageRestrictions: [],
      },
      metadata: {
        version: '1.0.0',
        lastUpdated: Date.now(),
        tags: [],
        craftingRecipes: [],
      },
    }

    return { ...baseDefinition, ...overrides }
  })

/**
 * アイテム検索（名前・タグ・カテゴリ）
 */
export const searchDefaultItems = (criteria: {
  readonly namePattern?: string
  readonly category?: ItemCategory
  readonly tags?: ReadonlyArray<string>
}): Effect.Effect<ReadonlyArray<ItemDefinition>, never> =>
  Effect.gen(function* () {
    const allItems = Array.from(DEFAULT_ITEM_DEFINITIONS.values())

    return allItems.filter((item) => {
      // カテゴリフィルタ
      if (criteria.category && item.category !== criteria.category) {
        return false
      }

      // 名前パターンフィルタ
      if (criteria.namePattern) {
        const pattern = new RegExp(criteria.namePattern, 'i')
        if (!pattern.test(item.displayName) && !pattern.test(item.itemId)) {
          return false
        }
      }

      // タグフィルタ
      if (criteria.tags && criteria.tags.length > 0) {
        const hasMatchingTag = criteria.tags.some((tag) => item.metadata.tags.includes(tag))
        if (!hasMatchingTag) {
          return false
        }
      }

      return true
    })
  })
