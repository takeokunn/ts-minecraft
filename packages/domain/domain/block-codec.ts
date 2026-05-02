import { Array as Arr, Option } from 'effect'
import { BlockType } from './block'

// Single source of truth for storage indices. Array position = storage index (0=AIR, 1=DIRT, …).
export const INDEX_TO_BLOCK_TYPE: ReadonlyArray<BlockType> = [
  'AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE',
  'GRANITE', 'DIORITE', 'ANDESITE', 'DEEPSLATE', 'BEDROCK', 'LAVA', 'OBSIDIAN',
  'COAL_ORE', 'IRON_ORE', 'GOLD_ORE', 'DIAMOND_ORE', 'REDSTONE_ORE', 'LAPIS_ORE', 'EMERALD_ORE',
  'DEEPSLATE_COAL_ORE', 'DEEPSLATE_IRON_ORE', 'DEEPSLATE_GOLD_ORE', 'DEEPSLATE_DIAMOND_ORE',
  'DEEPSLATE_REDSTONE_ORE', 'DEEPSLATE_LAPIS_ORE', 'DEEPSLATE_EMERALD_ORE',
  'COAL_BLOCK', 'IRON_BLOCK', 'GOLD_BLOCK', 'DIAMOND_BLOCK', 'REDSTONE_BLOCK', 'LAPIS_BLOCK', 'EMERALD_BLOCK',
  'PLANKS', 'STICKS', 'CRAFTING_TABLE', 'FURNACE', 'TORCH', 'COAL', 'WOODEN_SWORD', 'WOODEN_PICKAXE', 'STONE_PICKAXE', 'RAW_IRON', 'IRON_INGOT', 'IRON_PICKAXE', 'RAW_GOLD', 'GOLD_INGOT', 'DIAMOND', 'REDSTONE_DUST', 'LAPIS_LAZULI', 'EMERALD', 'DIAMOND_PICKAXE',
]

// Reverse lookup: BlockType → storage index. Derived from INDEX_TO_BLOCK_TYPE.
export const BLOCK_TYPE_TO_INDEX: Readonly<Record<BlockType, number>> = Object.fromEntries(
  INDEX_TO_BLOCK_TYPE.map((type, idx) => [type, idx])
) as Readonly<Record<BlockType, number>>

export const blockTypeToIndex = (blockType: BlockType): number => BLOCK_TYPE_TO_INDEX[blockType]

export const indexToBlockType = (index: number): BlockType =>
  Option.getOrElse(Arr.get(INDEX_TO_BLOCK_TYPE, index), () => 'AIR' as const)
