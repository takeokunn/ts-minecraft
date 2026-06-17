import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { resolveFallDamage } from './fall-damage'

describe('physics-stage-health/fall-damage', () => {
  it('returns the original damage when the player has no Feather Falling', () => {
    expect(resolveFallDamage(8, Option.none())).toBe(8)
  })

  it('reduces fall damage by the Feather Falling reduction', () => {
    expect(
      resolveFallDamage(10, Option.some({
        itemType: 'IRON_BOOTS',
        count: 1,
        enchantments: [{ type: 'FEATHER_FALLING', level: 4 }],
      })),
    ).toBeCloseTo(5.2)
  })

  it('keeps nonpositive fall damage unchanged', () => {
    expect(resolveFallDamage(0, Option.some({
      itemType: 'IRON_BOOTS',
      count: 1,
      enchantments: [{ type: 'FEATHER_FALLING', level: 4 }],
    }))).toBe(0)
  })
})
