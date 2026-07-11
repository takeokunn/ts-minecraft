import { afterEach, describe, expect, it } from 'vitest'
import { applyHudScale, getHudScale } from './hud-scale'

describe('HUD scale', () => {
  afterEach(() => {
    applyHudScale(1)
  })

  it('shares the current scale with non-DOM HUD renderers', () => {
    applyHudScale(1.5)

    expect(getHudScale()).toBe(1.5)
  })
})
