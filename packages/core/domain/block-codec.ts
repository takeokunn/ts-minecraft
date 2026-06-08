import { Array as Arr, Option } from 'effect'
import { BlockType } from './block-type'

// Single source of truth for storage indices. Array position = storage index (0=AIR, 1=DIRT, …).
export const INDEX_TO_BLOCK_TYPE: ReadonlyArray<BlockType> = [
  'AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE',
  'GRANITE', 'DIORITE', 'ANDESITE', 'DEEPSLATE', 'BEDROCK', 'LAVA', 'OBSIDIAN',
  'COAL_ORE', 'IRON_ORE', 'GOLD_ORE', 'DIAMOND_ORE', 'REDSTONE_ORE', 'LAPIS_ORE', 'EMERALD_ORE',
  'DEEPSLATE_COAL_ORE', 'DEEPSLATE_IRON_ORE', 'DEEPSLATE_GOLD_ORE', 'DEEPSLATE_DIAMOND_ORE',
  'DEEPSLATE_REDSTONE_ORE', 'DEEPSLATE_LAPIS_ORE', 'DEEPSLATE_EMERALD_ORE',
  'COAL_BLOCK', 'IRON_BLOCK', 'GOLD_BLOCK', 'DIAMOND_BLOCK', 'REDSTONE_BLOCK', 'LAPIS_BLOCK', 'EMERALD_BLOCK',
  'PLANKS', 'CRAFTING_TABLE', 'FURNACE', 'TORCH',
  'NETHERRACK', 'NETHER_PORTAL',
  'FARMLAND', 'WHEAT_CROP',
  // Redstone components (Phase 16) — indices 48–52
  'REDSTONE_WIRE', 'REDSTONE_TORCH', 'LEVER', 'STONE_BUTTON', 'REPEATER',
  // Furniture — index 53
  'BED',
  // Crafting stations — index 54
  'ENCHANTING_TABLE',
  // The End dimension — indices 55–57
  'END_STONE', 'END_PORTAL_FRAME', 'END_PORTAL',
  // Explosives — index 58
  'TNT',
  // The End expansion (Phase 18) — indices 59–71
  'CHORUS_FLOWER', 'CHORUS_PLANT', 'DRAGON_EGG', 'END_CRYSTAL', 'END_GATEWAY', 'END_ROD',
  'END_STONE_BRICKS', 'ENDER_CHEST', 'PURPUR_BLOCK', 'PURPUR_PILLAR', 'PURPUR_SLAB',
  'PURPUR_STAIRS', 'SHULKER_BOX',
]

export const BLOCK_COUNT = INDEX_TO_BLOCK_TYPE.length
export const totalBlockTypes = BLOCK_COUNT

// Reverse lookup: BlockType → storage index. Derived from INDEX_TO_BLOCK_TYPE.
export const BLOCK_TYPE_TO_INDEX: Readonly<Record<BlockType, number>> = Object.fromEntries(
  INDEX_TO_BLOCK_TYPE.map((type, idx) => [type, idx])
) as Readonly<Record<BlockType, number>>

export const blockTypeToIndex = (blockType: BlockType): number => BLOCK_TYPE_TO_INDEX[blockType]

export const isValidBlockType = (value: string): value is BlockType =>
  Object.hasOwn(BLOCK_TYPE_TO_INDEX, value)

export const indexToBlockType = (index: number): BlockType =>
  Option.getOrElse(Arr.get(INDEX_TO_BLOCK_TYPE, index), () => 'AIR' as const)
