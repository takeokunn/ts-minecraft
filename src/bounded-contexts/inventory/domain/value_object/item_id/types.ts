import { Brand, Data } from 'effect'

/**
 * ItemId Brand型（minecraft:stone形式）
 */
export type ItemId = Brand.Brand<string, 'ItemId'> & {
  readonly format: 'namespace:name'
  readonly namespace: string
  readonly name: string
}

/**
 * 名前空間のBrand型
 */
export type Namespace = Brand.Brand<string, 'Namespace'> & {
  readonly pattern: string // /^[a-z0-9._-]+$/
}

/**
 * アイテム名のBrand型
 */
export type ItemName = Brand.Brand<string, 'ItemName'> & {
  readonly pattern: string // /^[a-z0-9/_-]+$/
}

/**
 * アイテムカテゴリのADT
 */
export type ItemCategory = Data.TaggedEnum<{
  Block: { readonly subtype: 'building' | 'decorative' | 'functional' | 'natural' }
  Tool: { readonly toolType: 'sword' | 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'bow' | 'crossbow' }
  Armor: { readonly slot: 'helmet' | 'chestplate' | 'leggings' | 'boots' }
  Food: { readonly nutrition: number; readonly saturation: number }
  Material: { readonly rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' }
  Potion: { readonly effects: readonly string[]; readonly duration: number }
  Misc: { readonly description: string }
}>

/**
 * ItemCategory コンストラクタ
 */
export const ItemCategory = Data.taggedEnum<ItemCategory>()

/**
 * アイテムレアリティのADT
 */
export type ItemRarity = Data.TaggedEnum<{
  Common: { readonly color: '#FFFFFF' }
  Uncommon: { readonly color: '#55FF55' }
  Rare: { readonly color: '#5555FF' }
  Epic: { readonly color: '#AA00AA' }
  Legendary: { readonly color: '#FFAA00' }
}>

/**
 * ItemRarity コンストラクタ
 */
export const ItemRarity = Data.taggedEnum<ItemRarity>()

/**
 * ItemId関連のエラーADT
 */
export type ItemIdError = Data.TaggedEnum<{
  InvalidFormat: { readonly input: string; readonly expected: 'namespace:name' }
  InvalidNamespace: { readonly namespace: string; readonly pattern: string }
  InvalidItemName: { readonly name: string; readonly pattern: string }
  UnknownItem: { readonly itemId: ItemId; readonly registry: readonly string[] }
  DuplicateItem: { readonly itemId: ItemId; readonly existingCategory: ItemCategory }
  CategoryMismatch: { readonly itemId: ItemId; readonly expected: ItemCategory; readonly actual: ItemCategory }
  InvalidRarity: { readonly itemId: ItemId; readonly rarity: string; readonly validRarities: readonly string[] }
}>

/**
 * ItemIdError コンストラクタ
 */
export const ItemIdError = Data.taggedEnum<ItemIdError>()

/**
 * アイテム検索条件
 */
export type ItemSearchCriteria = {
  readonly namespace?: Namespace
  readonly category?: ItemCategory
  readonly rarity?: ItemRarity
  readonly namePattern?: RegExp
  readonly tags?: readonly string[]
}

/**
 * アイテム比較結果
 */
export type ItemComparison = Data.TaggedEnum<{
  Same: { readonly itemId: ItemId }
  SameNamespace: { readonly namespace: Namespace; readonly differentNames: readonly ItemName[] }
  SameCategory: { readonly category: ItemCategory; readonly differentIds: readonly ItemId[] }
  Different: { readonly item1: ItemId; readonly item2: ItemId }
}>

/**
 * ItemComparison コンストラクタ
 */
export const ItemComparison = Data.taggedEnum<ItemComparison>()
