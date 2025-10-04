import { Brand, Schema } from 'effect'
import {
  CustomModelData,
  DisplayName,
  Durability,
  Enchantment,
  EnchantmentEffect,
  ItemCondition,
  ItemLore,
  ItemMetadata,
  NBTTag,
} from './types'

/**
 * NBTTagType用Schema
 */
export const NBTTagTypeSchema = Schema.Union(
  Schema.Literal('byte'),
  Schema.Literal('short'),
  Schema.Literal('int'),
  Schema.Literal('long'),
  Schema.Literal('float'),
  Schema.Literal('double'),
  Schema.Literal('string'),
  Schema.Literal('byteArray'),
  Schema.Literal('intArray'),
  Schema.Literal('longArray'),
  Schema.Literal('list'),
  Schema.Literal('compound')
)

/**
 * NBTTag ADT用Schema
 */
export const NBTTagSchema: Schema.Schema<NBTTag> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Byte'),
    value: Schema.Number.pipe(Schema.int(), Schema.between(-128, 127)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Short'),
    value: Schema.Number.pipe(Schema.int(), Schema.between(-32768, 32767)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Int'),
    value: Schema.Number.pipe(Schema.int(), Schema.between(-2147483648, 2147483647)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Long'),
    value: Schema.BigInt,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Float'),
    value: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Double'),
    value: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('String'),
    value: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ByteArray'),
    value: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(-128, 127))),
  }),
  Schema.Struct({
    _tag: Schema.Literal('IntArray'),
    value: Schema.Array(Schema.Number.pipe(Schema.int())),
  }),
  Schema.Struct({
    _tag: Schema.Literal('LongArray'),
    value: Schema.Array(Schema.BigInt),
  }),
  Schema.Struct({
    _tag: Schema.Literal('List'),
    value: Schema.Array(Schema.suspend(() => NBTTagSchema)),
    elementType: NBTTagTypeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Compound'),
    value: Schema.Record({ key: Schema.String, value: Schema.suspend(() => NBTTagSchema) }),
  })
)

/**
 * Enchantment Brand型用Schema
 */
export const EnchantmentSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.nonEmptyString(), Schema.pattern(/^minecraft:[a-z_]+$/)),
  level: Schema.Number.pipe(Schema.int(), Schema.between(1, 255)),
}).pipe(Schema.fromBrand(Brand.nominal<Enchantment>()))

/**
 * Durability Brand型用Schema
 */
export const DurabilitySchema = Schema.Struct({
  current: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  max: Schema.Number.pipe(Schema.int(), Schema.positive()),
}).pipe(
  Schema.filter((durability) => durability.current <= durability.max, {
    message: () => 'Current durability cannot exceed maximum durability',
  }),
  Schema.fromBrand(Brand.nominal<Durability>())
)

/**
 * DisplayName Brand型用Schema
 */
export const DisplayNameSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.maxLength(256),
  Schema.fromBrand(Brand.nominal<DisplayName>())
)

/**
 * ItemLore Brand型用Schema
 */
export const ItemLoreSchema = Schema.Array(Schema.String.pipe(Schema.maxLength(256))).pipe(
  Schema.maxItems(20), // 最大20行の説明文
  Schema.fromBrand(Brand.nominal<ItemLore>())
)

/**
 * CustomModelData Brand型用Schema
 */
export const CustomModelDataSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 2147483647),
  Schema.fromBrand(Brand.nominal<CustomModelData>())
)

/**
 * Display情報用Schema
 */
export const DisplaySchema = Schema.Struct({
  name: Schema.optional(DisplayNameSchema),
  lore: Schema.optional(ItemLoreSchema),
  color: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(0, 16777215) // 24-bit RGB color
    )
  ),
})

/**
 * ItemMetadata Brand型用Schema
 */
export const ItemMetadataSchema = Schema.Struct({
  display: Schema.optional(DisplaySchema),
  enchantments: Schema.optional(Schema.Array(EnchantmentSchema)),
  durability: Schema.optional(DurabilitySchema),
  customModelData: Schema.optional(CustomModelDataSchema),
  customTags: Schema.optional(Schema.Record({ key: Schema.String, value: NBTTagSchema })),
  hideFlags: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(0, 127) // 7 bits for hide flags
    )
  ),
  unbreakable: Schema.optional(Schema.Boolean),
  canDestroy: Schema.optional(Schema.Array(Schema.String.pipe(Schema.pattern(/^minecraft:[a-z_]+$/)))),
  canPlaceOn: Schema.optional(Schema.Array(Schema.String.pipe(Schema.pattern(/^minecraft:[a-z_]+$/)))),
}).pipe(Schema.fromBrand(Brand.nominal<ItemMetadata>()))

/**
 * EnchantmentEffect ADT用Schema
 */
export const EnchantmentEffectSchema: Schema.Schema<EnchantmentEffect> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Protection'),
    type: Schema.Union(
      Schema.Literal('all'),
      Schema.Literal('fire'),
      Schema.Literal('fall'),
      Schema.Literal('blast'),
      Schema.Literal('projectile')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Sharpness'),
    damageBonus: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Efficiency'),
    speedMultiplier: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Fortune'),
    dropMultiplier: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('SilkTouch'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Unbreaking'),
    durabilityMultiplier: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Mending'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Infinity'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Custom'),
    name: Schema.String.pipe(Schema.nonEmptyString()),
    description: Schema.String.pipe(Schema.nonEmptyString()),
    effect: Schema.Unknown,
  })
)

/**
 * ItemCondition ADT用Schema
 */
export const ItemConditionSchema: Schema.Schema<ItemCondition> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Perfect'),
    description: Schema.Literal('Brand new condition'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Excellent'),
    durabilityPercentage: Schema.Number.pipe(Schema.between(80, 99)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Good'),
    durabilityPercentage: Schema.Number.pipe(Schema.between(60, 79)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Fair'),
    durabilityPercentage: Schema.Number.pipe(Schema.between(40, 59)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Poor'),
    durabilityPercentage: Schema.Number.pipe(Schema.between(20, 39)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Broken'),
    canRepair: Schema.Boolean,
  })
)

/**
 * よく使われるエンチャント用Schema
 */
export const CommonEnchantmentSchemas = {
  sharpness: Schema.Struct({
    id: Schema.Literal('minecraft:sharpness'),
    level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
  }).pipe(Schema.fromBrand(Brand.nominal<Enchantment>())),

  protection: Schema.Struct({
    id: Schema.Literal('minecraft:protection'),
    level: Schema.Number.pipe(Schema.int(), Schema.between(1, 4)),
  }).pipe(Schema.fromBrand(Brand.nominal<Enchantment>())),

  efficiency: Schema.Struct({
    id: Schema.Literal('minecraft:efficiency'),
    level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
  }).pipe(Schema.fromBrand(Brand.nominal<Enchantment>())),

  unbreaking: Schema.Struct({
    id: Schema.Literal('minecraft:unbreaking'),
    level: Schema.Number.pipe(Schema.int(), Schema.between(1, 3)),
  }).pipe(Schema.fromBrand(Brand.nominal<Enchantment>())),

  fortune: Schema.Struct({
    id: Schema.Literal('minecraft:fortune'),
    level: Schema.Number.pipe(Schema.int(), Schema.between(1, 3)),
  }).pipe(Schema.fromBrand(Brand.nominal<Enchantment>())),

  silkTouch: Schema.Struct({
    id: Schema.Literal('minecraft:silk_touch'),
    level: Schema.Literal(1),
  }).pipe(Schema.fromBrand(Brand.nominal<Enchantment>())),
} as const

/**
 * Hide Flags用Schema（ビットフラグ）
 */
export const HideFlagsSchema = {
  enchantments: Schema.Literal(1),
  attributeModifiers: Schema.Literal(2),
  unbreakable: Schema.Literal(4),
  canDestroy: Schema.Literal(8),
  canPlaceOn: Schema.Literal(16),
  miscellaneous: Schema.Literal(32),
  dye: Schema.Literal(64),
} as const
