import { HashSet } from 'effect'
import type { BlockType } from '@ts-minecraft/kernel'

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
