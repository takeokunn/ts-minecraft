import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { resolveDayNightCycleAppearance, resolveDayNightCycleState } from '@ts-minecraft/game'

const appearanceAt = (timeOfDay: number) => resolveDayNightCycleAppearance(resolveDayNightCycleState(timeOfDay))

describe('game/day-night-cycle-appearance', () => {
  it('resolves bright daytime lighting at noon', () => {
    const appearance = appearanceAt(0.5)

    expect(appearance.directionalLightIntensity).toBeCloseTo(1, 6)
    expect(appearance.ambientLightIntensity).toBeCloseTo(0.98, 6)
    expect(appearance.lightPosition.x).toBeCloseTo(0, 6)
    expect(appearance.lightPosition.y).toBeCloseTo(80, 6)
    expect(appearance.skySunPosition).toEqual(appearance.lightPosition)
    expect(appearance.skyTurbidity).toBeCloseTo(2, 6)
    expect(appearance.skyRayleigh).toBeCloseTo(3, 6)
    expect(appearance.moonOpacity).toBeCloseTo(0, 6)
    expect(appearance.moonVisible).toBe(false)
  })

  it('resolves night lighting with a visible moon at midnight', () => {
    const appearance = appearanceAt(0)

    expect(appearance.directionalLightIntensity).toBeCloseTo(0.3, 6)
    expect(appearance.ambientLightIntensity).toBeCloseTo(0.56, 6)
    expect(appearance.lightPosition.x).toBeCloseTo(0, 6)
    expect(appearance.lightPosition.y).toBeCloseTo(-80, 6)
    expect(appearance.skyTurbidity).toBeCloseTo(4, 6)
    expect(appearance.skyRayleigh).toBeCloseTo(0.5, 6)
    expect(appearance.moonPosition.x).toBeCloseTo(0, 6)
    expect(appearance.moonPosition.y).toBeCloseTo(80, 6)
    expect(appearance.moonOpacity).toBeCloseTo(1, 6)
    expect(appearance.moonVisible).toBe(true)
  })

  it('keeps dawn and dusk in the warm horizon transition band', () => {
    const dawn = appearanceAt(0.25)
    const dusk = appearanceAt(0.75)

    expect(dawn.directionalLightColor.h).toBeCloseTo(0.02, 6)
    expect(dawn.directionalLightColor.s).toBeCloseTo(0.45, 6)
    expect(dawn.ambientLightColor.h).toBeCloseTo(0.06, 6)
    expect(dawn.ambientLightColor.s).toBeCloseTo(0.15, 6)
    expect(dawn.moonVisible).toBe(false)

    expect(dusk.directionalLightColor.h).toBeCloseTo(0.02, 6)
    expect(dusk.directionalLightColor.s).toBeCloseTo(0.45, 6)
    expect(dusk.ambientLightColor.h).toBeCloseTo(0.06, 6)
    expect(dusk.ambientLightColor.s).toBeCloseTo(0.15, 6)
    expect(dusk.moonVisible).toBe(false)
  })
})
