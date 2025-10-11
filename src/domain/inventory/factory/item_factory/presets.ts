/**
 * ItemPresets - Predefined ItemStack Factory Presets
 *
 * Minecraftアイテムの一般的なプリセット定義
 * Function.flowパターンによる組み合わせ可能なアイテム生成関数群
 */

import { Effect, Match, pipe } from 'effect'
import type { ItemId, ItemStack } from '../../types'
import { InventoryBrandedTypes } from '../../types'
import {
  armorItemBuilder,
  blockItemBuilder,
  createItemBuilder,
  customItemBuilder,
  enchantedItemBuilder,
  foodItemBuilder,
  toolItemBuilder,
  weaponItemBuilder,
} from './builders'
import type { EnchantmentDefinition, ItemCreationError } from './interface'

// ===== 基本ツールプリセット =====

// 木製ツール
export const woodenSword = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    weaponItemBuilder(InventoryBrandedTypes.createItemId('wooden_sword'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const woodenPickaxe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('wooden_pickaxe'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const woodenAxe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('wooden_axe'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const woodenShovel = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('wooden_shovel'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const woodenHoe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('wooden_hoe'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

// 石製ツール
export const stoneSword = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    weaponItemBuilder(InventoryBrandedTypes.createItemId('stone_sword'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('common'),
    (builder) => builder.build()
  )

export const stonePickaxe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('stone_pickaxe'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('common'),
    (builder) => builder.build()
  )

export const stoneAxe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('stone_axe'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('common'),
    (builder) => builder.build()
  )

// 鉄製ツール
export const ironSword = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    weaponItemBuilder(InventoryBrandedTypes.createItemId('iron_sword'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('uncommon'),
    (builder) => builder.withRarity('uncommon'),
    (builder) => builder.build()
  )

export const ironPickaxe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('iron_pickaxe'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('uncommon'),
    (builder) => builder.withRarity('uncommon'),
    (builder) => builder.build()
  )

// ダイヤモンドツール
export const diamondSword = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    weaponItemBuilder(InventoryBrandedTypes.createItemId('diamond_sword'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('rare'),
    (builder) => builder.withRarity('rare'),
    (builder) => builder.build()
  )

export const diamondPickaxe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    toolItemBuilder(InventoryBrandedTypes.createItemId('diamond_pickaxe'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('rare'),
    (builder) => builder.withRarity('rare'),
    (builder) => builder.build()
  )

// ===== 防具プリセット =====

// 革防具セット
export const leatherHelmet = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('leather_helmet'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const leatherChestplate = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('leather_chestplate'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const leatherLeggings = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('leather_leggings'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const leatherBoots = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('leather_boots'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

// 鉄防具セット
export const ironHelmet = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('iron_helmet'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('uncommon'),
    (builder) => builder.build()
  )

export const ironChestplate = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('iron_chestplate'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('uncommon'),
    (builder) => builder.build()
  )

// ダイヤモンド防具セット
export const diamondHelmet = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('diamond_helmet'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('rare'),
    (builder) => builder.withRarity('rare'),
    (builder) => builder.build()
  )

export const diamondChestplate = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    armorItemBuilder(InventoryBrandedTypes.createItemId('diamond_chestplate'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('rare'),
    (builder) => builder.withRarity('rare'),
    (builder) => builder.build()
  )

// ===== 食料プリセット =====

export const bread = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(foodItemBuilder(InventoryBrandedTypes.createItemId('bread'), count), (builder) => builder.build())

export const cookedBeef = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(foodItemBuilder(InventoryBrandedTypes.createItemId('cooked_beef'), count), (builder) => builder.build())

export const goldenApple = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    foodItemBuilder(InventoryBrandedTypes.createItemId('golden_apple'), count),
    (builder) => builder.withQuality('rare'),
    (builder) => builder.withRarity('rare'),
    (builder) => builder.build()
  )

export const enchantedGoldenApple = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    foodItemBuilder(InventoryBrandedTypes.createItemId('enchanted_golden_apple'), count),
    (builder) => builder.withQuality('legendary'),
    (builder) => builder.withRarity('legendary'),
    (builder) => builder.withCustomName('Enchanted Golden Apple'),
    (builder) => builder.addLoreLine('Grants special effects'),
    (builder) => builder.addLoreLine('Rare and powerful'),
    (builder) => builder.build()
  )

// ===== ブロックプリセット =====

export const stone = (count = 64): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(blockItemBuilder(InventoryBrandedTypes.createItemId('stone'), count), (builder) => builder.build())

export const cobblestone = (count = 64): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(blockItemBuilder(InventoryBrandedTypes.createItemId('cobblestone'), count), (builder) => builder.build())

export const oakPlanks = (count = 64): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(blockItemBuilder(InventoryBrandedTypes.createItemId('oak_planks'), count), (builder) => builder.build())

export const glass = (count = 64): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(blockItemBuilder(InventoryBrandedTypes.createItemId('glass'), count), (builder) => builder.build())

export const dirt = (count = 64): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(blockItemBuilder(InventoryBrandedTypes.createItemId('dirt'), count), (builder) => builder.build())

// ===== エンチャント付きアイテムプリセット =====

// 効率強化エンチャント定義
const efficiencyEnchantment: EnchantmentDefinition = {
  id: 'efficiency',
  name: 'Efficiency',
  level: 3,
  maxLevel: 5,
  description: 'Increases mining speed',
}

// 耐久力エンチャント定義
const unbreakingEnchantment: EnchantmentDefinition = {
  id: 'unbreaking',
  name: 'Unbreaking',
  level: 3,
  maxLevel: 3,
  description: 'Increases tool durability',
}

// 鋭さエンチャント定義
const sharpnessEnchantment: EnchantmentDefinition = {
  id: 'sharpness',
  name: 'Sharpness',
  level: 3,
  maxLevel: 5,
  description: 'Increases weapon damage',
}

// エンチャント付きダイヤモンド剣
export const enchantedDiamondSword = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    enchantedItemBuilder(InventoryBrandedTypes.createItemId('diamond_sword'), 'weapon', [
      sharpnessEnchantment,
      unbreakingEnchantment,
    ]),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('epic'),
    (builder) => builder.withRarity('epic'),
    (builder) => builder.withCustomName('Legendary Blade'),
    (builder) => builder.addLoreLine('Forged by master smiths'),
    (builder) => builder.addLoreLine('Enchanted with ancient magic'),
    (builder) => builder.build()
  )

// エンチャント付きダイヤモンドツルハシ
export const enchantedDiamondPickaxe = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    enchantedItemBuilder(InventoryBrandedTypes.createItemId('diamond_pickaxe'), 'tool', [
      efficiencyEnchantment,
      unbreakingEnchantment,
    ]),
    (builder) => builder.withCount(count),
    (builder) => builder.withQuality('epic'),
    (builder) => builder.withRarity('epic'),
    (builder) => builder.withCustomName("Miner's Dream"),
    (builder) => builder.addLoreLine('Mines faster than every other tool'),
    (builder) => builder.build()
  )

// ===== 特殊アイテムプリセット =====

// 弓と矢セット
export const bow = (count = 1): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    weaponItemBuilder(InventoryBrandedTypes.createItemId('bow'), 1.0),
    (builder) => builder.withCount(count),
    (builder) => builder.build()
  )

export const arrow = (count = 64): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(customItemBuilder(InventoryBrandedTypes.createItemId('arrow'), 'misc', { count }), (builder) => builder.build())

// レッドストーンアイテム
export const redstone = (count = 64): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(customItemBuilder(InventoryBrandedTypes.createItemId('redstone'), 'redstone', { count }), (builder) =>
    builder.build()
  )

export const redstoneTorch = (count = 32): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(customItemBuilder(InventoryBrandedTypes.createItemId('redstone_torch'), 'redstone', { count }), (builder) =>
    builder.build()
  )

export const lever = (count = 16): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(customItemBuilder(InventoryBrandedTypes.createItemId('lever'), 'redstone', { count }), (builder) =>
    builder.build()
  )

export const button = (count = 16): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(customItemBuilder(InventoryBrandedTypes.createItemId('button'), 'redstone', { count }), (builder) =>
    builder.build()
  )

export const piston = (count = 8): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(customItemBuilder(InventoryBrandedTypes.createItemId('piston'), 'redstone', { count }), (builder) =>
    builder.build()
  )

export const stickyPiston = (count = 8): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(customItemBuilder(InventoryBrandedTypes.createItemId('sticky_piston'), 'redstone', { count }), (builder) =>
    builder.build()
  )

// ===== Function.flow組み合わせヘルパー =====

// カスタム耐久度アイテム
export const customDurabilityItem = (itemId: ItemId, category: 'tool' | 'weapon' | 'armor', durability: number) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory(category),
    (builder) => builder.withDurability(durability),
    (builder) => builder.build()
  )

// カスタムエンチャントアイテム
export const customEnchantedItem = (
  itemId: ItemId,
  category: 'tool' | 'weapon' | 'armor',
  enchantments: ReadonlyArray<EnchantmentDefinition>
) => pipe(enchantedItemBuilder(itemId, category, enchantments), (builder) => builder.build())

// ===== プリセット一覧とヘルパー関数 =====

// 利用可能なプリセット一覧
export const availableItemPresets = [
  // ツール
  'wooden_sword',
  'wooden_pickaxe',
  'wooden_axe',
  'wooden_shovel',
  'wooden_hoe',
  'stone_sword',
  'stone_pickaxe',
  'stone_axe',
  'iron_sword',
  'iron_pickaxe',
  'diamond_sword',
  'diamond_pickaxe',

  // 防具
  'leather_helmet',
  'leather_chestplate',
  'leather_leggings',
  'leather_boots',
  'iron_helmet',
  'iron_chestplate',
  'diamond_helmet',
  'diamond_chestplate',

  // 食料
  'bread',
  'cooked_beef',
  'golden_apple',
  'enchanted_golden_apple',

  // ブロック
  'stone',
  'cobblestone',
  'oak_planks',
  'glass',
  'dirt',

  // エンチャント付き
  'enchanted_diamond_sword',
  'enchanted_diamond_pickaxe',

  // 特殊
  'bow',
  'arrow',
  'redstone',
  'redstone_torch',
  'lever',
  'button',
  'piston',
  'sticky_piston',
] as const

export type ItemPresetName = (typeof availableItemPresets)[number]

// プリセット名から生成
export const createPresetItem = (
  presetName: ItemPresetName,
  count?: number
): Effect.Effect<ItemStack, ItemCreationError> =>
  pipe(
    Match.value(presetName),
    // ツール
    Match.when('wooden_sword', () => woodenSword(count)),
    Match.when('wooden_pickaxe', () => woodenPickaxe(count)),
    Match.when('wooden_axe', () => woodenAxe(count)),
    Match.when('wooden_shovel', () => woodenShovel(count)),
    Match.when('wooden_hoe', () => woodenHoe(count)),
    Match.when('stone_sword', () => stoneSword(count)),
    Match.when('stone_pickaxe', () => stonePickaxe(count)),
    Match.when('stone_axe', () => stoneAxe(count)),
    Match.when('iron_sword', () => ironSword(count)),
    Match.when('iron_pickaxe', () => ironPickaxe(count)),
    Match.when('diamond_sword', () => diamondSword(count)),
    Match.when('diamond_pickaxe', () => diamondPickaxe(count)),
    // 防具
    Match.when('leather_helmet', () => leatherHelmet(count)),
    Match.when('leather_chestplate', () => leatherChestplate(count)),
    Match.when('leather_leggings', () => leatherLeggings(count)),
    Match.when('leather_boots', () => leatherBoots(count)),
    Match.when('iron_helmet', () => ironHelmet(count)),
    Match.when('iron_chestplate', () => ironChestplate(count)),
    Match.when('diamond_helmet', () => diamondHelmet(count)),
    Match.when('diamond_chestplate', () => diamondChestplate(count)),
    // 食料
    Match.when('bread', () => bread(count)),
    Match.when('cooked_beef', () => cookedBeef(count)),
    Match.when('golden_apple', () => goldenApple(count)),
    Match.when('enchanted_golden_apple', () => enchantedGoldenApple(count)),
    // ブロック
    Match.when('stone', () => stone(count)),
    Match.when('cobblestone', () => cobblestone(count)),
    Match.when('oak_planks', () => oakPlanks(count)),
    Match.when('glass', () => glass(count)),
    Match.when('dirt', () => dirt(count)),
    // エンチャント付き
    Match.when('enchanted_diamond_sword', () => enchantedDiamondSword(count)),
    Match.when('enchanted_diamond_pickaxe', () => enchantedDiamondPickaxe(count)),
    // 特殊
    Match.when('bow', () => bow(count)),
    Match.when('arrow', () => arrow(count)),
    Match.when('redstone', () => redstone(count)),
    Match.when('redstone_torch', () => redstoneTorch(count)),
    Match.when('lever', () => lever(count)),
    Match.when('button', () => button(count)),
    Match.when('piston', () => piston(count)),
    Match.when('sticky_piston', () => stickyPiston(count)),
    // fallback
    Match.orElse(() => bread(count))
  )

// プリセット情報
export const itemPresetInfo: Record<ItemPresetName, { name: string; description: string; category: string }> = {
  // ツール
  wooden_sword: { name: 'Wooden Sword', description: 'Basic wooden sword', category: 'weapon' },
  wooden_pickaxe: { name: 'Wooden Pickaxe', description: 'Basic wooden pickaxe', category: 'tool' },
  wooden_axe: { name: 'Wooden Axe', description: 'Basic wooden axe', category: 'tool' },
  wooden_shovel: { name: 'Wooden Shovel', description: 'Basic wooden shovel', category: 'tool' },
  wooden_hoe: { name: 'Wooden Hoe', description: 'Basic wooden hoe', category: 'tool' },
  stone_sword: { name: 'Stone Sword', description: 'Improved stone sword', category: 'weapon' },
  stone_pickaxe: { name: 'Stone Pickaxe', description: 'Improved stone pickaxe', category: 'tool' },
  stone_axe: { name: 'Stone Axe', description: 'Improved stone axe', category: 'tool' },
  iron_sword: { name: 'Iron Sword', description: 'Durable iron sword', category: 'weapon' },
  iron_pickaxe: { name: 'Iron Pickaxe', description: 'Durable iron pickaxe', category: 'tool' },
  diamond_sword: { name: 'Diamond Sword', description: 'Powerful diamond sword', category: 'weapon' },
  diamond_pickaxe: { name: 'Diamond Pickaxe', description: 'Powerful diamond pickaxe', category: 'tool' },

  // 防具
  leather_helmet: { name: 'Leather Helmet', description: 'Basic leather helmet', category: 'armor' },
  leather_chestplate: { name: 'Leather Chestplate', description: 'Basic leather chestplate', category: 'armor' },
  leather_leggings: { name: 'Leather Leggings', description: 'Basic leather leggings', category: 'armor' },
  leather_boots: { name: 'Leather Boots', description: 'Basic leather boots', category: 'armor' },
  iron_helmet: { name: 'Iron Helmet', description: 'Durable iron helmet', category: 'armor' },
  iron_chestplate: { name: 'Iron Chestplate', description: 'Durable iron chestplate', category: 'armor' },
  diamond_helmet: { name: 'Diamond Helmet', description: 'Powerful diamond helmet', category: 'armor' },
  diamond_chestplate: { name: 'Diamond Chestplate', description: 'Powerful diamond chestplate', category: 'armor' },

  // 食料
  bread: { name: 'Bread', description: 'Basic food item', category: 'food' },
  cooked_beef: { name: 'Cooked Beef', description: 'Nutritious cooked meat', category: 'food' },
  golden_apple: { name: 'Golden Apple', description: 'Special healing fruit', category: 'food' },
  enchanted_golden_apple: { name: 'Enchanted Golden Apple', description: 'Legendary healing fruit', category: 'food' },

  // ブロック
  stone: { name: 'Stone', description: 'Basic building block', category: 'block' },
  cobblestone: { name: 'Cobblestone', description: 'Crafted stone block', category: 'block' },
  oak_planks: { name: 'Oak Planks', description: 'Wooden building material', category: 'block' },
  glass: { name: 'Glass', description: 'Transparent building block', category: 'block' },
  dirt: { name: 'Dirt', description: 'Common earth block', category: 'block' },

  // エンチャント付き
  enchanted_diamond_sword: {
    name: 'Enchanted Diamond Sword',
    description: 'Legendary enchanted blade',
    category: 'weapon',
  },
  enchanted_diamond_pickaxe: {
    name: 'Enchanted Diamond Pickaxe',
    description: 'Legendary mining tool',
    category: 'tool',
  },

  // 特殊
  bow: { name: 'Bow', description: 'Ranged weapon', category: 'weapon' },
  arrow: { name: 'Arrow', description: 'Bow ammunition', category: 'misc' },
  redstone: { name: 'Redstone', description: 'Electronic component', category: 'redstone' },
  redstone_torch: { name: 'Redstone Torch', description: 'Redstone power source', category: 'redstone' },
  lever: { name: 'Lever', description: 'Redstone switch', category: 'redstone' },
  button: { name: 'Button', description: 'Redstone button', category: 'redstone' },
  piston: { name: 'Piston', description: 'Redstone mechanical device', category: 'redstone' },
  sticky_piston: { name: 'Sticky Piston', description: 'Advanced redstone mechanical device', category: 'redstone' },
}
