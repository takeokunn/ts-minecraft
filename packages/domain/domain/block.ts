import { Schema } from 'effect'
import { BlockIdSchema } from '@ts-minecraft/kernel'

export { BlockIdSchema }

export const BlockTypeSchema = Schema.Literal(
  'AIR',
  'DIRT',
  'STONE',
  'WOOD',
  'GRASS',
  'SAND',
  'WATER',
  'LEAVES',
  'GLASS',
  'SNOW',
  'GRAVEL',
  'COBBLESTONE',
  'GRANITE',
  'DIORITE',
  'ANDESITE',
  'DEEPSLATE',
  'BEDROCK',
  'LAVA',
  'OBSIDIAN',
  'COAL_ORE',
  'IRON_ORE',
  'GOLD_ORE',
  'DIAMOND_ORE',
  'REDSTONE_ORE',
  'LAPIS_ORE',
  'EMERALD_ORE',
  'DEEPSLATE_COAL_ORE',
  'DEEPSLATE_IRON_ORE',
  'DEEPSLATE_GOLD_ORE',
  'DEEPSLATE_DIAMOND_ORE',
  'DEEPSLATE_REDSTONE_ORE',
  'DEEPSLATE_LAPIS_ORE',
  'DEEPSLATE_EMERALD_ORE',
  'COAL_BLOCK',
  'IRON_BLOCK',
  'GOLD_BLOCK',
  'DIAMOND_BLOCK',
  'REDSTONE_BLOCK',
  'LAPIS_BLOCK',
  'EMERALD_BLOCK',
  'PLANKS',
  'STICKS',
  'CRAFTING_TABLE',
  'FURNACE',
  'TORCH',
  'COAL',
  'WOODEN_SWORD',
  'WOODEN_PICKAXE',
  'STONE_PICKAXE',
  'RAW_IRON',
  'IRON_INGOT',
  'IRON_PICKAXE',
  'RAW_GOLD',
  'GOLD_INGOT',
  'DIAMOND',
  'REDSTONE_DUST',
  'LAPIS_LAZULI',
  'EMERALD',
  'DIAMOND_PICKAXE'
)
export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>

export const BlockPropertiesSchema = Schema.Struct({
  hardness: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
  transparency: Schema.Boolean,
  solid: Schema.Boolean,
  emissive: Schema.Boolean,
  friction: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type BlockProperties = Schema.Schema.Type<typeof BlockPropertiesSchema>

export const BlockFaceSchema = Schema.Struct({
  top: Schema.Boolean,
  bottom: Schema.Boolean,
  north: Schema.Boolean,
  south: Schema.Boolean,
  east: Schema.Boolean,
  west: Schema.Boolean,
})
export type BlockFace = Schema.Schema.Type<typeof BlockFaceSchema>

export class Block extends Schema.Class<Block>('Block')({
  id: BlockIdSchema,
  type: BlockTypeSchema,
  properties: BlockPropertiesSchema,
  faces: BlockFaceSchema,
}) {}
