import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { resolveAirState, resolveEffectiveMaxAirSecs } from './air-logic'

describe('physics-stage-survival/air-logic', () => {
  it('drains air underwater and converts it to bubbles', () => {
    expect(resolveAirState(4.2, true, 1.5, 10)).toEqual({
      airSecs: 2.7,
      airBubbles: 3,
    })
  })

  it('refills air to the effective max when surfacing', () => {
    expect(resolveAirState(0.5, false, 1, 13)).toEqual({
      airSecs: 13,
      airBubbles: 10,
    })
  })

  it('adds respiration bonus to the base air supply', () => {
    expect(
      resolveEffectiveMaxAirSecs(
        Option.some({
          itemType: 'IRON_HELMET',
          count: 1,
          enchantments: [{ type: 'RESPIRATION', level: 2 }],
        }),
      ),
    ).toBe(45)
    expect(resolveEffectiveMaxAirSecs(Option.none())).toBe(15)
  })
})
