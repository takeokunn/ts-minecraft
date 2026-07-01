import type { BlockType, InventoryItem } from '@ts-minecraft/core'

export const SAPLING_TREE_TRUNK_HEIGHT = 5

export const SAPLING_REPLACEABLE_BLOCK_TYPES = new Set<BlockType>(['AIR', 'LEAVES', 'SAPLING'])

export const PLANTABLE_CROP_ITEMS = new Map<InventoryItem, BlockType>([
  ['WHEAT_SEEDS', 'WHEAT_CROP'],
  ['POTATO', 'POTATO_CROP'],
])

export const BONE_MEAL_CROP_BLOCK_TYPES = new Set<BlockType>(['WHEAT_CROP', 'POTATO_CROP'])
