import { describe, expect, it } from '@effect/vitest'
import {
  FOOTSTEP_GRASS_BLOCKS,
  FOOTSTEP_STONE_BLOCKS,
  FOOTSTEP_WOOD_BLOCKS,
} from './footstep-sound-data'

describe('physics-stage-survival/footstep-sound-data', () => {
  it('groups grass, wood, and stone blocks', () => {
    expect(FOOTSTEP_GRASS_BLOCKS).toContain('GRASS')
    expect(FOOTSTEP_WOOD_BLOCKS).toContain('WOOD')
    expect(FOOTSTEP_STONE_BLOCKS).toContain('STONE')
  })
})
