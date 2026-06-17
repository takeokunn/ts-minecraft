import type { BlockType } from '@ts-minecraft/core'
import type { SoundEffect } from '@ts-minecraft/game'
import {
  FOOTSTEP_GRASS_BLOCKS,
  FOOTSTEP_STONE_BLOCKS,
  FOOTSTEP_WOOD_BLOCKS,
} from './footstep-sound-data'

export const FOOTSTEP_WALK_INTERVAL_BLOCKS = 0.72
export const FOOTSTEP_SPRINT_INTERVAL_BLOCKS = 0.55
export const FOOTSTEP_GROUND_SAMPLE_OFFSET = 0.05

const includesBlockType = (blocks: ReadonlyArray<BlockType>, block: BlockType): boolean =>
  blocks.includes(block)

export const footstepEffectForBlock = (block: BlockType | null): SoundEffect | null => {
  if (block === null) return null
  if (includesBlockType(FOOTSTEP_GRASS_BLOCKS, block)) return 'footstepGrass'
  if (includesBlockType(FOOTSTEP_WOOD_BLOCKS, block)) return 'footstepWood'
  if (includesBlockType(FOOTSTEP_STONE_BLOCKS, block)) return 'footstepStone'
  return null
}
