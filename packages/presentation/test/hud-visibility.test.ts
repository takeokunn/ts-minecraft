import { describe, expect, it } from 'vitest'
import {
  isGameplayHudHidden,
  toggleGameplayHudVisibility,
  setGameplayHudHidden,
  GAMEPLAY_HUD_HIDDEN_CLASS,
} from '../hud/hud-visibility'

// Tests run in node environment (document === undefined).
// All DOM-path functions must degrade gracefully without throwing.

describe('GAMEPLAY_HUD_HIDDEN_CLASS', () => {
  it('is a non-empty string constant', () => {
    expect(typeof GAMEPLAY_HUD_HIDDEN_CLASS).toBe('string')
    expect(GAMEPLAY_HUD_HIDDEN_CLASS.length).toBeGreaterThan(0)
  })
})

describe('isGameplayHudHidden — no DOM', () => {
  it('returns false when document is undefined', () => {
    expect(isGameplayHudHidden()).toBe(false)
  })
})

describe('toggleGameplayHudVisibility — no DOM', () => {
  it('returns false when document is undefined', () => {
    expect(toggleGameplayHudVisibility()).toBe(false)
  })
})

describe('setGameplayHudHidden — no DOM', () => {
  it('does not throw when document is undefined', () => {
    expect(() => setGameplayHudHidden(true)).not.toThrow()
    expect(() => setGameplayHudHidden(false)).not.toThrow()
  })
})
