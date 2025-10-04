import { describe, expect, it } from '@effect/vitest'
import { FluidState } from '../value_object/fluid-state'
import { analyzeTerrain } from '../domain_service/terrain-adaptation-service'

describe('TerrainAdaptationService (integration)', () => {
  it('detects solid terrain with no fluid', () => {
    const result = analyzeTerrain({
      feetBlock: 1,
      bodyBlock: 1,
      belowBlock: 1,
      fluid: FluidState.presets.none,
    })

    expect(result.surface).toBe('solid')
    expect(result.movementMultiplier).toBe(1)
  })

  it('detects fluid terrain with high resistance', () => {
    const result = analyzeTerrain({
      feetBlock: 9,
      bodyBlock: 9,
      belowBlock: 9,
      fluid: FluidState.presets.lava,
    })

    expect(result.surface).toBe('liquid')
    expect(result.movementMultiplier).toBeLessThan(0.5)
    expect(result.breathingDifficulty).toBeGreaterThan(0)
  })
})
