import { describe, expect, it } from '@effect/vitest'
import { footstepEffectForBlock } from './footstep-sound-logic'

describe('physics-stage-survival/footstep-sound-logic', () => {
  it('maps representative blocks to sounds', () => {
    expect(footstepEffectForBlock('WOOD')).toBe('footstepWood')
    expect(footstepEffectForBlock('GRASS')).toBe('footstepGrass')
    expect(footstepEffectForBlock('STONE')).toBe('footstepStone')
    expect(footstepEffectForBlock('WATER')).toBeNull()
  })
})
