import type { BlockType, InventoryItem } from '@ts-minecraft/core'

export const SAPLING_TREE_TRUNK_HEIGHT = 5

export const SAPLING_REPLACEABLE_BLOCK_TYPES = new Set<BlockType>(['AIR', 'LEAVES', 'SAPLING'])

export const PLANTABLE_CROP_ITEMS = new Map<InventoryItem, BlockType>([
  ['WHEAT_SEEDS', 'WHEAT_CROP'],
  ['POTATO', 'POTATO_CROP'],
  ['NETHER_WART', 'NETHER_WART_CROP'],
])

// Soil each crop plants into. Overworld crops need tilled FARMLAND; nether
// wart only grows on SOUL_SAND (vanilla).
export const CROP_SOIL_BLOCK_TYPES = new Map<BlockType, BlockType>([
  ['WHEAT_CROP', 'FARMLAND'],
  ['POTATO_CROP', 'FARMLAND'],
  ['NETHER_WART_CROP', 'SOUL_SAND'],
])

export const BONE_MEAL_CROP_BLOCK_TYPES = new Set<BlockType>(['WHEAT_CROP', 'POTATO_CROP', 'NETHER_WART_CROP'])
