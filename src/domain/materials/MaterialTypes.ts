import { Schema } from '@effect/schema'

// Branded Types
export const Hardness = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Hardness')
)
export type Hardness = Schema.Schema.Type<typeof Hardness>

export const BlastResistance = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('BlastResistance')
)
export type BlastResistance = Schema.Schema.Type<typeof BlastResistance>

export const BurnTime = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('BurnTime')
)
export type BurnTime = Schema.Schema.Type<typeof BurnTime>

export const MiningSpeed = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('MiningSpeed')
)
export type MiningSpeed = Schema.Schema.Type<typeof MiningSpeed>

// IDs
export const MaterialId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('MaterialId')
)
export type MaterialId = Schema.Schema.Type<typeof MaterialId>

export const BlockId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('BlockId')
)
export type BlockId = Schema.Schema.Type<typeof BlockId>

export const ItemId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('ItemId')
)
export type ItemId = Schema.Schema.Type<typeof ItemId>

// Position
export const Position3D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
export type Position3D = Schema.Schema.Type<typeof Position3D>

// ItemStack
export const ItemStack = Schema.Struct({
  itemId: ItemId,
  amount: Schema.Number.pipe(Schema.positive())
})
export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// Material Categories
export const MaterialCategory = Schema.Literal(
  'wood', 'stone', 'iron', 'gold', 'diamond', 'netherite',
  'dirt', 'sand', 'glass', 'wool', 'leaves', 'liquid'
)
export type MaterialCategory = Schema.Schema.Type<typeof MaterialCategory>

// Tool Types
export const ToolType = Schema.Literal(
  'pickaxe', 'axe', 'shovel', 'hoe', 'shears', 'sword'
)
export type ToolType = Schema.Schema.Type<typeof ToolType>

// Enchantment
export const EnchantmentType = Schema.Literal(
  'efficiency', 'fortune', 'silk_touch', 'unbreaking'
)
export type EnchantmentType = Schema.Schema.Type<typeof EnchantmentType>

export const Enchantment = Schema.Struct({
  type: EnchantmentType,
  level: Schema.Number.pipe(Schema.positive())
})
export type Enchantment = Schema.Schema.Type<typeof Enchantment>

// Tool
export const Tool = Schema.Struct({
  type: ToolType,
  material: MaterialCategory,
  enchantments: Schema.Array(Enchantment)
})
export type Tool = Schema.Schema.Type<typeof Tool>

// Material Definition
export const Material = Schema.Struct({
  id: MaterialId,
  category: MaterialCategory,
  hardness: Hardness,
  blastResistance: BlastResistance,
  isFlammable: Schema.Boolean,
  burnTime: Schema.optional(BurnTime),
  requiresTool: Schema.Boolean,
  preferredTool: Schema.optional(ToolType),
  harvestLevel: Schema.Number.pipe(Schema.between(0, 5)),
  drops: Schema.Array(ItemStack),
  luminance: Schema.Number.pipe(Schema.between(0, 15))
})
export type Material = Schema.Schema.Type<typeof Material>

// Tool Efficiency Matrix
export const ToolEfficiency = Schema.Struct({
  toolType: ToolType,
  toolMaterial: MaterialCategory,
  targetMaterial: MaterialCategory,
  speedMultiplier: MiningSpeed,
  canHarvest: Schema.Boolean
})
export type ToolEfficiency = Schema.Schema.Type<typeof ToolEfficiency>

// Material Events
export const MaterialEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('BlockBroken'),
    position: Position3D,
    material: Material,
    tool: Schema.optional(Tool),
    drops: Schema.Array(ItemStack)
  }),
  Schema.Struct({
    _tag: Schema.Literal('MaterialBurned'),
    position: Position3D,
    material: Material,
    burnTime: BurnTime
  }),
  Schema.Struct({
    _tag: Schema.Literal('ToolDamaged'),
    toolId: ItemId,
    damageAmount: Schema.Number,
    remainingDurability: Schema.Number
  })
)
export type MaterialEvent = Schema.Schema.Type<typeof MaterialEvent>

// Errors
export class MaterialNotFoundError extends Schema.TaggedError<MaterialNotFoundError>()('MaterialNotFoundError', {
  blockId: BlockId
}) {}

export class InvalidToolError extends Schema.TaggedError<InvalidToolError>()('InvalidToolError', {
  message: Schema.String
}) {}