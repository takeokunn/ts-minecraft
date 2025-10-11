import { Data, Schema } from 'effect'

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const MaterialId = NonEmptyString.pipe(Schema.brand('MaterialId'))
export type MaterialId = Schema.Schema.Type<typeof MaterialId>

export const BlockId = NonEmptyString.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockId>

export const ItemId = NonEmptyString.pipe(Schema.brand('ItemId'))
export type ItemId = Schema.Schema.Type<typeof ItemId>

export const Hardness = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('Hardness'))
export type Hardness = Schema.Schema.Type<typeof Hardness>

export const BlastResistance = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('BlastResistance'))
export type BlastResistance = Schema.Schema.Type<typeof BlastResistance>

export const BurnTime = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('BurnTime'))
export type BurnTime = Schema.Schema.Type<typeof BurnTime>

export const MiningSpeed = Schema.Number.pipe(Schema.positive(), Schema.brand('MiningSpeed'))
export type MiningSpeed = Schema.Schema.Type<typeof MiningSpeed>

export const HarvestLevel = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(4),
  Schema.brand('HarvestLevel')
)
export type HarvestLevel = Schema.Schema.Type<typeof HarvestLevel>

export const FortuneLevel = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(3),
  Schema.brand('FortuneLevel')
)
export type FortuneLevel = Schema.Schema.Type<typeof FortuneLevel>

export const MaterialCategory = Schema.Literal(
  'wood',
  'stone',
  'iron',
  'gold',
  'diamond',
  'netherite',
  'dirt',
  'sand',
  'glass',
  'wool',
  'leaves',
  'liquid'
)
export type MaterialCategory = Schema.Schema.Type<typeof MaterialCategory>

export const ToolType = Schema.Literal('pickaxe', 'axe', 'shovel', 'hoe', 'shears', 'sword')
export type ToolType = Schema.Schema.Type<typeof ToolType>

export const ToolMaterial = Schema.Literal('wood', 'stone', 'iron', 'gold', 'diamond', 'netherite')
export type ToolMaterial = Schema.Schema.Type<typeof ToolMaterial>

export const EnchantmentType = Schema.Literal('efficiency', 'fortune', 'silk_touch', 'unbreaking')
export type EnchantmentType = Schema.Schema.Type<typeof EnchantmentType>

export const Enchantment = Schema.Struct({
  type: EnchantmentType,
  level: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(5)),
})
export type Enchantment = Schema.Schema.Type<typeof Enchantment>

export const Tool = Schema.Struct({
  type: ToolType,
  material: ToolMaterial,
  enchantments: Schema.Array(Enchantment),
})
export type Tool = Schema.Schema.Type<typeof Tool>

export const ItemStack = Schema.Struct({
  itemId: ItemId,
  amount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
})
export type ItemStack = Schema.Schema.Type<typeof ItemStack>

export const ToolRequirement = Schema.Struct({
  required: Schema.Boolean,
  preferredTypes: Schema.Array(ToolType).pipe(Schema.minItems(1)),
  minimumLevel: HarvestLevel,
})
export type ToolRequirement = Schema.Schema.Type<typeof ToolRequirement>

export const ToolEfficiency = Schema.Struct({
  toolType: ToolType,
  toolMaterial: ToolMaterial,
  targetCategory: MaterialCategory,
  speedMultiplier: MiningSpeed,
  canHarvest: Schema.Boolean,
})
export type ToolEfficiency = Schema.Schema.Type<typeof ToolEfficiency>

export const ToolEfficiencyCollection = Schema.Array(ToolEfficiency).pipe(Schema.minItems(1))
export type ToolEfficiencyCollection = Schema.Schema.Type<typeof ToolEfficiencyCollection>

export const Material = Schema.Struct({
  id: MaterialId,
  blockId: BlockId,
  defaultItemId: ItemId,
  category: MaterialCategory,
  hardness: Hardness,
  blastResistance: BlastResistance,
  luminance: Schema.Number.pipe(Schema.between(0, 15)),
  tool: ToolRequirement,
  drops: Schema.Array(ItemStack),
  burnTime: Schema.optional(BurnTime),
  tags: Schema.Array(Schema.String),
})
export type Material = Schema.Schema.Type<typeof Material>

export const MaterialCollection = Schema.Array(Material).pipe(Schema.minItems(1))
export type MaterialCollection = Schema.Schema.Type<typeof MaterialCollection>

export type MaterialError = Data.TaggedEnum<{
  MaterialNotFound: { readonly blockId: BlockId }
  ToolRequired: { readonly blockId: BlockId }
  HarvestLevelInsufficient: {
    readonly blockId: BlockId
    readonly requiredLevel: HarvestLevel
    readonly toolLevel: HarvestLevel
  }
  ToolMismatch: {
    readonly blockId: BlockId
    readonly expected: ReadonlyArray<ToolType>
    readonly actual: ToolType
  }
  InvalidFortuneLevel: { readonly level: number }
}>

export const MaterialError = Data.taggedEnum<MaterialError>()

export type MaterialEvent = Data.TaggedEnum<{
  Harvested: {
    readonly blockId: BlockId
    readonly drops: ReadonlyArray<ItemStack>
    readonly timestampMillis: number
  }
}>

export const MaterialEvent = Data.taggedEnum<MaterialEvent>()

export const parseMaterialId = Schema.decodeUnknown(MaterialId)
export const parseBlockId = Schema.decodeUnknown(BlockId)
export const parseItemId = Schema.decodeUnknown(ItemId)
export const parseHarvestLevel = Schema.decodeUnknown(HarvestLevel)
export const parseFortuneLevel = Schema.decodeUnknown(FortuneLevel)
