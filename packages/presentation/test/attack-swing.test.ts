import { describe, expect, it } from 'vitest'
import {
  ATTACK_SWING_DURATION_MS,
  createAttackSwingState,
  easeInCubic,
  easeOutCubic,
  getAttackSwingOffset,
  swingProgress,
  triggerAttackSwing,
} from '../hud/attack-swing'

describe('presentation/hud/attack-swing', () => {
  it('creates an inactive swing state', () => {
    expect(createAttackSwingState()).toEqual({ triggerTime: 0, isActive: false })
  })

  it('triggers the swing at the supplied timestamp', () => {
    const state = createAttackSwingState()

    expect(triggerAttackSwing(state, 1250)).toBe(state)
    expect(state).toEqual({ triggerTime: 1250, isActive: true })
  })

  it('uses pure cubic easing curves clamped to [0, 1]', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeInCubic(0.5)).toBeCloseTo(0.125)
    expect(easeInCubic(2)).toBe(1)
  })

  it('moves down and right, then returns within 300ms', () => {
    const state = triggerAttackSwing(createAttackSwingState(), 1000)
    const start = getAttackSwingOffset(state, 1000)
    const down = getAttackSwingOffset(state, 1000 + ATTACK_SWING_DURATION_MS * 0.45)
    const recovery = getAttackSwingOffset(state, 1000 + ATTACK_SWING_DURATION_MS * 0.75)
    const end = getAttackSwingOffset(state, 1000 + ATTACK_SWING_DURATION_MS)

    expect(start).toEqual({ x: 0, y: 0 })
    expect(down.x).toBeCloseTo(1)
    expect(down.y).toBeCloseTo(-1)
    expect(recovery.x).toBeGreaterThan(0)
    expect(recovery.x).toBeLessThan(1)
    expect(recovery.y).toBeLessThan(0)
    expect(end).toEqual({ x: 0, y: 0 })
  })

  it('keeps offsets inside the normalized [-1, 1] range', () => {
    const state = triggerAttackSwing(createAttackSwingState(), 0)

    for (let now = 0; now <= ATTACK_SWING_DURATION_MS; now += 15) {
      const offset = getAttackSwingOffset(state, now)
      expect(offset.x).toBeGreaterThanOrEqual(-1)
      expect(offset.x).toBeLessThanOrEqual(1)
      expect(offset.y).toBeGreaterThanOrEqual(-1)
      expect(offset.y).toBeLessThanOrEqual(1)
    }
  })

  it('exposes progress as a downstroke and recovery curve', () => {
    expect(swingProgress(0)).toBe(0)
    expect(swingProgress(0.45)).toBeCloseTo(1)
    expect(swingProgress(1)).toBe(0)
  })
})
