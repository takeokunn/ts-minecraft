import { Schema } from 'effect'
import type { EnchantmentLevel, InventoryType, ItemQuality, ItemQuantity, SlotType } from './core'

// =============================================================================
// Inventory Size Constants
// =============================================================================

/**
 * インベントリサイズ定数
 * 各種インベントリの標準サイズ定義
 */
export const INVENTORY_SIZES = {
  PLAYER_MAIN: 27 as const, // プレイヤーメインインベントリ（3x9）
  PLAYER_HOTBAR: 9 as const, // ホットバー（1x9）
  PLAYER_TOTAL: 36 as const, // プレイヤー総スロット数
  PLAYER_ARMOR: 4 as const, // 防具スロット数
  PLAYER_OFFHAND: 1 as const, // オフハンドスロット数

  CHEST_SMALL: 27 as const, // 小チェスト（3x9）
  CHEST_LARGE: 54 as const, // 大チェスト（6x9）
  ENDER_CHEST: 27 as const, // エンダーチェスト（3x9）
  SHULKER_BOX: 27 as const, // シュルカーボックス（3x9）

  FURNACE: 3 as const, // かまど（input + fuel + output）
  BLAST_FURNACE: 3 as const, // 高炉
  SMOKER: 3 as const, // 燻製器

  CRAFTING_TABLE: 9 as const, // 作業台（3x3）
  CRAFTING_PLAYER: 4 as const, // プレイヤークラフト（2x2）

  BREWING_STAND: 5 as const, // 醸造台（3 potions + 1 blaze powder + 1 ingredient）
  ENCHANTING_TABLE: 2 as const, // エンチャントテーブル（item + lapis）
  ANVIL: 3 as const, // 金床（item1 + item2 + result）

  HOPPER: 5 as const, // ホッパー（1x5）
  DISPENSER: 9 as const, // ディスペンサー（3x3）
  DROPPER: 9 as const, // ドロッパー（3x3）
} as const

/**
 * スロット番号範囲定数
 * 各スロットタイプの番号範囲定義
 */
export const SLOT_RANGES = {
  PLAYER_MAIN: { start: 9, end: 35 } as const, // プレイヤーメインインベントリ
  PLAYER_HOTBAR: { start: 0, end: 8 } as const, // ホットバー
  PLAYER_ARMOR_HELMET: 39 as const, // ヘルメットスロット
  PLAYER_ARMOR_CHESTPLATE: 38 as const, // チェストプレートスロット
  PLAYER_ARMOR_LEGGINGS: 37 as const, // レギンススロット
  PLAYER_ARMOR_BOOTS: 36 as const, // ブーツスロット
  PLAYER_OFFHAND: 40 as const, // オフハンドスロット

  CRAFTING_RESULT: 0 as const, // クラフト結果スロット
  CRAFTING_INPUT: { start: 1, end: 9 } as const, // クラフト入力スロット
} as const

// =============================================================================
// Item Constraint Constants
// =============================================================================

/**
 * アイテム制約定数
 * アイテムの物理的制限定義
 */
export const ITEM_CONSTRAINTS = {
  // スタックサイズ制限
  MAX_STACK_SIZE: 64 as ItemQuantity,
  MIN_STACK_SIZE: 1 as ItemQuantity,

  // 非スタック可能アイテムのスタックサイズ
  NON_STACKABLE_SIZE: 1 as ItemQuantity,

  // 耐久度制限
  MAX_DURABILITY: 1.0 as const,
  MIN_DURABILITY: 0.0 as const,
  BROKEN_DURABILITY: 0.0 as const,

  // エンチャント制限
  MAX_ENCHANTMENT_LEVEL: 5 as EnchantmentLevel,
  MIN_ENCHANTMENT_LEVEL: 1 as EnchantmentLevel,
  MAX_ENCHANTMENTS_PER_ITEM: 20 as const,

  // メタデータ制限
  MAX_DISPLAY_NAME_LENGTH: 100 as const,
  MAX_LORE_LINES: 10 as const,
  MAX_LORE_LINE_LENGTH: 200 as const,
  MAX_ITEM_TAGS: 50 as const,

  // NBTデータ制限
  MAX_NBT_DEPTH: 8 as const,
  MAX_NBT_SIZE_BYTES: 65536 as const, // 64KB
} as const

/**
 * 特殊スタックサイズマッピング
 * アイテムタイプ別のカスタムスタックサイズ
 */
export const CUSTOM_STACK_SIZES = {
  // 非スタック可能アイテム
  'minecraft:diamond_sword': 1,
  'minecraft:iron_sword': 1,
  'minecraft:wooden_sword': 1,
  'minecraft:stone_sword': 1,
  'minecraft:golden_sword': 1,
  'minecraft:netherite_sword': 1,

  'minecraft:diamond_pickaxe': 1,
  'minecraft:iron_pickaxe': 1,
  'minecraft:wooden_pickaxe': 1,
  'minecraft:stone_pickaxe': 1,
  'minecraft:golden_pickaxe': 1,
  'minecraft:netherite_pickaxe': 1,

  // 防具類
  'minecraft:diamond_helmet': 1,
  'minecraft:diamond_chestplate': 1,
  'minecraft:diamond_leggings': 1,
  'minecraft:diamond_boots': 1,

  // 16スタック制限アイテム
  'minecraft:ender_pearl': 16,
  'minecraft:egg': 16,
  'minecraft:snowball': 16,
  'minecraft:honey_bottle': 16,

  // その他の制限
  'minecraft:bucket': 16,
  'minecraft:water_bucket': 1,
  'minecraft:lava_bucket': 1,
  'minecraft:milk_bucket': 1,
} as const

// =============================================================================
// Inventory Type Configuration
// =============================================================================

/**
 * インベントリタイプ設定
 * 各インベントリタイプの詳細設定
 */
export const INVENTORY_TYPE_CONFIG = {
  player: {
    slots: INVENTORY_SIZES.PLAYER_TOTAL,
    allowedSlotTypes: ['main', 'hotbar', 'armor', 'offhand'] as SlotType[],
    hasHotbar: true,
    hasArmor: true,
    hasOffhand: true,
    allowCrafting: true,
  },

  chest: {
    slots: INVENTORY_SIZES.CHEST_SMALL,
    allowedSlotTypes: ['main'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },

  furnace: {
    slots: INVENTORY_SIZES.FURNACE,
    allowedSlotTypes: ['input', 'fuel', 'output'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },

  crafting_table: {
    slots: INVENTORY_SIZES.CRAFTING_TABLE + 1, // +1 for result slot
    allowedSlotTypes: ['crafting', 'result'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: true,
  },

  anvil: {
    slots: INVENTORY_SIZES.ANVIL,
    allowedSlotTypes: ['input', 'result'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },

  enchanting_table: {
    slots: INVENTORY_SIZES.ENCHANTING_TABLE,
    allowedSlotTypes: ['input'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },

  brewing_stand: {
    slots: INVENTORY_SIZES.BREWING_STAND,
    allowedSlotTypes: ['input', 'fuel'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },

  dispenser: {
    slots: INVENTORY_SIZES.DISPENSER,
    allowedSlotTypes: ['main'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },

  hopper: {
    slots: INVENTORY_SIZES.HOPPER,
    allowedSlotTypes: ['main'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },

  shulker_box: {
    slots: INVENTORY_SIZES.SHULKER_BOX,
    allowedSlotTypes: ['main'] as SlotType[],
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
} as const satisfies Record<
  InventoryType,
  {
    slots: number
    allowedSlotTypes: SlotType[]
    hasHotbar: boolean
    hasArmor: boolean
    hasOffhand: boolean
    allowCrafting: boolean
  }
>

// =============================================================================
// Item Quality Configuration
// =============================================================================

/**
 * アイテム品質設定
 * 品質レベル別の設定値
 */
export const ITEM_QUALITY_CONFIG = {
  common: {
    colorCode: '#FFFFFF',
    enchantmentBonus: 1.0,
    durabilityMultiplier: 1.0,
    rarity: 1,
  },

  uncommon: {
    colorCode: '#55FF55',
    enchantmentBonus: 1.1,
    durabilityMultiplier: 1.1,
    rarity: 2,
  },

  rare: {
    colorCode: '#5555FF',
    enchantmentBonus: 1.25,
    durabilityMultiplier: 1.25,
    rarity: 3,
  },

  epic: {
    colorCode: '#AA00AA',
    enchantmentBonus: 1.5,
    durabilityMultiplier: 1.5,
    rarity: 4,
  },

  legendary: {
    colorCode: '#FFAA00',
    enchantmentBonus: 2.0,
    durabilityMultiplier: 2.0,
    rarity: 5,
  },

  mythic: {
    colorCode: '#FF5555',
    enchantmentBonus: 3.0,
    durabilityMultiplier: 3.0,
    rarity: 6,
  },
} as const satisfies Record<
  ItemQuality,
  {
    colorCode: string
    enchantmentBonus: number
    durabilityMultiplier: number
    rarity: number
  }
>

// =============================================================================
// Validation Constants
// =============================================================================

/**
 * バリデーション用定数
 * 各種バリデーション処理で使用する閾値
 */
export const VALIDATION_CONSTANTS = {
  // パフォーマンス制限
  MAX_CONCURRENT_OPERATIONS: 100,
  MAX_BATCH_SIZE: 64,
  OPERATION_TIMEOUT_MS: 5000,

  // セキュリティ制限
  MAX_INVENTORY_ACCESS_RATE: 10, // per second
  MAX_ITEM_TRANSFER_RATE: 64, // items per second

  // データ整合性
  CHECKSUM_ALGORITHM: 'sha256' as const,
  VERSION_FORMAT_REGEX: /^\d+\.\d+\.\d+$/ as const,

  // キャッシュ設定
  CACHE_TTL_MS: 300000, // 5 minutes
  MAX_CACHE_SIZE: 1000,
} as const

// =============================================================================
// Error Message Constants
// =============================================================================

/**
 * エラーメッセージ定数
 * 多言語対応を見据えたエラーメッセージキー
 */
export const ERROR_MESSAGES = {
  // バリデーションエラー
  INVALID_SLOT_INDEX: 'inventory.error.invalid_slot_index',
  INVALID_ITEM_COUNT: 'inventory.error.invalid_item_count',
  INVALID_DURABILITY: 'inventory.error.invalid_durability',
  INVALID_ENCHANTMENT_LEVEL: 'inventory.error.invalid_enchantment_level',

  // 操作エラー
  SLOT_OCCUPIED: 'inventory.error.slot_occupied',
  INSUFFICIENT_ITEMS: 'inventory.error.insufficient_items',
  INVENTORY_FULL: 'inventory.error.inventory_full',
  ITEM_NOT_STACKABLE: 'inventory.error.item_not_stackable',
  INVALID_STACK_SIZE: 'inventory.error.invalid_stack_size',

  // システムエラー
  INVENTORY_NOT_FOUND: 'inventory.error.not_found',
  CONCURRENT_MODIFICATION: 'inventory.error.concurrent_modification',
  PERSISTENCE_FAILURE: 'inventory.error.persistence_failure',
  CORRUPTED_DATA: 'inventory.error.corrupted_data',

  // 権限エラー
  ACCESS_DENIED: 'inventory.error.access_denied',
  INSUFFICIENT_PERMISSIONS: 'inventory.error.insufficient_permissions',
  OPERATION_NOT_ALLOWED: 'inventory.error.operation_not_allowed',
} as const

// =============================================================================
// Schema Exports for Runtime Validation
// =============================================================================

/**
 * 定数値のスキーマ定義
 * 実行時バリデーション用
 */
export const InventorySizeSchema = Schema.Literal(...Object.values(INVENTORY_SIZES))

export const SlotRangeSchema = Schema.Struct({
  start: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  end: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export const ItemConstraintsSchema = Schema.Struct({
  MAX_STACK_SIZE: Schema.Number.pipe(Schema.int(), Schema.positive()),
  MIN_STACK_SIZE: Schema.Number.pipe(Schema.int(), Schema.positive()),
  NON_STACKABLE_SIZE: Schema.Number.pipe(Schema.int(), Schema.positive()),
  MAX_DURABILITY: Schema.Number.pipe(Schema.between(0, 1)),
  MIN_DURABILITY: Schema.Number.pipe(Schema.between(0, 1)),
})

// Type guards for constants
export const isValidInventorySize = (size: number): size is (typeof INVENTORY_SIZES)[keyof typeof INVENTORY_SIZES] =>
  Object.values(INVENTORY_SIZES).includes(size as any)

export const isValidSlotRange = (range: unknown): range is (typeof SLOT_RANGES)[keyof typeof SLOT_RANGES] =>
  Schema.is(SlotRangeSchema)(range) || typeof range === 'number'

export const isCustomStackSizeItem = (itemId: string): itemId is keyof typeof CUSTOM_STACK_SIZES =>
  itemId in CUSTOM_STACK_SIZES

export const getCustomStackSize = (itemId: string): ItemQuantity =>
  (isCustomStackSizeItem(itemId) ? CUSTOM_STACK_SIZES[itemId] : ITEM_CONSTRAINTS.MAX_STACK_SIZE) as ItemQuantity
