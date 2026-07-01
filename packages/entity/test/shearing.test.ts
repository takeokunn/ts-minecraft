import { describe, expect, it } from 'vitest'
import {
  SHEAR_WOOL_MAX,
  SHEAR_WOOL_MIN,
  WOOL_REGROWTH_TICKS,
  canBeSheared,
  shearWoolCount,
  tickWoolRegrowth,
} from '@ts-minecraft/entity/domain/mob/shearing'

// ─── canBeSheared ─────────────────────────────────────────────────────────────
describe('canBeSheared', () => {
  it('returns true when regrowth timer is 0 (fully woolly)', () => {
    expect(canBeSheared(0)).toBe(true)
  })

  it('returns false when regrowth timer is positive (regrowing)', () => {
    expect(canBeSheared(1)).toBe(false)
    expect(canBeSheared(WOOL_REGROWTH_TICKS)).toBe(false)
  })

  it('returns true for negative values (edge case — treated as woolly)', () => {
    expect(canBeSheared(-1)).toBe(true)
  })
})

// ─── shearWoolCount ───────────────────────────────────────────────────────────
describe('shearWoolCount', () => {
  it('always returns a value in [SHEAR_WOOL_MIN, SHEAR_WOOL_MAX]', () => {
    for (let hash = 0; hash < 100; hash++) {
      const count = shearWoolCount(hash)
      expect(count).toBeGreaterThanOrEqual(SHEAR_WOOL_MIN)
      expect(count).toBeLessThanOrEqual(SHEAR_WOOL_MAX)
    }
  })

  it('is deterministic for the same hash', () => {
    expect(shearWoolCount(42)).toBe(shearWoolCount(42))
  })

  it('covers the full range across different hashes', () => {
    const counts = new Set<number>()
    for (let hash = 0; hash < 300; hash++) {
      counts.add(shearWoolCount(hash))
    }
    expect(counts.size).toBe(SHEAR_WOOL_MAX - SHEAR_WOOL_MIN + 1)
  })
})

// ─── tickWoolRegrowth ─────────────────────────────────────────────────────────
describe('tickWoolRegrowth', () => {
  it('decrements regrowth ticks by ticksElapsed', () => {
    expect(tickWoolRegrowth(100, 5)).toBe(95)
  })

  it('clamps at 0 when ticks elapsed exceeds remaining regrowth', () => {
    expect(tickWoolRegrowth(3, 10)).toBe(0)
  })

  it('stays at 0 when already fully regrown (no-op for woolly sheep)', () => {
    expect(tickWoolRegrowth(0, 20)).toBe(0)
  })

  it('decrements to exactly 0 when ticks remaining equals ticks elapsed', () => {
    expect(tickWoolRegrowth(50, 50)).toBe(0)
  })

  it('decrements by the full WOOL_REGROWTH_TICKS after full cycle', () => {
    expect(tickWoolRegrowth(WOOL_REGROWTH_TICKS, WOOL_REGROWTH_TICKS)).toBe(0)
  })
})
