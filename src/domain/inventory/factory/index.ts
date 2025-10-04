/**
 * InventoryFactory - Unified Factory System Export Module
 *
 * TypeScript Minecraft Clone - Inventory Domain Factory Systems
 * DDD原理主義に基づく完全なファクトリーパターン実装
 * Effect-TSの関数型パターンによる純粋関数ファクトリーシステム
 *
 * @description
 * このモジュールは、Inventoryドメインの全ファクトリーシステムを統一的にエクスポートします。
 * - InventoryFactory: プレイヤーインベントリー生成システム
 * - ItemFactory: ItemStack生成システム（エンチャント、NBT、品質管理）
 * - ContainerFactory: Container生成システム（Chest、Furnace、Hopper等）
 *
 * @features
 * - Class構文完全禁止：純粋関数のみで実装
 * - Effect-TS関数型パターン：pipe/flow/Match.value徹底活用
 * - DDD Factory Pattern：複雑なオブジェクト生成の隠蔽と整合性保証
 * - Builder Pattern：Fluent APIによる段階的構築
 * - Preset System：一般的なユースケースの即座利用
 */

// ===== Inventory Factory System =====
export {
  adventureInventory,
  availablePresets as availableInventoryPresets,
  buildingInventory,
  // Builder Implementation
  createInventoryBuilder,
  createPresetInventory,
  creativeInventory,
  creativeInventoryBuilder,
  customInventoryBuilder,
  customSlotInventory,
  // Constants & Defaults
  defaultPermissions,
  getPresetByType,
  InventoryBuilderFactoryLayer,
  InventoryBuilderFactoryLive,
  InventoryBuilderFactoryTag,
  // Error Types
  InventoryCreationError,
  // Unified Layer
  InventoryFactoryAllLayer,

  // Helper Functions
  InventoryFactoryHelpers,
  InventoryFactoryLayer,
  // Factory Implementation
  InventoryFactoryLive,
  // Context Tags
  InventoryFactoryTag,
  InventoryMergeError,
  presetInfo as inventoryPresetInfo,
  InventoryValidationError,
  newPlayerInventory,
  playerInventoryBuilder,
  pvpArenaInventory,
  redstoneInventory,
  restrictedInventory,
  spectatorInventory,
  // Preset System
  standardPlayerInventory,
  survivalInventory,
  survivalInventoryBuilder,
  type InventoryBuilder,
  type InventoryBuilderConfig,
  type InventoryBuilderFactory,
  type InventoryConfig,
  // Types & Interfaces
  type InventoryFactory,
  type InventoryPermissions,
  type InventoryPresetName,
  type InventoryType,
} from './inventory_factory'

// ===== Item Factory System =====
export {
  armorItemBuilder,
  arrow,
  availableItemPresets,
  blockItemBuilder,
  // Preset System - Special Items
  bow,
  // Preset System - Food
  bread,
  button,
  cobblestone,
  cookedBeef,
  // Builder Implementation
  createItemBuilder,
  createPresetItem,
  // Helper Functions
  customDurabilityItem,
  customEnchantedItem,
  customItemBuilder,
  // Constants & Defaults
  defaultItemConfig,
  defaultStackingRules,
  diamondChestplate,
  diamondHelmet,
  diamondPickaxe,
  diamondSword,
  dirt,
  enchantedDiamondPickaxe,
  // Preset System - Enchanted Items
  enchantedDiamondSword,
  enchantedGoldenApple,
  enchantedItemBuilder,
  foodItemBuilder,
  glass,
  goldenApple,
  ironChestplate,
  ironHelmet,
  ironPickaxe,
  ironSword,
  ItemBuilderFactoryLayer,
  ItemBuilderFactoryLive,
  ItemBuilderFactoryTag,
  // Error Types
  ItemCreationError,
  // Unified Layer
  ItemFactoryAllLayer,

  // Helper Functions
  ItemFactoryHelpers,
  ItemFactoryLayer,
  // Factory Implementation
  ItemFactoryLive,
  // Context Tags
  ItemFactoryTag,
  itemPresetInfo,
  ItemStackError,
  ItemValidationError,
  leatherBoots,
  leatherChestplate,
  // Preset System - Armor
  leatherHelmet,
  leatherLeggings,
  lever,
  oakPlanks,
  piston,
  redstone,
  redstoneTorch,
  stickyPiston,
  // Preset System - Blocks
  stone,
  stoneAxe,
  stonePickaxe,
  stoneSword,
  toolItemBuilder,
  weaponItemBuilder,
  woodenAxe,
  woodenHoe,
  woodenPickaxe,
  woodenShovel,
  // Preset System - Tools
  woodenSword,
  type EnchantmentDefinition,
  type ItemBuilder,
  type ItemBuilderConfig,
  type ItemBuilderFactory,
  type ItemCategory,
  type ItemConfig,
  // Types & Interfaces
  type ItemFactory,
  type ItemPresetName,
  type ItemQuality,
  type ItemRarity,
  type StackingRules,
} from './item_factory'

// ===== Container Factory System =====
export {
  anvil,
  availableContainerPresets,
  barrel,
  blastFurnace,
  brewingStand,
  brewingStandContainerBuilder,
  buildingMaterialChest,
  chestContainerBuilder,
  coloredShulkerBox,
  ContainerBuilderFactoryLayer,
  ContainerBuilderFactoryLive,
  ContainerBuilderFactoryTag,
  // Error Types
  ContainerCreationError,
  // Unified Layer
  ContainerFactoryAllLayer,

  // Helper Functions
  ContainerFactoryHelpers,
  ContainerFactoryLayer,
  // Factory Implementation
  ContainerFactoryLive,
  // Context Tags
  ContainerFactoryTag,
  ContainerOperationError,
  containerPresetInfo,
  containerTypeSpecs,
  ContainerValidationError,
  craftingTable,
  craftingTableContainerBuilder,
  // Builder Implementation
  createContainerBuilder,
  createPresetContainer,
  customContainerBuilder,
  // Helper Functions
  customPermissionContainer,
  // Constants & Defaults
  defaultContainerPermissions,
  dispenser,
  doubleChest,
  dropper,
  enchantingTable,
  enderChest,
  foodCookingSmoker,
  // Preset System - Special Purpose
  fueledFurnace,
  furnaceContainerBuilder,
  grindstone,

  // Preset System - Automation & Redstone
  hopper,
  hopperContainerBuilder,
  lockedChest,

  // Preset System - Specialized
  oreSmeltingFurnace,
  ownedContainerBuilder,
  // Preset System - Positioned
  positionedChest,
  positionedContainerBuilder,
  positionedFurnace,
  potionBrewingStand,
  preloadedContainerBuilder,
  // Preset System - Ownership
  privateChest,
  redstoneCircuitChest,
  sharedChest,
  shulkerBoxContainerBuilder,
  smoker,
  // Preset System - Basic Storage
  standardChest,
  // Preset System - Crafting & Processing
  standardFurnace,
  starterToolChest,
  type Container,
  type ContainerBuilder,
  type ContainerBuilderConfig,
  type ContainerBuilderFactory,
  type ContainerConfig,
  // Types & Interfaces
  type ContainerFactory,
  type ContainerPermissions,
  type ContainerPresetName,
  type ContainerSlot,
  type ContainerType,
  type ContainerTypeSpec,
} from './container_factory'

// ===== Unified Factory System =====
import { Layer } from 'effect'
import { ContainerFactoryAllLayer } from './container_factory'
import { InventoryFactoryAllLayer } from './inventory_factory'
import { ItemFactoryAllLayer } from './item_factory'

/**
 * 全Inventory関連ファクトリーサービスを統合したレイヤー
 * アプリケーション層でInventoryドメインの全ファクトリーを一括利用可能
 *
 * @description
 * このレイヤーを提供することで、以下の全てのファクトリーサービスが利用可能になります：
 * - InventoryFactory: プレイヤーインベントリー管理
 * - InventoryBuilderFactory: インベントリービルダー
 * - ItemFactory: アイテム生成・管理
 * - ItemBuilderFactory: アイテムビルダー
 * - ContainerFactory: コンテナ生成・管理
 * - ContainerBuilderFactory: コンテナビルダー
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   // 全ファクトリーが利用可能
 *   const playerInventory = yield* InventoryFactoryHelpers.createPlayer('player1')
 *   const diamondSword = yield* ItemFactoryHelpers.createWeapon('diamond_sword')
 *   const chest = yield* ContainerFactoryHelpers.createChest('chest1')
 * }).pipe(Effect.provide(InventoryFactorySystemLayer))
 * ```
 */
export const InventoryFactorySystemLayer = Layer.mergeAll(
  InventoryFactoryAllLayer,
  ItemFactoryAllLayer,
  ContainerFactoryAllLayer
)

// ===== Factory System Information =====

/**
 * ファクトリーシステム統計情報
 */
export const FactorySystemInfo = {
  version: '1.0.0',
  totalFactories: 3,
  totalBuilders: 3,
  totalPresets: {
    inventory: 9,
    item: 30,
    container: 25,
  },
  architecture: {
    pattern: 'DDD Factory Pattern',
    paradigm: 'Functional Programming',
    framework: 'Effect-TS',
    typeSystem: 'TypeScript with Brand Types',
  },
  features: {
    classConstructors: false,
    pureFunction: true,
    immutableData: true,
    typeeSafety: true,
    errorHandling: 'Effect Monad',
    dependencyInjection: 'Context.GenericTag',
    builderPattern: 'Function.flow',
    presetSystem: true,
  },
} as const

/**
 * 利用可能な全プリセット一覧
 */
export const AllAvailablePresets = {
  inventory: [
    'standard',
    'creative',
    'survival',
    'spectator',
    'adventure',
    'newPlayer',
    'pvpArena',
    'building',
    'redstone',
  ],
  item: [
    // Tools
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
    // Armor
    'leather_helmet',
    'leather_chestplate',
    'leather_leggings',
    'leather_boots',
    'iron_helmet',
    'iron_chestplate',
    'diamond_helmet',
    'diamond_chestplate',
    // Food
    'bread',
    'cooked_beef',
    'golden_apple',
    'enchanted_golden_apple',
    // Blocks
    'stone',
    'cobblestone',
    'oak_planks',
    'glass',
    'dirt',
    // Enchanted
    'enchanted_diamond_sword',
    'enchanted_diamond_pickaxe',
    // Special
    'bow',
    'arrow',
    'redstone',
    'redstone_torch',
    'lever',
    'button',
    'piston',
    'sticky_piston',
  ],
  container: [
    // Basic Storage
    'standard_chest',
    'double_chest',
    'ender_chest',
    'barrel',
    'colored_shulker_box',
    // Crafting & Processing
    'standard_furnace',
    'blast_furnace',
    'smoker',
    'brewing_stand',
    'crafting_table',
    'enchanting_table',
    'anvil',
    'grindstone',
    // Automation & Redstone
    'hopper',
    'dropper',
    'dispenser',
    // Special Purpose
    'fueled_furnace',
    'starter_tool_chest',
    'building_material_chest',
    'redstone_circuit_chest',
    // Ownership
    'private_chest',
    'shared_chest',
    'locked_chest',
    // Specialized
    'ore_smelting_furnace',
    'food_cooking_smoker',
    'potion_brewing_stand',
  ],
} as const

// ===== 型定義のRe-export =====

// より使いやすいエイリアス
export type { ContainerType, InventoryType, ItemCategory, ItemQuality, ItemRarity } from './inventory_factory/interface'

export type { EnchantmentDefinition, StackingRules } from './item_factory/interface'

export type { Container, ContainerPermissions, ContainerSlot } from './container_factory/interface'
