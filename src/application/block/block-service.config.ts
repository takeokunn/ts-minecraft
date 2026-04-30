import { HashMap, HashSet, Option } from 'effect'
import type { BlockType } from '@/domain/block'

export const NON_PLACEABLE_BLOCK_TYPES: HashSet.HashSet<BlockType> = HashSet.fromIterable<BlockType>([
  'STICKS',
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
  'DIAMOND_PICKAXE',
])

export const INVENTORY_DROP_OVERRIDES: HashMap.HashMap<BlockType, BlockType> = HashMap.fromIterable<BlockType, BlockType>([
  ['STONE', 'COBBLESTONE'],
  ['COAL_ORE', 'COAL'],
  ['DEEPSLATE_COAL_ORE', 'COAL'],
  ['IRON_ORE', 'RAW_IRON'],
  ['DEEPSLATE_IRON_ORE', 'RAW_IRON'],
  ['GOLD_ORE', 'RAW_GOLD'],
  ['DEEPSLATE_GOLD_ORE', 'RAW_GOLD'],
  ['DIAMOND_ORE', 'DIAMOND'],
  ['DEEPSLATE_DIAMOND_ORE', 'DIAMOND'],
  ['REDSTONE_ORE', 'REDSTONE_DUST'],
  ['DEEPSLATE_REDSTONE_ORE', 'REDSTONE_DUST'],
  ['LAPIS_ORE', 'LAPIS_LAZULI'],
  ['DEEPSLATE_LAPIS_ORE', 'LAPIS_LAZULI'],
  ['EMERALD_ORE', 'EMERALD'],
  ['DEEPSLATE_EMERALD_ORE', 'EMERALD'],
])

export const getInventoryDropForBlock = (blockType: BlockType): BlockType =>
  Option.getOrElse(HashMap.get(INVENTORY_DROP_OVERRIDES, blockType), () => blockType)

export const PICKAXE_BLOCK_TYPES: HashSet.HashSet<BlockType> = HashSet.fromIterable<BlockType>([
  'WOODEN_PICKAXE',
  'STONE_PICKAXE',
  'IRON_PICKAXE',
  'DIAMOND_PICKAXE',
])

export const WOODEN_PICKAXE_HARVESTABLE_BLOCKS: HashSet.HashSet<BlockType> = HashSet.fromIterable<BlockType>([
  'STONE',
  'COAL_ORE',
  'DEEPSLATE_COAL_ORE',
])

export const STONE_PICKAXE_HARVESTABLE_BLOCKS: HashSet.HashSet<BlockType> = HashSet.union(
  WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
  HashSet.fromIterable<BlockType>([
    'IRON_ORE',
    'DEEPSLATE_IRON_ORE',
    'DEEPSLATE_LAPIS_ORE',
    'LAPIS_ORE',
  ]),
)

export const IRON_PICKAXE_HARVESTABLE_BLOCKS: HashSet.HashSet<BlockType> = HashSet.union(
  STONE_PICKAXE_HARVESTABLE_BLOCKS,
  HashSet.fromIterable<BlockType>([
    'GOLD_ORE',
    'REDSTONE_ORE',
    'DIAMOND_ORE',
    'EMERALD_ORE',
    'DEEPSLATE_GOLD_ORE',
    'DEEPSLATE_REDSTONE_ORE',
    'DEEPSLATE_DIAMOND_ORE',
    'DEEPSLATE_EMERALD_ORE',
  ]),
)

export const DIAMOND_PICKAXE_HARVESTABLE_BLOCKS: HashSet.HashSet<BlockType> = HashSet.union(
  IRON_PICKAXE_HARVESTABLE_BLOCKS,
  HashSet.fromIterable<BlockType>(['OBSIDIAN']),
)
