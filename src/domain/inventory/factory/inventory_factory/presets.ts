/**
 * InventoryPresets - Predefined Inventory Factory Presets
 *
 * MinecraftゲームモードやUse Caseに特化したInventoryプリセット
 * Function.flowパターンによる組み合わせ可能なプリセット関数群
 */

import { Effect, pipe } from 'effect'
import type { Inventory, ItemStack, PlayerId } from '../../types'
import { InventoryBrandedTypes } from '../../types'
import {
  creativeInventoryBuilder,
  customInventoryBuilder,
  playerInventoryBuilder,
  survivalInventoryBuilder,
} from './builders'
import type { InventoryCreationError, InventoryType } from './interface'

// ===== 基本ゲームモードプリセット =====

// スタンダードプレイヤーインベントリー
export const standardPlayerInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> =>
  pipe(playerInventoryBuilder(playerId), (builder) => builder.build())

// クリエイティブモードインベントリー（拡張スロット）
export const creativeInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> =>
  pipe(
    creativeInventoryBuilder(playerId),
    (builder) => builder.withSlotCount(45), // 追加スロット
    (builder) => builder.build()
  )

// サバイバルモードインベントリー（標準）
export const survivalInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> =>
  pipe(survivalInventoryBuilder(playerId), (builder) => builder.build())

// スペクテイターモードインベントリー（アイテム保持不可）
export const spectatorInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> =>
  pipe(
    customInventoryBuilder(playerId, 'spectator', {
      slotCount: 0,
      enableHotbar: false,
      enableArmor: false,
      enableOffhand: false,
      permissions: {
        canAddItems: false,
        canRemoveItems: false,
        canModifyArmor: false,
        canUseHotbar: false,
        canUseOffhand: false,
      },
    }),
    (builder) => builder.build()
  )

// アドベンチャーモードインベントリー（装備変更制限）
export const adventureInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> =>
  pipe(
    customInventoryBuilder(playerId, 'adventure', {
      permissions: {
        canAddItems: true,
        canRemoveItems: true,
        canModifyArmor: false, // 装備変更不可
        canUseHotbar: true,
        canUseOffhand: true,
      },
    }),
    (builder) => builder.build()
  )

// ===== 特殊用途プリセット =====

// 新規プレイヤー用初期インベントリー（基本ツール付き）
export const newPlayerInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> => {
  const starterItems: ReadonlyArray<ItemStack> = [
    {
      itemId: InventoryBrandedTypes.createItemId('wooden_sword'),
      count: 1,
      durability: 1.0,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('wooden_pickaxe'),
      count: 1,
      durability: 1.0,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('wooden_axe'),
      count: 1,
      durability: 1.0,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('bread'),
      count: 5,
    },
  ]

  return pipe(
    playerInventoryBuilder(playerId),
    (builder) => builder.withStartingItems(starterItems),
    (builder) => builder.build()
  )
}

// PvPアリーナ用インベントリー（戦闘装備付き）
export const pvpArenaInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> => {
  const pvpItems: ReadonlyArray<ItemStack> = [
    {
      itemId: InventoryBrandedTypes.createItemId('iron_sword'),
      count: 1,
      durability: 1.0,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('bow'),
      count: 1,
      durability: 1.0,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('arrow'),
      count: 64,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('cooked_beef'),
      count: 32,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('golden_apple'),
      count: 3,
    },
  ]

  return pipe(
    survivalInventoryBuilder(playerId),
    (builder) => builder.withStartingItems(pvpItems),
    (builder) => builder.build()
  )
}

// ビルディング用インベントリー（建築ブロック大量）
export const buildingInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> => {
  const buildingItems: ReadonlyArray<ItemStack> = [
    {
      itemId: InventoryBrandedTypes.createItemId('stone'),
      count: 64,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('oak_planks'),
      count: 64,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('cobblestone'),
      count: 64,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('glass'),
      count: 64,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('dirt'),
      count: 64,
    },
  ]

  return pipe(
    creativeInventoryBuilder(playerId),
    (builder) => builder.withSlotCount(45),
    (builder) => builder.withStartingItems(buildingItems),
    (builder) => builder.build()
  )
}

// レッドストーン回路用インベントリー（電子部品中心）
export const redstoneInventory = (playerId: PlayerId): Effect.Effect<Inventory, InventoryCreationError> => {
  const redstoneItems: ReadonlyArray<ItemStack> = [
    {
      itemId: InventoryBrandedTypes.createItemId('redstone'),
      count: 64,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('redstone_torch'),
      count: 32,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('lever'),
      count: 16,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('button'),
      count: 16,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('pressure_plate'),
      count: 8,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('piston'),
      count: 8,
    },
    {
      itemId: InventoryBrandedTypes.createItemId('sticky_piston'),
      count: 8,
    },
  ]

  return pipe(
    creativeInventoryBuilder(playerId),
    (builder) => builder.withStartingItems(redstoneItems),
    (builder) => builder.build()
  )
}

// ===== Function.flow組み合わせヘルパー =====

// 権限制限付きインベントリー生成
export const restrictedInventory = (playerId: PlayerId, allowedItems: ReadonlyArray<string>) =>
  pipe(
    playerInventoryBuilder(playerId),
    (builder) =>
      builder.withPermissions({
        canAddItems: true,
        canRemoveItems: true,
        canModifyArmor: false,
        canUseHotbar: true,
        canUseOffhand: false,
        allowedItemTypes: allowedItems,
      }),
    (builder) => builder.build()
  )

// カスタムスロット数インベントリー
export const customSlotInventory = (playerId: PlayerId, slotCount: number, type: InventoryType = 'player') =>
  pipe(customInventoryBuilder(playerId, type, { slotCount }), (builder) => builder.build())

// ===== プリセットファクトリーヘルパー関数 =====

// タイプ別プリセット取得（Match.valueパターン対応）
export const getPresetByType = (
  type: InventoryType,
  playerId: PlayerId
): Effect.Effect<Inventory, InventoryCreationError> => {
  switch (type) {
    case 'player':
      return standardPlayerInventory(playerId)
    case 'creative':
      return creativeInventory(playerId)
    case 'survival':
      return survivalInventory(playerId)
    case 'spectator':
      return spectatorInventory(playerId)
    case 'adventure':
      return adventureInventory(playerId)
    default:
      return standardPlayerInventory(playerId)
  }
}

// プリセット名から生成（文字列ベース）
export const createPresetInventory = (
  presetName: string,
  playerId: PlayerId
): Effect.Effect<Inventory, InventoryCreationError> => {
  switch (presetName) {
    case 'standard':
      return standardPlayerInventory(playerId)
    case 'creative':
      return creativeInventory(playerId)
    case 'survival':
      return survivalInventory(playerId)
    case 'spectator':
      return spectatorInventory(playerId)
    case 'adventure':
      return adventureInventory(playerId)
    case 'newPlayer':
      return newPlayerInventory(playerId)
    case 'pvpArena':
      return pvpArenaInventory(playerId)
    case 'building':
      return buildingInventory(playerId)
    case 'redstone':
      return redstoneInventory(playerId)
    default:
      return standardPlayerInventory(playerId)
  }
}

// ===== プリセット一覧 =====

export const availablePresets = [
  'standard',
  'creative',
  'survival',
  'spectator',
  'adventure',
  'newPlayer',
  'pvpArena',
  'building',
  'redstone',
] as const

export type InventoryPresetName = (typeof availablePresets)[number]

// プリセット情報
export const presetInfo: Record<InventoryPresetName, { name: string; description: string; slotCount: number }> = {
  standard: {
    name: 'Standard Player',
    description: 'Default player inventory with 36 slots',
    slotCount: 36,
  },
  creative: {
    name: 'Creative Mode',
    description: 'Creative mode inventory with extended slots',
    slotCount: 45,
  },
  survival: {
    name: 'Survival Mode',
    description: 'Standard survival mode inventory',
    slotCount: 36,
  },
  spectator: {
    name: 'Spectator Mode',
    description: 'Spectator mode with no item storage',
    slotCount: 0,
  },
  adventure: {
    name: 'Adventure Mode',
    description: 'Adventure mode with equipment restrictions',
    slotCount: 36,
  },
  newPlayer: {
    name: 'New Player',
    description: 'Starting inventory with basic tools',
    slotCount: 36,
  },
  pvpArena: {
    name: 'PvP Arena',
    description: 'Combat-ready inventory for PvP',
    slotCount: 36,
  },
  building: {
    name: 'Building Mode',
    description: 'Creative inventory focused on building blocks',
    slotCount: 45,
  },
  redstone: {
    name: 'Redstone Engineer',
    description: 'Redstone components and circuits',
    slotCount: 45,
  },
}
