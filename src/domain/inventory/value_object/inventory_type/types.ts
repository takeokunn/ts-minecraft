import type { JsonValue } from '@shared/schema/json'
import { Brand, Data } from 'effect'

/**
 * インベントリタイプのADT
 */
export type InventoryType = Data.TaggedEnum<{
  Player: { readonly slots: 36; readonly hotbarSlots: 9; readonly armorSlots: 4; readonly offhandSlots: 1 }
  Chest: { readonly rows: number; readonly slots: number }
  DoubleChest: { readonly slots: 54; readonly leftChest: boolean }
  Furnace: { readonly inputSlot: 0; readonly fuelSlot: 1; readonly outputSlot: 2 }
  BlastFurnace: { readonly inputSlot: 0; readonly fuelSlot: 1; readonly outputSlot: 2 }
  Smoker: { readonly inputSlot: 0; readonly fuelSlot: 1; readonly outputSlot: 2 }
  CraftingTable: { readonly gridSlots: 9; readonly outputSlot: 1 }
  Anvil: { readonly leftSlot: 0; readonly rightSlot: 1; readonly outputSlot: 2 }
  EnchantingTable: { readonly itemSlot: 0; readonly lapisSlot: 1 }
  BrewingStand: { readonly inputSlots: 3; readonly fuelSlot: 1; readonly blazePowderSlot: 1 }
  Beacon: { readonly inputSlot: 1 }
  Hopper: { readonly slots: 5 }
  Dispenser: { readonly slots: 9 }
  Dropper: { readonly slots: 9 }
  ShulkerBox: { readonly slots: 27; readonly color: string }
  Barrel: { readonly slots: 27 }
  CartographyTable: { readonly mapSlot: 0; readonly paperSlot: 1; readonly outputSlot: 2 }
  Grindstone: { readonly leftSlot: 0; readonly rightSlot: 1; readonly outputSlot: 2 }
  Loom: { readonly bannerSlot: 0; readonly dyeSlot: 1; readonly patternSlot: 2; readonly outputSlot: 3 }
  Smithing: { readonly templateSlot: 0; readonly baseSlot: 1; readonly additionSlot: 2; readonly outputSlot: 3 }
  Stonecutter: { readonly inputSlot: 0; readonly outputSlots: 1 }
  Horse: { readonly slots: number; readonly armorSlot?: boolean; readonly saddleSlot?: boolean }
  Llama: { readonly slots: number; readonly carpetSlot: boolean }
  Villager: { readonly trades: number }
  Creative: { readonly unlimited: true }
}>

/**
 * InventoryType コンストラクタ
 */
export const InventoryType = Data.taggedEnum<InventoryType>()

/**
 * インベントリ容量のBrand型
 */
export type InventoryCapacity = Brand.Brand<
  {
    readonly totalSlots: number
    readonly maxStacksPerSlot: number
    readonly maxItemsTotal: number
  },
  'InventoryCapacity'
>

/**
 * インベントリサイズカテゴリのADT
 */
export type InventorySize = Data.TaggedEnum<{
  Small: { readonly slots: number; readonly description: string } // 5-9 slots
  Medium: { readonly slots: number; readonly description: string } // 18-27 slots
  Large: { readonly slots: number; readonly description: string } // 36-54 slots
  ExtraLarge: { readonly slots: number; readonly description: string } // 54+ slots
  Variable: { readonly minSlots: number; readonly maxSlots: number; readonly description: string }
}>

/**
 * InventorySize コンストラクタ
 */
export const InventorySize = Data.taggedEnum<InventorySize>()

/**
 * インベントリアクセス権限のADT
 */
export type InventoryAccess = Data.TaggedEnum<{
  ReadOnly: { readonly reason: string }
  WriteOnly: { readonly reason: string }
  ReadWrite: {}
  Restricted: { readonly allowedPlayers: readonly string[]; readonly reason: string }
  AdminOnly: { readonly adminLevel: number }
}>

/**
 * InventoryAccess コンストラクタ
 */
export const InventoryAccess = Data.taggedEnum<InventoryAccess>()

/**
 * インベントリの特殊機能のADT
 */
export type InventoryFeature = Data.TaggedEnum<{
  AutoSorting: { readonly enabled: boolean; readonly sortBy: 'name' | 'type' | 'rarity' | 'quantity' }
  VoidProtection: { readonly enabled: boolean; readonly protectedItems: readonly string[] }
  AutoCrafting: { readonly recipes: readonly string[] }
  Filter: { readonly allowedItems: readonly string[]; readonly blockedItems: readonly string[] }
  KeepOnDeath: { readonly enabled: boolean; readonly items: readonly string[] }
  Sharing: { readonly sharedWith: readonly string[]; readonly permissions: InventoryAccess }
  Backup: { readonly enabled: boolean; readonly frequency: number; readonly maxBackups: number }
}>

/**
 * InventoryFeature コンストラクタ
 */
export const InventoryFeature = Data.taggedEnum<InventoryFeature>()

/**
 * インベントリ互換性のADT
 */
export type InventoryCompatibility = Data.TaggedEnum<{
  FullyCompatible: { readonly reason: string }
  PartiallyCompatible: { readonly limitations: readonly string[] }
  Incompatible: { readonly reason: string }
  RequiresConversion: { readonly conversionType: string; readonly dataLoss: boolean }
}>

/**
 * InventoryCompatibility コンストラクタ
 */
export const InventoryCompatibility = Data.taggedEnum<InventoryCompatibility>()

/**
 * InventoryType関連のエラーADT
 */
export type InventoryTypeError = Data.TaggedEnum<{
  UnsupportedType: { readonly type: string; readonly supportedTypes: readonly string[] }
  InvalidSlotCount: { readonly slots: number; readonly min: number; readonly max: number }
  IncompatibleFeature: { readonly feature: string; readonly inventoryType: string }
  AccessDenied: { readonly userId: string; readonly requiredPermission: string }
  CapacityExceeded: { readonly current: number; readonly max: number; readonly itemType: string }
  TypeConversionFailed: { readonly from: string; readonly to: string; readonly reason: string }
  InvalidConfiguration: { readonly field: string; readonly value: JsonValue; readonly expected: string }
}>

/**
 * InventoryTypeError コンストラクタ
 */
export const InventoryTypeError = Data.taggedEnum<InventoryTypeError>()

/**
 * インベントリレイアウト設定
 */
export type InventoryLayout = {
  readonly type: InventoryType
  readonly gridWidth: number
  readonly gridHeight: number
  readonly specialSlots: Record<string, { readonly x: number; readonly y: number; readonly type: string }>
  readonly playerSlots: boolean
  readonly displayName: string
}

/**
 * インベントリの統計情報
 */
export type InventoryStats = {
  readonly totalSlots: number
  readonly usedSlots: number
  readonly emptySlots: number
  readonly totalItems: number
  readonly uniqueItems: number
  readonly averageStackSize: number
  readonly utilization: number // 0-1の範囲
}
