/**
 * ContainerPresets - Predefined Container Factory Presets
 *
 * Minecraftコンテナシステムの一般的なプリセット定義
 * Function.flowパターンによる組み合わせ可能なコンテナ生成関数群
 */

import { Effect, pipe } from 'effect'
import type { Container } from '../../types'
import { InventoryBrandedTypes } from '../../types'
import {
  brewingStandContainerBuilder,
  chestContainerBuilder,
  craftingTableContainerBuilder,
  createContainerBuilder,
  furnaceContainerBuilder,
  hopperContainerBuilder,
  ownedContainerBuilder,
  positionedContainerBuilder,
  shulkerBoxContainerBuilder,
} from './builders'
import type { ContainerCreationError } from './interface'

// ===== 基本ストレージコンテナプリセット =====

// 標準チェスト
export const standardChest = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(chestContainerBuilder(id, 'small'), (builder) => builder.build())

// ダブルチェスト
export const doubleChest = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(chestContainerBuilder(id, 'large'), (builder) => builder.build())

// エンダーチェスト（プライベート）
export const enderChest = (id: string, owner: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(ownedContainerBuilder(id, 'ender_chest', owner, true), (builder) => builder.build())

// バレル
export const barrel = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('barrel'),
    (builder) => builder.build()
  )

// シュルカーボックス（色付き）
export const coloredShulkerBox = (id: string, color: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(shulkerBoxContainerBuilder(id, color), (builder) => builder.build())

// ===== 製作・加工コンテナプリセット =====

// 溶鉱炉（通常）
export const standardFurnace = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(furnaceContainerBuilder(id, 'furnace'), (builder) => builder.build())

// 高炉
export const blastFurnace = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(furnaceContainerBuilder(id, 'blast_furnace'), (builder) => builder.build())

// 燻製器
export const smoker = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(furnaceContainerBuilder(id, 'smoker'), (builder) => builder.build())

// 醸造台
export const brewingStand = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(brewingStandContainerBuilder(id), (builder) => builder.build())

// 作業台
export const craftingTable = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(craftingTableContainerBuilder(id), (builder) => builder.build())

// エンチャントテーブル
export const enchantingTable = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('enchanting_table'),
    (builder) => builder.build()
  )

// 金床
export const anvil = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('anvil'),
    (builder) => builder.build()
  )

// 砥石
export const grindstone = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('grindstone'),
    (builder) => builder.build()
  )

// ===== 自動化・レッドストーンコンテナプリセット =====

// ホッパー
export const hopper = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(hopperContainerBuilder(id), (builder) => builder.build())

// ドロッパー
export const dropper = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('dropper'),
    (builder) => builder.build()
  )

// ディスペンサー
export const dispenser = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('dispenser'),
    (builder) => builder.build()
  )

// ===== 特殊用途コンテナプリセット =====

// 燃料付き溶鉱炉（石炭8個）
export const fueledFurnace = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    furnaceContainerBuilder(id, 'furnace'),
    (builder) =>
      builder.addItem(1, {
        itemId: InventoryBrandedTypes.createItemId('coal'),
        count: 8,
      }),
    (builder) => builder.build()
  )

// アイテム付きチェスト（基本ツール）
export const starterToolChest = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    chestContainerBuilder(id, 'small'),
    (builder) =>
      builder
        .addItem(0, {
          itemId: InventoryBrandedTypes.createItemId('wooden_pickaxe'),
          count: 1,
          durability: 1.0,
        })
        .addItem(1, {
          itemId: InventoryBrandedTypes.createItemId('wooden_axe'),
          count: 1,
          durability: 1.0,
        })
        .addItem(2, {
          itemId: InventoryBrandedTypes.createItemId('wooden_shovel'),
          count: 1,
          durability: 1.0,
        })
        .addItem(9, {
          itemId: InventoryBrandedTypes.createItemId('bread'),
          count: 16,
        }),
    (builder) => builder.build()
  )

// 建築材料チェスト
export const buildingMaterialChest = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    chestContainerBuilder(id, 'large'),
    (builder) =>
      builder
        .addItem(0, {
          itemId: InventoryBrandedTypes.createItemId('stone'),
          count: 64,
        })
        .addItem(1, {
          itemId: InventoryBrandedTypes.createItemId('cobblestone'),
          count: 64,
        })
        .addItem(2, {
          itemId: InventoryBrandedTypes.createItemId('oak_planks'),
          count: 64,
        })
        .addItem(9, {
          itemId: InventoryBrandedTypes.createItemId('glass'),
          count: 64,
        })
        .addItem(18, {
          itemId: InventoryBrandedTypes.createItemId('dirt'),
          count: 64,
        }),
    (builder) => builder.build()
  )

// レッドストーン回路チェスト
export const redstoneCircuitChest = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    chestContainerBuilder(id, 'small'),
    (builder) =>
      builder
        .addItem(0, {
          itemId: InventoryBrandedTypes.createItemId('redstone'),
          count: 64,
        })
        .addItem(1, {
          itemId: InventoryBrandedTypes.createItemId('redstone_torch'),
          count: 32,
        })
        .addItem(2, {
          itemId: InventoryBrandedTypes.createItemId('lever'),
          count: 16,
        })
        .addItem(3, {
          itemId: InventoryBrandedTypes.createItemId('button'),
          count: 16,
        })
        .addItem(9, {
          itemId: InventoryBrandedTypes.createItemId('piston'),
          count: 8,
        })
        .addItem(10, {
          itemId: InventoryBrandedTypes.createItemId('sticky_piston'),
          count: 8,
        }),
    (builder) => builder.build()
  )

// ===== 位置ベースコンテナプリセット =====

// 位置付きチェスト
export const positionedChest = (
  id: string,
  x: number,
  y: number,
  z: number
): Effect.Effect<Container, ContainerCreationError> =>
  pipe(positionedContainerBuilder(id, 'chest', x, y, z), (builder) => builder.build())

// 位置付き溶鉱炉
export const positionedFurnace = (
  id: string,
  x: number,
  y: number,
  z: number
): Effect.Effect<Container, ContainerCreationError> =>
  pipe(positionedContainerBuilder(id, 'furnace', x, y, z), (builder) => builder.build())

// ===== オーナーシップ付きコンテナプリセット =====

// プライベートチェスト（オーナー専用）
export const privateChest = (id: string, owner: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(ownedContainerBuilder(id, 'chest', owner, true), (builder) => builder.build())

// 共有チェスト（オーナー指定だが公開）
export const sharedChest = (id: string, owner: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(ownedContainerBuilder(id, 'chest', owner, false), (builder) => builder.build())

// ロック付きチェスト
export const lockedChest = (id: string, lockKey: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType('chest'),
    (builder) => builder.withLock(true, lockKey),
    (builder) => builder.build()
  )

// ===== 専門用途コンテナプリセット =====

// 鉱石精錬システム（溶鉱炉 + ホッパー構成）
export const oreSmeltingFurnace = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    furnaceContainerBuilder(id, 'blast_furnace'),
    (builder) =>
      builder
        .addItem(1, {
          itemId: InventoryBrandedTypes.createItemId('coal'),
          count: 16,
        })
        .withName('Ore Smelting Station'),
    (builder) => builder.build()
  )

// 食料調理システム（燻製器）
export const foodCookingSmoker = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    furnaceContainerBuilder(id, 'smoker'),
    (builder) =>
      builder
        .addItem(1, {
          itemId: InventoryBrandedTypes.createItemId('coal'),
          count: 8,
        })
        .withName('Food Cooking Station'),
    (builder) => builder.build()
  )

// ポーション醸造システム
export const potionBrewingStand = (id: string): Effect.Effect<Container, ContainerCreationError> =>
  pipe(
    brewingStandContainerBuilder(id),
    (builder) => builder.withName('Potion Brewing Station').withMetadata({ brewingTime: 0, isActive: false }),
    (builder) => builder.build()
  )

// ===== Function.flow組み合わせヘルパー =====

// カスタム権限付きコンテナ
export const customPermissionContainer = (
  id: string,
  type: 'chest' | 'barrel',
  permissions: {
    canInsert?: boolean
    canExtract?: boolean
    canView?: boolean
    restrictedToOwner?: boolean
  }
) =>
  pipe(
    createContainerBuilder(),
    (builder) => builder.withId(id),
    (builder) => builder.withType(type),
    (builder) => builder.withPermissions(permissions),
    (builder) => builder.build()
  )

// ===== プリセット一覧とヘルパー関数 =====

// 利用可能なコンテナプリセット一覧
export const availableContainerPresets = [
  // 基本ストレージ
  'standard_chest',
  'double_chest',
  'ender_chest',
  'barrel',
  'colored_shulker_box',

  // 製作・加工
  'standard_furnace',
  'blast_furnace',
  'smoker',
  'brewing_stand',
  'crafting_table',
  'enchanting_table',
  'anvil',
  'grindstone',

  // 自動化・レッドストーン
  'hopper',
  'dropper',
  'dispenser',

  // 特殊用途
  'fueled_furnace',
  'starter_tool_chest',
  'building_material_chest',
  'redstone_circuit_chest',

  // オーナーシップ
  'private_chest',
  'shared_chest',
  'locked_chest',

  // 専門用途
  'ore_smelting_furnace',
  'food_cooking_smoker',
  'potion_brewing_stand',
] as const

export type ContainerPresetName = (typeof availableContainerPresets)[number]

// プリセット名から生成
export const createPresetContainer = (
  presetName: ContainerPresetName,
  id: string,
  ...args: any[]
): Effect.Effect<Container, ContainerCreationError> => {
  switch (presetName) {
    // 基本ストレージ
    case 'standard_chest':
      return standardChest(id)
    case 'double_chest':
      return doubleChest(id)
    case 'ender_chest':
      return enderChest(id, args[0] || 'player')
    case 'barrel':
      return barrel(id)
    case 'colored_shulker_box':
      return coloredShulkerBox(id, args[0] || 'white')

    // 製作・加工
    case 'standard_furnace':
      return standardFurnace(id)
    case 'blast_furnace':
      return blastFurnace(id)
    case 'smoker':
      return smoker(id)
    case 'brewing_stand':
      return brewingStand(id)
    case 'crafting_table':
      return craftingTable(id)
    case 'enchanting_table':
      return enchantingTable(id)
    case 'anvil':
      return anvil(id)
    case 'grindstone':
      return grindstone(id)

    // 自動化・レッドストーン
    case 'hopper':
      return hopper(id)
    case 'dropper':
      return dropper(id)
    case 'dispenser':
      return dispenser(id)

    // 特殊用途
    case 'fueled_furnace':
      return fueledFurnace(id)
    case 'starter_tool_chest':
      return starterToolChest(id)
    case 'building_material_chest':
      return buildingMaterialChest(id)
    case 'redstone_circuit_chest':
      return redstoneCircuitChest(id)

    // オーナーシップ
    case 'private_chest':
      return privateChest(id, args[0] || 'player')
    case 'shared_chest':
      return sharedChest(id, args[0] || 'player')
    case 'locked_chest':
      return lockedChest(id, args[0] || 'default_key')

    // 専門用途
    case 'ore_smelting_furnace':
      return oreSmeltingFurnace(id)
    case 'food_cooking_smoker':
      return foodCookingSmoker(id)
    case 'potion_brewing_stand':
      return potionBrewingStand(id)

    default:
      return standardChest(id) // fallback
  }
}

// プリセット情報
export const containerPresetInfo: Record<
  ContainerPresetName,
  {
    name: string
    description: string
    type: string
    slotCount: number
    requiresArgs?: string[]
  }
> = {
  // 基本ストレージ
  standard_chest: {
    name: 'Standard Chest',
    description: 'Basic 27-slot storage container',
    type: 'chest',
    slotCount: 27,
  },
  double_chest: {
    name: 'Double Chest',
    description: 'Large 54-slot storage container',
    type: 'large_chest',
    slotCount: 54,
  },
  ender_chest: {
    name: 'Ender Chest',
    description: 'Personal storage accessible anywhere',
    type: 'ender_chest',
    slotCount: 27,
    requiresArgs: ['owner'],
  },
  barrel: {
    name: 'Barrel',
    description: 'Alternative 27-slot storage container',
    type: 'barrel',
    slotCount: 27,
  },
  colored_shulker_box: {
    name: 'Colored Shulker Box',
    description: 'Portable 27-slot storage with color',
    type: 'shulker_box',
    slotCount: 27,
    requiresArgs: ['color'],
  },

  // 製作・加工
  standard_furnace: {
    name: 'Standard Furnace',
    description: 'Basic smelting and cooking',
    type: 'furnace',
    slotCount: 3,
  },
  blast_furnace: {
    name: 'Blast Furnace',
    description: 'Fast ore smelting',
    type: 'blast_furnace',
    slotCount: 3,
  },
  smoker: {
    name: 'Smoker',
    description: 'Fast food cooking',
    type: 'smoker',
    slotCount: 3,
  },
  brewing_stand: {
    name: 'Brewing Stand',
    description: 'Potion brewing system',
    type: 'brewing_stand',
    slotCount: 4,
  },
  crafting_table: {
    name: 'Crafting Table',
    description: '3x3 crafting grid',
    type: 'crafting_table',
    slotCount: 10,
  },
  enchanting_table: {
    name: 'Enchanting Table',
    description: 'Item enchantment system',
    type: 'enchanting_table',
    slotCount: 2,
  },
  anvil: {
    name: 'Anvil',
    description: 'Item repair and combination',
    type: 'anvil',
    slotCount: 3,
  },
  grindstone: {
    name: 'Grindstone',
    description: 'Remove enchantments and repair',
    type: 'grindstone',
    slotCount: 3,
  },

  // 自動化・レッドストーン
  hopper: {
    name: 'Hopper',
    description: 'Automatic item transport',
    type: 'hopper',
    slotCount: 5,
  },
  dropper: {
    name: 'Dropper',
    description: 'Item dropping mechanism',
    type: 'dropper',
    slotCount: 9,
  },
  dispenser: {
    name: 'Dispenser',
    description: 'Item dispensing mechanism',
    type: 'dispenser',
    slotCount: 9,
  },

  // 特殊用途
  fueled_furnace: {
    name: 'Fueled Furnace',
    description: 'Furnace pre-loaded with fuel',
    type: 'furnace',
    slotCount: 3,
  },
  starter_tool_chest: {
    name: 'Starter Tool Chest',
    description: 'Chest with basic tools and food',
    type: 'chest',
    slotCount: 27,
  },
  building_material_chest: {
    name: 'Building Material Chest',
    description: 'Large chest with building blocks',
    type: 'large_chest',
    slotCount: 54,
  },
  redstone_circuit_chest: {
    name: 'Redstone Circuit Chest',
    description: 'Chest with redstone components',
    type: 'chest',
    slotCount: 27,
  },

  // オーナーシップ
  private_chest: {
    name: 'Private Chest',
    description: 'Owner-only access chest',
    type: 'chest',
    slotCount: 27,
    requiresArgs: ['owner'],
  },
  shared_chest: {
    name: 'Shared Chest',
    description: 'Named but public access chest',
    type: 'chest',
    slotCount: 27,
    requiresArgs: ['owner'],
  },
  locked_chest: {
    name: 'Locked Chest',
    description: 'Key-protected chest',
    type: 'chest',
    slotCount: 27,
    requiresArgs: ['lockKey'],
  },

  // 専門用途
  ore_smelting_furnace: {
    name: 'Ore Smelting Furnace',
    description: 'Blast furnace for ore processing',
    type: 'blast_furnace',
    slotCount: 3,
  },
  food_cooking_smoker: {
    name: 'Food Cooking Smoker',
    description: 'Smoker for food preparation',
    type: 'smoker',
    slotCount: 3,
  },
  potion_brewing_stand: {
    name: 'Potion Brewing Stand',
    description: 'Complete brewing station setup',
    type: 'brewing_stand',
    slotCount: 4,
  },
}
