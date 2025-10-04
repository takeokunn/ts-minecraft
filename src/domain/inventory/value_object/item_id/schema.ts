import { Brand, Schema } from 'effect'
import { ItemCategory, ItemId, ItemName, ItemRarity, Namespace } from './types'

/**
 * Namespace Brand型用Schema
 */
export const NamespaceSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z0-9._-]+$/),
  Schema.fromBrand(Brand.nominal<Namespace>())
)

/**
 * ItemName Brand型用Schema
 */
export const ItemNameSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z0-9/_-]+$/),
  Schema.fromBrand(Brand.nominal<ItemName>())
)

/**
 * ItemId Brand型用Schema
 */
export const ItemIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z0-9._-]+:[a-z0-9/_-]+$/),
  Schema.filter(
    (value) => {
      const parts = value.split(':')
      return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
    },
    {
      message: () => 'ItemId must be in format "namespace:name"',
    }
  ),
  Schema.fromBrand(Brand.nominal<ItemId>())
)

/**
 * ItemCategory ADT用Schema
 */
export const ItemCategorySchema: Schema.Schema<ItemCategory> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Block'),
    subtype: Schema.Union(
      Schema.Literal('building'),
      Schema.Literal('decorative'),
      Schema.Literal('functional'),
      Schema.Literal('natural')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Tool'),
    toolType: Schema.Union(
      Schema.Literal('sword'),
      Schema.Literal('pickaxe'),
      Schema.Literal('axe'),
      Schema.Literal('shovel'),
      Schema.Literal('hoe'),
      Schema.Literal('bow'),
      Schema.Literal('crossbow')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Armor'),
    slot: Schema.Union(
      Schema.Literal('helmet'),
      Schema.Literal('chestplate'),
      Schema.Literal('leggings'),
      Schema.Literal('boots')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Food'),
    nutrition: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    saturation: Schema.Number.pipe(Schema.between(0, 20)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Material'),
    rarity: Schema.Union(
      Schema.Literal('common'),
      Schema.Literal('uncommon'),
      Schema.Literal('rare'),
      Schema.Literal('epic'),
      Schema.Literal('legendary')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Potion'),
    effects: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
    duration: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Misc'),
    description: Schema.String.pipe(Schema.nonEmptyString()),
  })
)

/**
 * ItemRarity ADT用Schema
 */
export const ItemRaritySchema: Schema.Schema<ItemRarity> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Common'),
    color: Schema.Literal('#FFFFFF'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Uncommon'),
    color: Schema.Literal('#55FF55'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Rare'),
    color: Schema.Literal('#5555FF'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Epic'),
    color: Schema.Literal('#AA00AA'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Legendary'),
    color: Schema.Literal('#FFAA00'),
  })
)

/**
 * 標準的なMinecraftアイテムID用Schema
 */
export const MinecraftItemIdSchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:[a-z0-9/_-]+$/),
  Schema.fromBrand(Brand.nominal<ItemId>())
)

/**
 * MODアイテムID用Schema
 */
export const ModItemIdSchema = Schema.String.pipe(
  Schema.pattern(/^(?!minecraft:)[a-z0-9._-]+:[a-z0-9/_-]+$/),
  Schema.fromBrand(Brand.nominal<ItemId>())
)

/**
 * アイテムタグ用Schema
 */
export const ItemTagSchema = Schema.String.pipe(Schema.pattern(/^#[a-z0-9._-]+:[a-z0-9/_-]+$/), Schema.brand('ItemTag'))

/**
 * よく使われるアイテムカテゴリの定義
 */
export const CommonItemSchemas = {
  // ブロック系
  stone: MinecraftItemIdSchema.pipe(Schema.pattern(/^minecraft:.*stone$/), Schema.brand('StoneItem')),
  wood: MinecraftItemIdSchema.pipe(Schema.pattern(/^minecraft:.*wood$/), Schema.brand('WoodItem')),
  ore: MinecraftItemIdSchema.pipe(Schema.pattern(/^minecraft:.*ore$/), Schema.brand('OreItem')),

  // ツール系
  pickaxe: MinecraftItemIdSchema.pipe(Schema.pattern(/^minecraft:.*pickaxe$/), Schema.brand('PickaxeItem')),
  sword: MinecraftItemIdSchema.pipe(Schema.pattern(/^minecraft:.*sword$/), Schema.brand('SwordItem')),

  // 食べ物系
  food: MinecraftItemIdSchema.pipe(
    Schema.pattern(/^minecraft:(bread|apple|carrot|potato|beef|pork|chicken|fish|cookie|cake)$/),
    Schema.brand('FoodItem')
  ),
} as const

/**
 * アイテム検索用Schema
 */
export const ItemSearchCriteriaSchema = Schema.Struct({
  namespace: Schema.optional(NamespaceSchema),
  category: Schema.optional(ItemCategorySchema),
  rarity: Schema.optional(ItemRaritySchema),
  namePattern: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
})
