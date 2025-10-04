import { Schema } from 'effect'
import {
  EnchantmentLevel,
  EnchantmentLevelSchema,
  InventoryType,
  ItemQuality,
  ItemQuantity,
  ItemQuantitySchema,
  SlotType,
  SlotTypeSchema,
  Durability,
  DurabilitySchema,
} from './core'

const decode = <A>(schema: Schema.Schema<A>, value: unknown): A =>
  Schema.decodeUnknownSync(schema)(value)

const itemQuantity = (value: number): ItemQuantity => decode(ItemQuantitySchema, value)
const enchantmentLevel = (value: number): EnchantmentLevel => decode(EnchantmentLevelSchema, value)
const durability = (value: number): Durability => decode(DurabilitySchema, value)
const slotTypeArraySchema = Schema.Array(SlotTypeSchema)
const slotTypes = (...values: SlotType[]): ReadonlyArray<SlotType> => decode(slotTypeArraySchema, values)

type InventorySizes = {
  readonly PLAYER_MAIN: number
  readonly PLAYER_HOTBAR: number
  readonly PLAYER_TOTAL: number
  readonly PLAYER_ARMOR: number
  readonly PLAYER_OFFHAND: number
  readonly CHEST_SMALL: number
  readonly CHEST_LARGE: number
  readonly ENDER_CHEST: number
  readonly SHULKER_BOX: number
  readonly FURNACE: number
  readonly BLAST_FURNACE: number
  readonly SMOKER: number
  readonly CRAFTING_TABLE: number
  readonly CRAFTING_PLAYER: number
  readonly BREWING_STAND: number
  readonly ENCHANTING_TABLE: number
  readonly ANVIL: number
  readonly HOPPER: number
  readonly DISPENSER: number
  readonly DROPPER: number
}

export const INVENTORY_SIZES: InventorySizes = {
  PLAYER_MAIN: 27,
  PLAYER_HOTBAR: 9,
  PLAYER_TOTAL: 36,
  PLAYER_ARMOR: 4,
  PLAYER_OFFHAND: 1,
  CHEST_SMALL: 27,
  CHEST_LARGE: 54,
  ENDER_CHEST: 27,
  SHULKER_BOX: 27,
  FURNACE: 3,
  BLAST_FURNACE: 3,
  SMOKER: 3,
  CRAFTING_TABLE: 9,
  CRAFTING_PLAYER: 4,
  BREWING_STAND: 5,
  ENCHANTING_TABLE: 2,
  ANVIL: 3,
  HOPPER: 5,
  DISPENSER: 9,
  DROPPER: 9,
}

type SlotRange = Readonly<{ start: number; end: number }>

type SlotRanges = {
  readonly PLAYER_MAIN: SlotRange
  readonly PLAYER_HOTBAR: SlotRange
  readonly PLAYER_ARMOR_HELMET: number
  readonly PLAYER_ARMOR_CHESTPLATE: number
  readonly PLAYER_ARMOR_LEGGINGS: number
  readonly PLAYER_ARMOR_BOOTS: number
  readonly PLAYER_OFFHAND: number
  readonly CRAFTING_RESULT: number
  readonly CRAFTING_INPUT: SlotRange
}

export const SLOT_RANGES: SlotRanges = {
  PLAYER_MAIN: { start: 9, end: 35 },
  PLAYER_HOTBAR: { start: 0, end: 8 },
  PLAYER_ARMOR_HELMET: 39,
  PLAYER_ARMOR_CHESTPLATE: 38,
  PLAYER_ARMOR_LEGGINGS: 37,
  PLAYER_ARMOR_BOOTS: 36,
  PLAYER_OFFHAND: 40,
  CRAFTING_RESULT: 0,
  CRAFTING_INPUT: { start: 1, end: 9 },
}

type ItemConstraints = {
  readonly MAX_STACK_SIZE: ItemQuantity
  readonly MIN_STACK_SIZE: ItemQuantity
  readonly NON_STACKABLE_SIZE: ItemQuantity
  readonly MAX_DURABILITY: Durability
  readonly MIN_DURABILITY: Durability
  readonly BROKEN_DURABILITY: Durability
  readonly MAX_ENCHANTMENT_LEVEL: EnchantmentLevel
  readonly MIN_ENCHANTMENT_LEVEL: EnchantmentLevel
  readonly MAX_ENCHANTMENTS_PER_ITEM: number
  readonly MAX_DISPLAY_NAME_LENGTH: number
  readonly MAX_LORE_LINES: number
  readonly MAX_LORE_LINE_LENGTH: number
  readonly MAX_ITEM_TAGS: number
  readonly MAX_NBT_DEPTH: number
  readonly MAX_NBT_SIZE_BYTES: number
}

export const ITEM_CONSTRAINTS: ItemConstraints = {
  MAX_STACK_SIZE: itemQuantity(64),
  MIN_STACK_SIZE: itemQuantity(1),
  NON_STACKABLE_SIZE: itemQuantity(1),
  MAX_DURABILITY: durability(1.0),
  MIN_DURABILITY: durability(0.0),
  BROKEN_DURABILITY: durability(0.0),
  MAX_ENCHANTMENT_LEVEL: enchantmentLevel(5),
  MIN_ENCHANTMENT_LEVEL: enchantmentLevel(1),
  MAX_ENCHANTMENTS_PER_ITEM: 20,
  MAX_DISPLAY_NAME_LENGTH: 100,
  MAX_LORE_LINES: 10,
  MAX_LORE_LINE_LENGTH: 200,
  MAX_ITEM_TAGS: 50,
  MAX_NBT_DEPTH: 8,
  MAX_NBT_SIZE_BYTES: 65_536,
}

export const CUSTOM_STACK_SIZES: Readonly<Record<string, ItemQuantity>> = {
  'minecraft:diamond_sword': itemQuantity(1),
  'minecraft:iron_sword': itemQuantity(1),
  'minecraft:wooden_sword': itemQuantity(1),
  'minecraft:stone_sword': itemQuantity(1),
  'minecraft:golden_sword': itemQuantity(1),
  'minecraft:netherite_sword': itemQuantity(1),
  'minecraft:diamond_pickaxe': itemQuantity(1),
  'minecraft:iron_pickaxe': itemQuantity(1),
  'minecraft:wooden_pickaxe': itemQuantity(1),
  'minecraft:stone_pickaxe': itemQuantity(1),
  'minecraft:golden_pickaxe': itemQuantity(1),
  'minecraft:netherite_pickaxe': itemQuantity(1),
  'minecraft:diamond_helmet': itemQuantity(1),
  'minecraft:diamond_chestplate': itemQuantity(1),
  'minecraft:diamond_leggings': itemQuantity(1),
  'minecraft:diamond_boots': itemQuantity(1),
  'minecraft:ender_pearl': itemQuantity(16),
  'minecraft:egg': itemQuantity(16),
  'minecraft:snowball': itemQuantity(16),
  'minecraft:honey_bottle': itemQuantity(16),
  'minecraft:bucket': itemQuantity(16),
  'minecraft:water_bucket': itemQuantity(1),
  'minecraft:lava_bucket': itemQuantity(1),
  'minecraft:milk_bucket': itemQuantity(1),
}

type InventoryTypeConfiguration = Readonly<{
  slots: number
  allowedSlotTypes: ReadonlyArray<SlotType>
  hasHotbar: boolean
  hasArmor: boolean
  hasOffhand: boolean
  allowCrafting: boolean
}>

export const INVENTORY_TYPE_CONFIG: Readonly<Record<InventoryType, InventoryTypeConfiguration>> = {
  player: {
    slots: INVENTORY_SIZES.PLAYER_TOTAL,
    allowedSlotTypes: slotTypes('main', 'hotbar', 'armor', 'offhand'),
    hasHotbar: true,
    hasArmor: true,
    hasOffhand: true,
    allowCrafting: true,
  },
  chest: {
    slots: INVENTORY_SIZES.CHEST_SMALL,
    allowedSlotTypes: slotTypes('main'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
  furnace: {
    slots: INVENTORY_SIZES.FURNACE,
    allowedSlotTypes: slotTypes('input', 'fuel', 'output'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
  crafting_table: {
    slots: INVENTORY_SIZES.CRAFTING_TABLE + 1,
    allowedSlotTypes: slotTypes('crafting', 'result'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: true,
  },
  anvil: {
    slots: INVENTORY_SIZES.ANVIL,
    allowedSlotTypes: slotTypes('input', 'result'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
  enchanting_table: {
    slots: INVENTORY_SIZES.ENCHANTING_TABLE,
    allowedSlotTypes: slotTypes('input'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
  brewing_stand: {
    slots: INVENTORY_SIZES.BREWING_STAND,
    allowedSlotTypes: slotTypes('input', 'fuel'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
  dispenser: {
    slots: INVENTORY_SIZES.DISPENSER,
    allowedSlotTypes: slotTypes('main'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
  hopper: {
    slots: INVENTORY_SIZES.HOPPER,
    allowedSlotTypes: slotTypes('main'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
  shulker_box: {
    slots: INVENTORY_SIZES.SHULKER_BOX,
    allowedSlotTypes: slotTypes('main'),
    hasHotbar: false,
    hasArmor: false,
    hasOffhand: false,
    allowCrafting: false,
  },
}

type ItemQualityConfig = Readonly<{
  colorCode: string
  enchantmentBonus: number
  durabilityMultiplier: number
  rarity: number
}>

export const ITEM_QUALITY_CONFIG: Readonly<Record<ItemQuality, ItemQualityConfig>> = {
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
}

type ValidationConstants = Readonly<{
  MAX_CONCURRENT_OPERATIONS: number
  MAX_BATCH_SIZE: number
  OPERATION_TIMEOUT_MS: number
  MAX_INVENTORY_ACCESS_RATE: number
  MAX_ITEM_TRANSFER_RATE: number
  MAX_TRANSACTION_HISTORY: number
  MAX_PENDING_REQUESTS: number
  MAX_EVENT_QUEUE_SIZE: number
  MAX_EFFECT_DURATION_TICKS: number
  CHECKSUM_ALGORITHM: string
  VERSION_FORMAT_REGEX: RegExp
  CACHE_TTL_MS: number
  MAX_CACHE_SIZE: number
}>

export const VALIDATION_CONSTANTS: ValidationConstants = {
  MAX_CONCURRENT_OPERATIONS: 100,
  MAX_BATCH_SIZE: 64,
  OPERATION_TIMEOUT_MS: 5_000,
  MAX_INVENTORY_ACCESS_RATE: 10,
  MAX_ITEM_TRANSFER_RATE: 64,
  MAX_TRANSACTION_HISTORY: 1_000,
  MAX_PENDING_REQUESTS: 256,
  MAX_EVENT_QUEUE_SIZE: 1_024,
  MAX_EFFECT_DURATION_TICKS: 200,
  CHECKSUM_ALGORITHM: 'sha256',
  VERSION_FORMAT_REGEX: /^\d+\.\d+\.\d+$/,
  CACHE_TTL_MS: 300_000,
  MAX_CACHE_SIZE: 1_000,
}

interface ErrorMessages {
  readonly INVALID_SLOT_INDEX: string
  readonly INVALID_ITEM_COUNT: string
  readonly INVALID_DURABILITY: string
  readonly INVALID_ENCHANTMENT_LEVEL: string
  readonly SLOT_OCCUPIED: string
  readonly INSUFFICIENT_ITEMS: string
  readonly INVENTORY_FULL: string
  readonly ITEM_NOT_STACKABLE: string
  readonly INVALID_STACK_SIZE: string
  readonly INVENTORY_NOT_FOUND: string
  readonly CONCURRENT_MODIFICATION: string
  readonly PERSISTENCE_FAILURE: string
  readonly CORRUPTED_DATA: string
  readonly ACCESS_DENIED: string
  readonly INSUFFICIENT_PERMISSIONS: string
  readonly OPERATION_NOT_ALLOWED: string
}

export const ERROR_MESSAGES: ErrorMessages = {
  INVALID_SLOT_INDEX: 'inventory.error.invalid_slot_index',
  INVALID_ITEM_COUNT: 'inventory.error.invalid_item_count',
  INVALID_DURABILITY: 'inventory.error.invalid_durability',
  INVALID_ENCHANTMENT_LEVEL: 'inventory.error.invalid_enchantment_level',
  SLOT_OCCUPIED: 'inventory.error.slot_occupied',
  INSUFFICIENT_ITEMS: 'inventory.error.insufficient_items',
  INVENTORY_FULL: 'inventory.error.inventory_full',
  ITEM_NOT_STACKABLE: 'inventory.error.item_not_stackable',
  INVALID_STACK_SIZE: 'inventory.error.invalid_stack_size',
  INVENTORY_NOT_FOUND: 'inventory.error.not_found',
  CONCURRENT_MODIFICATION: 'inventory.error.concurrent_modification',
  PERSISTENCE_FAILURE: 'inventory.error.persistence_failure',
  CORRUPTED_DATA: 'inventory.error.corrupted_data',
  ACCESS_DENIED: 'inventory.error.access_denied',
  INSUFFICIENT_PERMISSIONS: 'inventory.error.insufficient_permissions',
  OPERATION_NOT_ALLOWED: 'inventory.error.operation_not_allowed',
}

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

type InventorySizeValue = InventorySizes[keyof InventorySizes]
const inventorySizeSet = new Set<number>(Object.values(INVENTORY_SIZES))

export const isValidInventorySize = (size: number): size is InventorySizeValue =>
  inventorySizeSet.has(size)

type SlotRangeValue = SlotRanges[keyof SlotRanges]
const isSlotRangeObject = Schema.is(SlotRangeSchema)

export const isValidSlotRange = (range: unknown): range is SlotRangeValue =>
  typeof range === 'number' || isSlotRangeObject(range)

const hasCustomStackSize = (itemId: string): boolean => Object.hasOwn(CUSTOM_STACK_SIZES, itemId)

export const isCustomStackSizeItem = (itemId: string): itemId is keyof typeof CUSTOM_STACK_SIZES =>
  hasCustomStackSize(itemId)

export const getCustomStackSize = (itemId: string): ItemQuantity =>
  isCustomStackSizeItem(itemId) ? CUSTOM_STACK_SIZES[itemId] : ITEM_CONSTRAINTS.MAX_STACK_SIZE
