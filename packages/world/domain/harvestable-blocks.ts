import { HashSet } from 'effect'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'

export const PICKAXE_TOOLS = [
  'DIAMOND_PICKAXE',
  'GOLD_PICKAXE',
  'IRON_PICKAXE',
  'STONE_PICKAXE',
  'WOODEN_PICKAXE',
] as const satisfies ReadonlyArray<InventoryItem>

export type PickaxeTool = (typeof PICKAXE_TOOLS)[number]

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

export const PICKAXE_HARVEST_SETS = {
  DIAMOND_PICKAXE: DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
  GOLD_PICKAXE: WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
  IRON_PICKAXE: IRON_PICKAXE_HARVESTABLE_BLOCKS,
  STONE_PICKAXE: STONE_PICKAXE_HARVESTABLE_BLOCKS,
  WOODEN_PICKAXE: WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
} satisfies Record<PickaxeTool, HashSet.HashSet<BlockType>>

// Every block that needs some pickaxe to drop is represented by the largest tier.
export const PICKAXE_REQUIRED_BLOCKS = DIAMOND_PICKAXE_HARVESTABLE_BLOCKS

export const isPickaxeTool = (item: InventoryItem): item is PickaxeTool =>
  Object.hasOwn(PICKAXE_HARVEST_SETS, item)

export const getPickaxeHarvestableBlocks = (tool: PickaxeTool): HashSet.HashSet<BlockType> =>
  PICKAXE_HARVEST_SETS[tool]
