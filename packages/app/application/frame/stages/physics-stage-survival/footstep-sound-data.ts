import type { BlockType } from '@ts-minecraft/core'

export const FOOTSTEP_GRASS_BLOCKS = ['GRASS', 'DIRT', 'FARMLAND'] as const satisfies readonly BlockType[]

export const FOOTSTEP_WOOD_BLOCKS = [
  'WOOD',
  'PLANKS',
  'LEAVES',
  'SAPLING',
  'LADDER',
  'CHEST',
  'DOOR',
] as const satisfies readonly BlockType[]

export const FOOTSTEP_STONE_BLOCKS = [
  'STONE',
  'GRAVEL',
  'SAND',
  'COBBLESTONE',
  'STONE',
  'COBBLESTONE',
  'END_STONE_BRICKS',
] as const satisfies readonly BlockType[]
