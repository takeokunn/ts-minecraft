import { describe, expect, it } from 'vitest'
import { analyzeTerrain } from '../terrain-adaptation-service'
import { FluidState } from '../../value_object/fluid-state'

describe('TerrainAdaptationService.analyzeTerrain', () => {
  it('classifies solid ground', () => {
    const analysis = analyzeTerrain({
      feetBlock: 1,
      bodyBlock: null,
      belowBlock: 1,
      fluid: FluidState.presets.none,
    })

    expect(analysis).toStrictEqual({
      surface: 'solid',
      movementMultiplier: 1,
      canJump: true,
      canStep: true,
      breathingDifficulty: 0,
    })
  })

  it('identifies liquid surface and applies movement penalties', () => {
    const analysis = analyzeTerrain({
      feetBlock: 9,
      bodyBlock: null,
      belowBlock: 9,
      fluid: FluidState.presets.water,
    })

    expect(analysis).toStrictEqual({
      surface: 'liquid',
      movementMultiplier: 0.4,
      canJump: true,
      canStep: true,
      breathingDifficulty: 1,
    })
  })
})
