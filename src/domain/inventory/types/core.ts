import { Schema } from 'effect'

// =============================================================================
// Core Brand Types for Type Safety
// =============================================================================

/**
 * インベントリ識別子
 * ドメイン全体でのインベントリ一意識別子
 */
export const InventoryIdSchema = Schema.String.pipe(
  Schema.pattern(/^inv_[a-zA-Z0-9_-]{8,32}$/), // inv_xxxxxxxx format
  Schema.brand('InventoryId'),
  Schema.annotations({
    title: 'InventoryId',
    description: 'Unique identifier for an inventory instance',
    examples: ['inv_player_12345678', 'inv_chest_abcd1234'],
  })
)

export type InventoryId = Schema.Schema.Type<typeof InventoryIdSchema>

/**
 * プレイヤー識別子
 * 専用value_objectから再エクスポート
 */
export { PlayerIdSchema, type PlayerId } from '@domain/player/value_object/player_id'

/**
 * アイテム識別子
 * Minecraftアイテムの一意識別子（namespace:name形式）
 */
export const ItemIdSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z_]+:[a-z_]+$/),
  Schema.brand('ItemId'),
  Schema.annotations({
    title: 'ItemId',
    description: 'Unique identifier for an item (namespace:name format)',
    examples: ['minecraft:stone', 'minecraft:diamond_sword', 'custom:magic_wand'],
  })
)

export type ItemId = Schema.Schema.Type<typeof ItemIdSchema>

/**
 * スロット番号
 * インベントリスロットの番号（0-based index）
 */
export const SlotNumberSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 53), // 54 slots max (36 main + 9 hotbar + 4 armor + 1 offhand + 3 crafting slots)
  Schema.brand('SlotNumber'),
  Schema.annotations({
    title: 'SlotNumber',
    description: 'Zero-based index for inventory slots',
  })
)

export type SlotNumber = Schema.Schema.Type<typeof SlotNumberSchema>

/**
 * アイテム数量
 * スタック内のアイテム数（1-64）
 */
export const ItemQuantitySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 64),
  Schema.brand('ItemQuantity'),
  Schema.annotations({
    title: 'ItemQuantity',
    description: 'Number of items in a stack (1-64)',
  })
)

export type ItemQuantity = Schema.Schema.Type<typeof ItemQuantitySchema>

/**
 * 耐久度値
 * アイテムの耐久度（0.0-1.0の比率）
 */
export const DurabilitySchema = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand('Durability'),
  Schema.annotations({
    title: 'Durability',
    description: 'Item durability as a ratio (0.0 = broken, 1.0 = perfect)',
  })
)

export type Durability = Schema.Schema.Type<typeof DurabilitySchema>

/**
 * エンチャントレベル
 * エンチャントの効果レベル（1-5）
 */
export const EnchantmentLevelSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 5),
  Schema.brand('EnchantmentLevel'),
  Schema.annotations({
    title: 'EnchantmentLevel',
    description: 'Enchantment effect level (1-5)',
  })
)

export type EnchantmentLevel = Schema.Schema.Type<typeof EnchantmentLevelSchema>

/**
 * インベントリタイプ
 * インベントリの種類を示すADT
 */
export const InventoryTypeSchema = Schema.Literal(
  'player',
  'chest',
  'furnace',
  'crafting_table',
  'anvil',
  'enchanting_table',
  'brewing_stand',
  'dispenser',
  'hopper',
  'shulker_box'
).pipe(
  Schema.annotations({
    title: 'InventoryType',
    description: 'Type of inventory container',
  })
)

export type InventoryType = Schema.Schema.Type<typeof InventoryTypeSchema>

/**
 * スロットタイプ
 * スロットの機能的分類を示すADT
 */
export const SlotTypeSchema = Schema.Literal(
  'main', // メインインベントリ
  'hotbar', // ホットバー
  'armor', // 防具スロット
  'offhand', // オフハンド
  'crafting', // クラフトスロット
  'result', // 結果スロット
  'fuel', // 燃料スロット
  'input', // 入力スロット
  'output' // 出力スロット
).pipe(
  Schema.annotations({
    title: 'SlotType',
    description: 'Functional classification of inventory slots',
  })
)

export type SlotType = Schema.Schema.Type<typeof SlotTypeSchema>

// =============================================================================
// Item Definition Types
// =============================================================================

/**
 * アイテム品質
 * アイテムのレアリティや品質を示すADT
 */
export const ItemQualitySchema = Schema.Literal('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic').pipe(
  Schema.annotations({
    title: 'ItemQuality',
    description: 'Item rarity and quality classification',
  })
)

export type ItemQuality = Schema.Schema.Type<typeof ItemQualitySchema>

/**
 * エンチャント定義
 * エンチャントの詳細情報
 */
export const EnchantmentSchema = Schema.Struct({
  id: Schema.String.pipe(
    Schema.pattern(/^[a-z_]+:[a-z_]+$/),
    Schema.annotations({
      description: 'Enchantment identifier (namespace:name format)',
      examples: ['minecraft:sharpness', 'minecraft:protection'],
    })
  ),
  level: EnchantmentLevelSchema,
  maxLevel: EnchantmentLevelSchema,
}).pipe(
  Schema.annotations({
    title: 'Enchantment',
    description: 'Enchantment definition with level constraints',
  })
)

export type Enchantment = Schema.Schema.Type<typeof EnchantmentSchema>

/**
 * アイテムメタデータ
 * アイテムに付随するメタ情報
 */
export const ItemMetadataSchema = Schema.Struct({
  displayName: Schema.optional(
    Schema.String.pipe(
      Schema.maxLength(100),
      Schema.annotations({
        description: 'Custom display name for the item',
      })
    )
  ),
  lore: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.maxLength(200))).pipe(
      Schema.maxItems(10),
      Schema.annotations({
        description: 'Descriptive text lines for the item',
      })
    )
  ),
  enchantments: Schema.optional(
    Schema.Array(EnchantmentSchema).pipe(
      Schema.maxItems(20),
      Schema.annotations({
        description: 'Applied enchantments',
      })
    )
  ),
  nbtData: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Any }).pipe(
      Schema.annotations({
        description: 'Custom NBT data for mod compatibility',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemMetadata',
    description: 'Additional metadata associated with an item',
  })
)

export type ItemMetadata = Schema.Schema.Type<typeof ItemMetadataSchema>

/**
 * アイテム定義
 * ゲーム内アイテムの完全な定義
 */
export const ItemDefinitionSchema = Schema.Struct({
  id: ItemIdSchema,
  name: Schema.String.pipe(
    Schema.nonEmptyString(),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Human-readable item name',
    })
  ),
  description: Schema.optional(
    Schema.String.pipe(
      Schema.maxLength(500),
      Schema.annotations({
        description: 'Item description for tooltips',
      })
    )
  ),
  maxStackSize: ItemQuantitySchema,
  quality: ItemQualitySchema,
  isDamageable: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether the item can be damaged',
    })
  ),
  maxDurability: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum durability points when isDamageable is true',
      })
    )
  ),
  texture: Schema.String.pipe(
    Schema.pattern(/^[a-z_]+:[a-z_/]+$/),
    Schema.annotations({
      description: 'Texture resource identifier',
      examples: ['minecraft:textures/item/stone', 'custom:textures/item/magic_wand'],
    })
  ),
  tags: Schema.Array(Schema.String.pipe(Schema.pattern(/^[a-z_]+$/))).pipe(
    Schema.maxItems(50),
    Schema.annotations({
      description: 'Item tags for categorization and compatibility',
      examples: [
        ['stone', 'building_block'],
        ['weapon', 'sword', 'combat'],
      ],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemDefinition',
    description: 'Complete definition of a game item',
  })
)

export type ItemDefinition = Schema.Schema.Type<typeof ItemDefinitionSchema>

/**
 * アイテムスタック
 * 実際のインベントリ内のアイテム
 */
export const ItemStackSchema = Schema.Struct({
  itemId: ItemIdSchema,
  quantity: ItemQuantitySchema,
  durability: Schema.optional(DurabilitySchema),
  metadata: Schema.optional(ItemMetadataSchema),
}).pipe(
  Schema.annotations({
    title: 'ItemStack',
    description: 'A stack of items in an inventory slot',
  })
)

export type ItemStack = Schema.Schema.Type<typeof ItemStackSchema>

// =============================================================================
// Inventory Slot Types
// =============================================================================

/**
 * インベントリスロット
 * 個別のスロット情報
 */
export const InventorySlotSchema = Schema.Struct({
  slotNumber: SlotNumberSchema,
  slotType: SlotTypeSchema,
  item: Schema.optional(ItemStackSchema),
  isLocked: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether the slot is locked and cannot be modified',
    })
  ),
  restrictions: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.maxItems(10),
      Schema.annotations({
        description: 'Item type restrictions for this slot',
        examples: [['armor:helmet'], ['fuel'], ['input']],
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'InventorySlot',
    description: 'Individual slot within an inventory',
  })
)

export type InventorySlot = Schema.Schema.Type<typeof InventorySlotSchema>

// =============================================================================
// Parse Functions
// =============================================================================

export const parseInventoryId = Schema.decodeUnknown(InventoryIdSchema)
export const parsePlayerId = Schema.decodeUnknown(PlayerIdSchema)
export const parseItemId = Schema.decodeUnknown(ItemIdSchema)
export const parseSlotNumber = Schema.decodeUnknown(SlotNumberSchema)
export const parseItemQuantity = Schema.decodeUnknown(ItemQuantitySchema)
export const parseDurability = Schema.decodeUnknown(DurabilitySchema)
export const parseEnchantmentLevel = Schema.decodeUnknown(EnchantmentLevelSchema)
export const parseInventoryType = Schema.decodeUnknown(InventoryTypeSchema)
export const parseSlotType = Schema.decodeUnknown(SlotTypeSchema)
export const parseItemQuality = Schema.decodeUnknown(ItemQualitySchema)
export const parseItemDefinition = Schema.decodeUnknown(ItemDefinitionSchema)
export const parseItemStack = Schema.decodeUnknown(ItemStackSchema)
export const parseInventorySlot = Schema.decodeUnknown(InventorySlotSchema)

// =============================================================================
// Validation Functions
// =============================================================================

export const isValidInventoryId = Schema.is(InventoryIdSchema)
export const isValidPlayerId = Schema.is(PlayerIdSchema)
export const isValidItemId = Schema.is(ItemIdSchema)
export const isValidSlotNumber = Schema.is(SlotNumberSchema)
export const isValidItemQuantity = Schema.is(ItemQuantitySchema)
export const isValidDurability = Schema.is(DurabilitySchema)
export const isValidEnchantmentLevel = Schema.is(EnchantmentLevelSchema)
export const isValidInventoryType = Schema.is(InventoryTypeSchema)
export const isValidSlotType = Schema.is(SlotTypeSchema)
export const isValidItemQuality = Schema.is(ItemQualitySchema)
export const isValidItemDefinition = Schema.is(ItemDefinitionSchema)
export const isValidItemStack = Schema.is(ItemStackSchema)
export const isValidInventorySlot = Schema.is(InventorySlotSchema)
