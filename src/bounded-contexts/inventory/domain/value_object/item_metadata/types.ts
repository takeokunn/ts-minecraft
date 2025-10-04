import { Brand, Data } from 'effect'

/**
 * NBTタグ値のBrand型
 */
export type NBTValue = Brand.Brand<unknown, 'NBTValue'>

/**
 * NBTタグのADT
 */
export type NBTTag = Data.TaggedEnum<{
  Byte: { readonly value: number }
  Short: { readonly value: number }
  Int: { readonly value: number }
  Long: { readonly value: bigint }
  Float: { readonly value: number }
  Double: { readonly value: number }
  String: { readonly value: string }
  ByteArray: { readonly value: readonly number[] }
  IntArray: { readonly value: readonly number[] }
  LongArray: { readonly value: readonly bigint[] }
  List: { readonly value: readonly NBTTag[]; readonly elementType: NBTTagType }
  Compound: { readonly value: Record<string, NBTTag> }
}>

/**
 * NBTTag コンストラクタ
 */
export const NBTTag = Data.taggedEnum<NBTTag>()

/**
 * NBTタグタイプ
 */
export type NBTTagType =
  | 'byte'
  | 'short'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'string'
  | 'byteArray'
  | 'intArray'
  | 'longArray'
  | 'list'
  | 'compound'

/**
 * エンチャントのBrand型
 */
export type Enchantment = Brand.Brand<
  {
    readonly id: string
    readonly level: number
  },
  'Enchantment'
>

/**
 * アイテムの耐久値のBrand型
 */
export type Durability = Brand.Brand<
  {
    readonly current: number
    readonly max: number
  },
  'Durability'
>

/**
 * アイテムの表示名のBrand型
 */
export type DisplayName = Brand.Brand<string, 'DisplayName'>

/**
 * アイテムの説明文のBrand型
 */
export type ItemLore = Brand.Brand<readonly string[], 'ItemLore'>

/**
 * カスタムモデルデータのBrand型
 */
export type CustomModelData = Brand.Brand<number, 'CustomModelData'>

/**
 * ItemMetadata Brand型（NBTデータ相当）
 */
export type ItemMetadata = Brand.Brand<
  {
    readonly display?: {
      readonly name?: DisplayName
      readonly lore?: ItemLore
      readonly color?: number
    }
    readonly enchantments?: readonly Enchantment[]
    readonly durability?: Durability
    readonly customModelData?: CustomModelData
    readonly customTags?: Record<string, NBTTag>
    readonly hideFlags?: number
    readonly unbreakable?: boolean
    readonly canDestroy?: readonly string[]
    readonly canPlaceOn?: readonly string[]
  },
  'ItemMetadata'
>

/**
 * エンチャント効果のADT
 */
export type EnchantmentEffect = Data.TaggedEnum<{
  Protection: { readonly type: 'all' | 'fire' | 'fall' | 'blast' | 'projectile' }
  Sharpness: { readonly damageBonus: number }
  Efficiency: { readonly speedMultiplier: number }
  Fortune: { readonly dropMultiplier: number }
  SilkTouch: {}
  Unbreaking: { readonly durabilityMultiplier: number }
  Mending: {}
  Infinity: {}
  Custom: { readonly name: string; readonly description: string; readonly effect: unknown }
}>

/**
 * EnchantmentEffect コンストラクタ
 */
export const EnchantmentEffect = Data.taggedEnum<EnchantmentEffect>()

/**
 * アイテム状態のADT
 */
export type ItemCondition = Data.TaggedEnum<{
  Perfect: { readonly description: 'Brand new condition' }
  Excellent: { readonly durabilityPercentage: number }
  Good: { readonly durabilityPercentage: number }
  Fair: { readonly durabilityPercentage: number }
  Poor: { readonly durabilityPercentage: number }
  Broken: { readonly canRepair: boolean }
}>

/**
 * ItemCondition コンストラクタ
 */
export const ItemCondition = Data.taggedEnum<ItemCondition>()

/**
 * ItemMetadata関連のエラーADT
 */
export type ItemMetadataError = Data.TaggedEnum<{
  InvalidNBTTag: { readonly tag: string; readonly type: NBTTagType; readonly value: unknown }
  InvalidEnchantment: { readonly enchantmentId: string; readonly level: number; readonly maxLevel: number }
  DurabilityOutOfRange: { readonly current: number; readonly max: number }
  InvalidDisplayName: { readonly name: string; readonly reason: string }
  InvalidLore: { readonly lore: readonly string[]; readonly reason: string }
  ConflictingEnchantments: { readonly enchantment1: string; readonly enchantment2: string }
  UnknownCustomTag: { readonly tagName: string; readonly value: unknown }
  MetadataTooBig: { readonly currentSize: number; readonly maxSize: number }
  InvalidHideFlags: { readonly flags: number; readonly validRange: string }
}>

/**
 * ItemMetadataError コンストラクタ
 */
export const ItemMetadataError = Data.taggedEnum<ItemMetadataError>()

/**
 * メタデータ更新操作のADT
 */
export type MetadataOperation = Data.TaggedEnum<{
  SetDisplayName: { readonly name: DisplayName }
  SetLore: { readonly lore: ItemLore }
  AddEnchantment: { readonly enchantment: Enchantment }
  RemoveEnchantment: { readonly enchantmentId: string }
  UpdateDurability: { readonly durability: Durability }
  SetCustomModelData: { readonly data: CustomModelData }
  SetCustomTag: { readonly key: string; readonly value: NBTTag }
  RemoveCustomTag: { readonly key: string }
  SetHideFlags: { readonly flags: number }
  SetUnbreakable: { readonly unbreakable: boolean }
  AddCanDestroy: { readonly blockId: string }
  AddCanPlaceOn: { readonly blockId: string }
}>

/**
 * MetadataOperation コンストラクタ
 */
export const MetadataOperation = Data.taggedEnum<MetadataOperation>()

/**
 * メタデータ比較結果
 */
export type MetadataComparison = Data.TaggedEnum<{
  Identical: {}
  Different: { readonly differences: readonly string[] }
  SimilarWithEnhancements: { readonly enhancements: readonly string[] }
  Incompatible: { readonly reason: string }
}>

/**
 * MetadataComparison コンストラクタ
 */
export const MetadataComparison = Data.taggedEnum<MetadataComparison>()
