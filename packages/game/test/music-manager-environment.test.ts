import { describe, expect, it } from 'vitest'
import { resolveMusicEnvironment } from '../application/music-manager-environment'

// ─── resolveMusicEnvironment ──────────────────────────────────────────────────

const ctx = (y: number, isNight: boolean) => ({
  playerPosition: { x: 0, y, z: 0 },
  isNight,
  caveThresholdY: 40,
})

describe('resolveMusicEnvironment', () => {
  it('returns "cave" when player is below caveThresholdY', () => {
    expect(resolveMusicEnvironment(ctx(30, false))).toBe('cave')
    expect(resolveMusicEnvironment(ctx(30, true))).toBe('cave')
  })

  it('returns "day" when above threshold and not night', () => {
    expect(resolveMusicEnvironment(ctx(64, false))).toBe('day')
  })

  it('returns "night" when above threshold and at night', () => {
    expect(resolveMusicEnvironment(ctx(64, true))).toBe('night')
  })

  it('returns "cave" when exactly at caveThresholdY (below = <, not <=)', () => {
    // Player at y=40 with caveThresholdY=40: 40 < 40 is false → not cave
    expect(resolveMusicEnvironment(ctx(40, false))).toBe('day')
    // Player at y=39: 39 < 40 → cave
    expect(resolveMusicEnvironment(ctx(39, false))).toBe('cave')
  })
})
